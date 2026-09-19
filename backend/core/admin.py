from datetime import datetime, time, timedelta

from django import forms
from django.contrib import admin
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import (
    BigIntegerField,
    Count,
    DurationField,
    ExpressionWrapper,
    F,
    Min,
    Q,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce, TruncDate, TruncMonth
from django.utils.html import format_html, format_html_join
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.utils.dateparse import parse_date
from .models import (
    Category,
    Listing,
    ListingImage,
    Availability,
    Booking,
    Amenity,
    HostApplication,
    Notification,
    Payment,
    HostPayout,
    GuestRefund,
    FinancialAuditLog,
    SupportRequest,
    PlatformAnalyticsEvent,
)
from core.services.booking_times import (
    PLATFORM_TIME_ZONE,
    check_in_at,
    check_out_at,
    payout_eligible_at,
)
from core.services.settlements import (
    ensure_host_payout,
    payment_received_amount,
    sync_cancellation_settlements,
    write_financial_audit,
)
from core.utils.email_notifications import send_notification_email
from django.contrib.auth import get_user_model

User = get_user_model()
admin.site.site_header = "Танайд Хоноё удирдлага"
admin.site.site_title = "Танайд Хоноё"
admin.site.index_title = "Удирдлагын хэсэг"


# ── User ──────────────────────────────────────────────────────────────────────
@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("username", "email", "is_host", "host_application_status", "date_joined", "is_staff")
    list_filter = ("is_host", "host_application_status", "is_staff")
    search_fields = ("username", "email")
    ordering = ("-date_joined",)
    readonly_fields = ("date_joined", "last_login")


# ── Booking ───────────────────────────────────────────────────────────────────
@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "id", "guest_name_display", "listing_title", "check_in", "check_out",
        "guest_count", "total_price_display", "host_payout_display", "platform_fee_display",
        "status", "is_cancelled_by_host", "host_cancelled_at", "guest_cancelled_at", "created_at",
    )
    list_filter = (
        "status", "is_cancelled_by_host",
        ("host_cancelled_at", admin.EmptyFieldListFilter),
        ("guest_cancelled_at", admin.EmptyFieldListFilter), "check_in",
    )
    search_fields = ("id", "full_name", "phone_number", "guest__username", "listing__title")
    ordering = ("-created_at",)
    readonly_fields = (
        "created_at", "host_cancelled_at", "host_cancellation_reason",
        "host_cancellation_policy_version",
        "guest_cancelled_at", "guest_cancellation_reason",
        "guest_cancellation_policy_version",
    )
    actions = ("create_missing_financial_records",)

    @admin.action(description="Санхүүгийн дутуу бүртгэлийг шалгах төлөвөөр үүсгэх")
    def create_missing_financial_records(self, request, queryset):
        created = 0
        skipped = 0
        for booking in queryset.select_related("listing__host"):
            if booking.status not in {"confirmed", "cancelled"}:
                skipped += 1
                continue
            if booking.guest_cancelled_at or booking.host_cancelled_at or booking.is_cancelled_by_host:
                payout_existed = hasattr(booking, "host_payout")
                sync_cancellation_settlements(booking, legacy_review=True)
                created += 0 if payout_existed else 1
            else:
                _, was_created = ensure_host_payout(booking, legacy_review=True)
                created += int(was_created)
        self.message_user(
            request,
            f"{created} санхүүгийн бүртгэл үүсгэлээ. {skipped} захиалгыг төлөвөөс нь шалтгаалан алгаслаа.",
        )

    def guest_name_display(self, obj):
        return f"{obj.full_name} (@{obj.guest.username})"
    guest_name_display.short_description = "Зочин"

    def listing_title(self, obj):
        return obj.listing.title
    listing_title.short_description = "Зар"

    def total_price_display(self, obj):
        return f"₮{obj.total_price:,}"
    total_price_display.short_description = "Нийт үнэ"

    def host_payout_display(self, obj):
        if obj.guest_cancelled_at:
            return "Гараар шийдвэрлэнэ"
        if obj.is_cancelled_by_host:
            return "₮0"
        payout = int(obj.total_price * 0.9)
        return f"₮{payout:,}"
    host_payout_display.short_description = "Түрээслүүлэгчид олгох"

    def platform_fee_display(self, obj):
        if obj.guest_cancelled_at:
            return "Гараар шийдвэрлэнэ"
        if obj.is_cancelled_by_host:
            return "₮0"
        fee = int(obj.total_price * 0.1) + obj.service_fee
        return f"₮{fee:,}"
    platform_fee_display.short_description = "Платформ орлого"


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id", "booking", "provider", "sender_invoice_no", "invoice_id",
        "amount_display", "provider_fee_display", "net_received_display",
        "currency", "status", "paid_at", "created_at",
    )
    list_filter = ("provider", "status", "currency", "created_at")
    search_fields = ("sender_invoice_no", "invoice_id", "booking__id", "booking__full_name")
    ordering = ("-created_at",)
    readonly_fields = (
        "booking",
        "provider",
        "invoice_id",
        "sender_invoice_no",
        "idempotency_key",
        "amount",
        "currency",
        "provider_fee_rate",
        "provider_fee_amount",
        "status",
        "raw_response",
        "paid_at",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description="Зочны төлсөн", ordering="amount")
    def amount_display(self, obj):
        return f"₮{obj.amount:,}"

    @admin.display(description="QPay шимтгэл", ordering="provider_fee_amount")
    def provider_fee_display(self, obj):
        return f"₮{obj.provider_fee_amount:,} ({obj.provider_fee_rate}%)"

    @admin.display(description="Дансанд цэвэр орсон")
    def net_received_display(self, obj):
        return f"₮{obj.net_received_amount:,}"


class HostPayoutForm(forms.ModelForm):
    class Meta:
        model = HostPayout
        fields = "__all__"

    def clean(self):
        cleaned_data = super().clean()
        status = cleaned_data.get("status") or self.instance.status
        adjustment = cleaned_data.get("adjustment_amount")
        if adjustment is None:
            adjustment = self.instance.adjustment_amount

        expected_net = max(
            int(self.instance.gross_amount)
            - int(self.instance.commission_amount)
            + int(adjustment),
            0,
        )
        self.instance.adjustment_amount = adjustment
        self.instance.net_amount = 0 if status == HostPayout.STATUS_NOT_PAYABLE else expected_net

        if status == HostPayout.STATUS_PAID:
            if timezone.now() < self.instance.eligible_at:
                raise forms.ValidationError(
                    "Гарах өдрийн 12:00 цагаас хойших 72 цаг дуусаагүй байна."
                )
            if not (cleaned_data.get("transfer_reference") or "").strip():
                self.add_error("transfer_reference", "Гүйлгээний дугаарыг заавал оруулна уу.")
            for field, label in (
                ("bank_name", "Банк"),
                ("account_number", "Дансны дугаар"),
                ("account_holder_name", "Данс эзэмшигч"),
            ):
                if not (cleaned_data.get(field) or getattr(self.instance, field) or "").strip():
                    self.add_error(field, f"{label} дутуу байна.")
            refund = _get_related_or_none(self.instance.booking, "guest_refund")
            if refund and refund.status == GuestRefund.STATUS_REVIEW:
                raise forms.ValidationError(
                    "Зочны буцаалтын шийдвэр гараагүй тул түрээслүүлэгчийн төлбөрийг шилжүүлэхгүй."
                )
            refund_amount = (
                refund.approved_amount
                if refund and refund.status in {GuestRefund.STATUS_APPROVED, GuestRefund.STATUS_PAID}
                else 0
            )
            received_amount = payment_received_amount(self.instance.booking)
            if received_amount <= 0:
                raise forms.ValidationError(
                    "Зочиноос төлбөр хүлээн авсан баталгаатай гүйлгээ байхгүй байна."
                )
            if self.instance.net_amount + refund_amount > received_amount:
                raise forms.ValidationError(
                    "Түрээслүүлэгчийн төлбөр болон зочны буцаалтын нийлбэр хүлээн авсан дүнгээс их байна."
                )
        if status == HostPayout.STATUS_HOLD and not (
            cleaned_data.get("hold_reason") or ""
        ).strip():
            self.add_error("hold_reason", "Саатуулсан шалтгааныг заавал бичнэ үү.")
        return cleaned_data


class PayoutOperationalStatusFilter(admin.SimpleListFilter):
    title = "Ажлын төлөв"
    parameter_name = "work_status"

    def lookups(self, request, model_admin):
        return [
            ("waiting", "72 цаг хүлээж байна"),
            ("ready", "Шилжүүлэхэд бэлэн"),
            (HostPayout.STATUS_REVIEW, "Шалгах шаардлагатай"),
            (HostPayout.STATUS_HOLD, "Саатуулсан"),
            (HostPayout.STATUS_PAID, "Шилжүүлсэн"),
            (HostPayout.STATUS_NOT_PAYABLE, "Олгохгүй"),
        ]

    def queryset(self, request, queryset):
        value = self.value()
        now = timezone.now()
        if value == "waiting":
            return queryset.filter(status=HostPayout.STATUS_PENDING, eligible_at__gt=now)
        if value == "ready":
            return queryset.filter(status=HostPayout.STATUS_PENDING, eligible_at__lte=now)
        if value:
            return queryset.filter(status=value)
        return queryset


@admin.register(HostPayout)
class HostPayoutAdmin(admin.ModelAdmin):
    form = HostPayoutForm
    list_display = (
        "booking_link",
        "host",
        "work_status_display",
        "eligible_at",
        "remaining_display",
        "net_amount_display",
        "bank_display",
        "paid_at",
    )
    list_filter = (PayoutOperationalStatusFilter, "legacy_review_required", "eligible_at")
    search_fields = (
        "booking__id",
        "booking__full_name",
        "booking__listing__title",
        "host__username",
        "account_number",
        "transfer_reference",
    )
    ordering = ("eligible_at", "id")
    readonly_fields = (
        "booking",
        "host",
        "gross_amount",
        "commission_rate",
        "commission_amount",
        "net_amount",
        "eligible_at",
        "paid_at",
        "paid_by",
        "legacy_review_required",
        "created_at",
        "updated_at",
        "audit_history",
    )
    fields = (
        "booking",
        "host",
        "status",
        "gross_amount",
        "commission_rate",
        "commission_amount",
        "adjustment_amount",
        "net_amount",
        "eligible_at",
        "bank_name",
        "account_number",
        "account_holder_name",
        "hold_reason",
        "notes",
        "transfer_reference",
        "transfer_proof",
        "paid_at",
        "paid_by",
        "legacy_review_required",
        "created_at",
        "updated_at",
        "audit_history",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        is_already_paid = bool(
            obj
            and HostPayout.objects.filter(
                pk=obj.pk, status=HostPayout.STATUS_PAID
            ).exists()
        )
        if is_already_paid:
            fields.extend(
                [
                    "status",
                    "adjustment_amount",
                    "hold_reason",
                    "bank_name",
                    "account_number",
                    "account_holder_name",
                    "transfer_reference",
                ]
            )
        return tuple(dict.fromkeys(fields))

    @admin.display(description="Захиалга", ordering="booking_id")
    def booking_link(self, obj):
        return format_html(
            '<a href="/admin/stats/bookings/{}/">#{}</a>', obj.booking_id, obj.booking_id
        )

    @admin.display(description="Ажлын төлөв")
    def work_status_display(self, obj):
        if obj.status == HostPayout.STATUS_PENDING:
            return "Шилжүүлэхэд бэлэн" if obj.eligible_at <= timezone.now() else "72 цаг хүлээж байна"
        return obj.get_status_display()

    @admin.display(description="Үлдсэн хугацаа")
    def remaining_display(self, obj):
        if obj.status != HostPayout.STATUS_PENDING:
            return "—"
        delta = obj.eligible_at - timezone.now()
        if delta.total_seconds() <= 0:
            return "Хугацаа дууссан"
        hours, remainder = divmod(int(delta.total_seconds()), 3600)
        minutes = remainder // 60
        return f"{hours} цаг {minutes} минут"

    @admin.display(description="Шилжүүлэх дүн", ordering="net_amount")
    def net_amount_display(self, obj):
        return f"₮{obj.net_amount:,}"

    @admin.display(description="Банк, данс")
    def bank_display(self, obj):
        return f"{obj.bank_name or '—'} · {obj.account_number or '—'}"

    @admin.display(description="Хяналтын түүх")
    def audit_history(self, obj):
        if not obj:
            return "—"
        rows = []
        for log in obj.audit_logs.select_related("actor").all()[:30]:
            actor = log.actor.username if log.actor else "Систем"
            rows.append(
                f"{timezone.localtime(log.created_at):%Y-%m-%d %H:%M} · {actor} · "
                f"{log.event} · {log.previous_status or '—'} → {log.new_status or '—'} · "
                f"₮{log.amount:,} · {log.message}"
            )
        return format_html_join("", "{}<br>", ((row,) for row in rows)) if rows else "Түүх байхгүй"

    def save_model(self, request, obj, form, change):
        previous = HostPayout.objects.get(pk=obj.pk)
        previous_status = previous.status
        previous_adjustment = previous.adjustment_amount
        tracked_fields = (
            "status",
            "adjustment_amount",
            "hold_reason",
            "notes",
            "bank_name",
            "account_number",
            "account_holder_name",
            "transfer_reference",
            "transfer_proof",
        )
        obj.recalculate()
        if obj.status == HostPayout.STATUS_NOT_PAYABLE:
            obj.net_amount = 0
        if obj.status == HostPayout.STATUS_PAID and previous_status != HostPayout.STATUS_PAID:
            obj.paid_at = timezone.now()
            obj.paid_by = request.user
        super().save_model(request, obj, form, change)
        changed_fields = [
            field
            for field in tracked_fields
            if str(getattr(previous, field)) != str(getattr(obj, field))
        ]
        if changed_fields:
            changed_labels = [
                str(obj._meta.get_field(field).verbose_name) for field in changed_fields
            ]
            write_financial_audit(
                target=obj,
                event="payout_updated_by_staff",
                actor=request.user,
                previous_status=previous_status,
                new_status=obj.status,
                amount=obj.net_amount,
                message=(
                    f"Өөрчилсөн талбар: {', '.join(changed_labels)}. "
                    f"Тохируулгын дүн: ₮{previous_adjustment:,} → ₮{obj.adjustment_amount:,}."
                ),
                metadata={"changed_fields": changed_fields},
            )


class GuestRefundForm(forms.ModelForm):
    class Meta:
        model = GuestRefund
        fields = "__all__"

    def clean(self):
        cleaned_data = super().clean()
        status = cleaned_data.get("status") or self.instance.status
        approved_amount = cleaned_data.get("approved_amount") or 0
        received_amount = cleaned_data.get("received_amount")
        if received_amount is None:
            received_amount = self.instance.received_amount
        if approved_amount > received_amount:
            self.add_error(
                "approved_amount", "Буцаах дүн хүлээн авсан дүнгээс их байж болохгүй."
            )
        if status in {GuestRefund.STATUS_APPROVED, GuestRefund.STATUS_PAID} and approved_amount <= 0:
            self.add_error("approved_amount", "Баталсан буцаалтын дүнг оруулна уу.")
        if status == GuestRefund.STATUS_PAID and not (
            cleaned_data.get("transfer_reference") or ""
        ).strip():
            self.add_error("transfer_reference", "Гүйлгээний дугаарыг заавал оруулна уу.")
        refund_method = cleaned_data.get("refund_method") or self.instance.refund_method
        if status == GuestRefund.STATUS_PAID and refund_method == GuestRefund.METHOD_BANK:
            for field, label in (
                ("recipient_name", "Хүлээн авагчийн нэр"),
                ("bank_name", "Хүлээн авагчийн банк"),
                ("account_number", "Хүлээн авагчийн данс"),
            ):
                if not (cleaned_data.get(field) or "").strip():
                    self.add_error(field, f"{label} дутуу байна.")
        payout = _get_related_or_none(self.instance.booking, "host_payout")
        payout_amount = (
            payout.net_amount
            if payout and payout.status not in {HostPayout.STATUS_NOT_PAYABLE}
            else 0
        )
        if status in {GuestRefund.STATUS_APPROVED, GuestRefund.STATUS_PAID}:
            if payout_amount + approved_amount > received_amount:
                raise forms.ValidationError(
                    "Зочны буцаалт болон түрээслүүлэгчийн төлбөрийн нийлбэр хүлээн авсан дүнгээс их байна."
                )
        return cleaned_data


@admin.register(GuestRefund)
class GuestRefundAdmin(admin.ModelAdmin):
    form = GuestRefundForm
    list_display = (
        "booking_link",
        "guest",
        "reason",
        "status",
        "received_amount_display",
        "suggested_amount_display",
        "approved_amount_display",
        "refunded_at",
    )
    list_filter = ("status", "reason", "legacy_review_required", "created_at")
    search_fields = (
        "booking__id",
        "booking__full_name",
        "booking__phone_number",
        "guest__username",
        "transfer_reference",
    )
    ordering = ("status", "-created_at")
    readonly_fields = (
        "booking",
        "guest",
        "reason",
        "suggested_amount",
        "approved_at",
        "approved_by",
        "refunded_at",
        "refunded_by",
        "legacy_review_required",
        "created_at",
        "updated_at",
        "audit_history",
    )
    fields = (
        "booking",
        "guest",
        "reason",
        "status",
        "received_amount",
        "suggested_amount",
        "approved_amount",
        "decision_notes",
        "refund_method",
        "recipient_name",
        "bank_name",
        "account_number",
        "approved_at",
        "approved_by",
        "transfer_reference",
        "transfer_proof",
        "refunded_at",
        "refunded_by",
        "legacy_review_required",
        "created_at",
        "updated_at",
        "audit_history",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        is_already_paid = bool(
            obj
            and GuestRefund.objects.filter(
                pk=obj.pk, status=GuestRefund.STATUS_PAID
            ).exists()
        )
        if is_already_paid:
            fields.extend(
                [
                    "status",
                    "approved_amount",
                    "received_amount",
                    "decision_notes",
                    "refund_method",
                    "recipient_name",
                    "bank_name",
                    "account_number",
                    "transfer_reference",
                ]
            )
        return tuple(dict.fromkeys(fields))

    @admin.display(description="Захиалга", ordering="booking_id")
    def booking_link(self, obj):
        return format_html(
            '<a href="/admin/stats/bookings/{}/">#{}</a>', obj.booking_id, obj.booking_id
        )

    @admin.display(description="Хүлээн авсан", ordering="received_amount")
    def received_amount_display(self, obj):
        return f"₮{obj.received_amount:,}"

    @admin.display(description="Санал болгосон", ordering="suggested_amount")
    def suggested_amount_display(self, obj):
        return f"₮{obj.suggested_amount:,}"

    @admin.display(description="Баталсан", ordering="approved_amount")
    def approved_amount_display(self, obj):
        return f"₮{obj.approved_amount:,}"

    @admin.display(description="Хяналтын түүх")
    def audit_history(self, obj):
        if not obj:
            return "—"
        rows = []
        for log in obj.audit_logs.select_related("actor").all()[:30]:
            actor = log.actor.username if log.actor else "Систем"
            rows.append(
                f"{timezone.localtime(log.created_at):%Y-%m-%d %H:%M} · {actor} · "
                f"{log.event} · {log.previous_status or '—'} → {log.new_status or '—'} · "
                f"₮{log.amount:,} · {log.message}"
            )
        return format_html_join("", "{}<br>", ((row,) for row in rows)) if rows else "Түүх байхгүй"

    def save_model(self, request, obj, form, change):
        previous = GuestRefund.objects.get(pk=obj.pk)
        previous_status = previous.status
        previous_amount = previous.approved_amount
        tracked_fields = (
            "status",
            "approved_amount",
            "received_amount",
            "decision_notes",
            "refund_method",
            "recipient_name",
            "bank_name",
            "account_number",
            "transfer_reference",
            "transfer_proof",
        )
        now = timezone.now()
        if obj.status in {GuestRefund.STATUS_APPROVED, GuestRefund.STATUS_PAID} and not obj.approved_at:
            obj.approved_at = now
            obj.approved_by = request.user
        if obj.status == GuestRefund.STATUS_PAID and previous_status != GuestRefund.STATUS_PAID:
            obj.refunded_at = now
            obj.refunded_by = request.user
        super().save_model(request, obj, form, change)
        if obj.status == GuestRefund.STATUS_PAID and obj.approved_amount >= obj.received_amount:
            obj.booking.payments.filter(status=Payment.STATUS_PAID).update(
                status=Payment.STATUS_REFUNDED,
                updated_at=now,
            )
        changed_fields = [
            field
            for field in tracked_fields
            if str(getattr(previous, field)) != str(getattr(obj, field))
        ]
        if changed_fields:
            changed_labels = [
                str(obj._meta.get_field(field).verbose_name) for field in changed_fields
            ]
            write_financial_audit(
                target=obj,
                event="refund_updated_by_staff",
                actor=request.user,
                previous_status=previous_status,
                new_status=obj.status,
                amount=obj.approved_amount,
                message=(
                    f"Өөрчилсөн талбар: {', '.join(changed_labels)}. "
                    f"Баталсан дүн: ₮{previous_amount:,} → ₮{obj.approved_amount:,}."
                ),
                metadata={"changed_fields": changed_fields},
            )


@admin.register(FinancialAuditLog)
class FinancialAuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "booking",
        "event",
        "previous_status",
        "new_status",
        "amount",
        "actor",
    )
    list_filter = ("event", "previous_status", "new_status", "created_at")
    search_fields = ("booking__id", "message", "actor__username")
    readonly_fields = (
        "booking",
        "host_payout",
        "guest_refund",
        "actor",
        "event",
        "previous_status",
        "new_status",
        "amount",
        "message",
        "metadata",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PlatformAnalyticsEvent)
class PlatformAnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "event_type", "platform", "path", "app_version")
    list_filter = ("event_type", "platform", "created_at")
    search_fields = ("event_id", "path", "app_version")
    readonly_fields = (
        "event_id",
        "event_type",
        "visitor_hash",
        "session_hash",
        "path",
        "platform",
        "app_version",
        "created_at",
    )
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# ── Listing ───────────────────────────────────────────────────────────────────
@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "host_username", "location_display", "price_per_night", "is_active", "created_at")
    list_filter = ("is_active", "category")
    search_fields = ("title", "host__username", "location_city", "location_district")
    ordering = ("-created_at",)

    def host_username(self, obj):
        return obj.host.username
    host_username.short_description = "Түрээслүүлэгч"

    def location_display(self, obj):
        return ", ".join(filter(None, [obj.location_city, obj.location_district]))
    location_display.short_description = "Байршил"


# ── HostApplication ───────────────────────────────────────────────────────────
@admin.register(HostApplication)
class HostApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "full_name",
        "phone_number",
        "bank_name",
        "status",
        "host_terms_version",
        "host_commission_rate",
        "host_terms_accepted_at",
        "submitted_at",
    )
    list_filter = ("status", "host_terms_version")
    search_fields = ("user__username", "full_name", "phone_number")
    ordering = ("-submitted_at",)
    readonly_fields = (
        "host_terms_accepted_at",
        "host_terms_version",
        "host_commission_rate",
        "host_terms_accepted_ip",
        "host_terms_accepted_user_agent",
        "submitted_at",
    )


# ── SupportRequest ───────────────────────────────────────────────────────────
@admin.register(SupportRequest)
class SupportRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "subject",
        "user",
        "category",
        "status",
        "created_at",
        "responded_at",
    )
    list_filter = ("status", "category", "created_at")
    search_fields = (
        "subject",
        "message",
        "admin_reply",
        "user__username",
        "user__email",
        "user__phone",
    )
    ordering = ("-created_at",)
    readonly_fields = (
        "user",
        "category",
        "subject",
        "message",
        "created_at",
        "updated_at",
        "responded_by",
        "responded_at",
        "user_contact",
    )
    fields = (
        "user",
        "user_contact",
        "category",
        "subject",
        "message",
        "status",
        "admin_reply",
        "responded_by",
        "responded_at",
        "created_at",
        "updated_at",
    )

    @admin.display(description="Холбоо барих мэдээлэл")
    def user_contact(self, obj):
        if not obj or not obj.user_id:
            return "-"
        return f"Цахим шуудан: {obj.user.email or '-'} | Утас: {obj.user.phone or '-'}"

    def save_model(self, request, obj, form, change):
        previous_reply = ""
        if change and obj.pk:
            previous_reply = (
                SupportRequest.objects.filter(pk=obj.pk)
                .values_list("admin_reply", flat=True)
                .first()
                or ""
            )

        reply_changed = bool(obj.admin_reply.strip()) and (
            obj.admin_reply.strip() != previous_reply.strip()
        )
        if reply_changed:
            obj.responded_by = request.user
            obj.responded_at = timezone.now()
            if obj.status != "closed":
                obj.status = "answered"

        super().save_model(request, obj, form, change)

        if not reply_changed:
            return

        Notification.objects.create(
            user=obj.user,
            message=f"Тусламжийн хүсэлт #{obj.id}-д хариу ирлээ: {obj.subject}",
            type="support_reply",
            related_support_request=obj,
        )
        context = {
            "request_id": obj.id,
            "subject": obj.subject,
            "reply": obj.admin_reply,
            "full_name": obj.user.full_name or obj.user.username,
        }

        def email_user_after_commit():
            if not obj.user.email:
                return
            try:
                send_notification_email(
                    obj.user,
                    notif_type="support_request_answered",
                    context=context,
                )
            except Exception:
                import logging

                logging.getLogger(__name__).exception(
                    "Support reply email failed for request %s", obj.id
                )

        transaction.on_commit(email_user_after_commit)


# ── Category ──────────────────────────────────────────────────────────────────
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "icon", "preview_image")

    def preview_image(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="50" />', obj.image.url)
        return "—"
    preview_image.short_description = "Зураг"


# ── Amenity ───────────────────────────────────────────────────────────────────
@admin.register(Amenity)
class AmenityAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "amenity_type",
        "is_common",
        "is_active",
        "sort_order",
        "category_list",
    )
    list_filter = ("amenity_type", "is_common", "is_active", "categories")
    search_fields = ("name", "translation_key")
    filter_horizontal = ("categories",)
    ordering = ("-amenity_type", "sort_order", "name")
    actions = ("activate_options", "deactivate_options")

    @admin.display(description="Ангилал")
    def category_list(self, obj):
        if obj.is_common:
            return "Бүх ангилал"
        return ", ".join(obj.categories.values_list("name", flat=True)) or "Сонгоогүй"

    @admin.action(description="Сонгосныг идэвхтэй болгох")
    def activate_options(self, request, queryset):
        queryset.update(is_active=True)

    @admin.action(description="Сонгосныг идэвхгүй болгох")
    def deactivate_options(self, request, queryset):
        queryset.update(is_active=False)

    def delete_model(self, request, obj):
        if obj.listing_set.exists():
            obj.is_active = False
            obj.save(update_fields=["is_active"])
            self.message_user(
                request,
                "Энэ сонголтыг зар ашиглаж байгаа тул устгалгүй идэвхгүй болголоо.",
            )
            return
        super().delete_model(request, obj)

    def delete_queryset(self, request, queryset):
        deactivated = 0
        deleted = 0
        for option in queryset:
            if option.listing_set.exists():
                option.is_active = False
                option.save(update_fields=["is_active"])
                deactivated += 1
            else:
                option.delete()
                deleted += 1
        self.message_user(
            request,
            f"{deleted} сонголтыг устгаж, ашиглагдаж буй {deactivated} сонголтыг идэвхгүй болголоо.",
        )


# ── Other models ──────────────────────────────────────────────────────────────
admin.site.register(ListingImage)
admin.site.register(Availability)
admin.site.register(Notification)


# ── Custom finance and booking dashboard ─────────────────────────────────────
BOOKING_STATUS_LABELS = {
    "pending_payment": "Төлбөр хүлээж байна",
    "confirmed": "Баталгаажсан",
    "cancelled": "Цуцлагдсан",
    "expired": "Хугацаа дууссан",
    "payment_failed": "Төлбөр амжилтгүй",
}


def _month_start(now, months_ago=0):
    month_index = now.year * 12 + now.month - 1 - months_ago
    year, month_zero_based = divmod(month_index, 12)
    return now.replace(
        year=year,
        month=month_zero_based + 1,
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )


def _remaining_label(eligible_at, now):
    delta = eligible_at - now
    if delta.total_seconds() <= 0:
        return "Хугацаа дууссан"
    hours, remainder = divmod(int(delta.total_seconds()), 3600)
    minutes = remainder // 60
    days, hours = divmod(hours, 24)
    if days:
        return f"{days} өдөр {hours} цаг"
    return f"{hours} цаг {minutes} минут"


def _payout_status_data(payout, now):
    if not payout:
        return "missing", "Бүртгэлгүй", "danger", "—"
    if payout.status == HostPayout.STATUS_PENDING:
        if payout.eligible_at <= now:
            return "ready", "Шилжүүлэхэд бэлэн", "ready", "Хугацаа дууссан"
        return "waiting", "72 цаг хүлээж байна", "waiting", _remaining_label(payout.eligible_at, now)
    labels = {
        HostPayout.STATUS_REVIEW: ("review", "Шалгах шаардлагатай", "review"),
        HostPayout.STATUS_HOLD: ("hold", "Саатуулсан", "hold"),
        HostPayout.STATUS_PAID: ("paid", "Шилжүүлсэн", "paid"),
        HostPayout.STATUS_NOT_PAYABLE: ("not_payable", "Олгохгүй", "neutral"),
    }
    code, label, css_class = labels[payout.status]
    return code, label, css_class, "—"


def _refund_status_data(refund):
    if not refund:
        return "—", "neutral"
    css_classes = {
        GuestRefund.STATUS_REVIEW: "review",
        GuestRefund.STATUS_APPROVED: "ready",
        GuestRefund.STATUS_PAID: "paid",
        GuestRefund.STATUS_NOT_REQUIRED: "neutral",
    }
    return refund.get_status_display(), css_classes[refund.status]


def _get_related_or_none(instance, attribute):
    try:
        return getattr(instance, attribute)
    except (HostPayout.DoesNotExist, GuestRefund.DoesNotExist):
        return None


def _booking_row(booking, now):
    payout = _get_related_or_none(booking, "host_payout")
    refund = _get_related_or_none(booking, "guest_refund")
    payout_code, payout_label, payout_class, remaining = _payout_status_data(payout, now)
    refund_label, refund_class = _refund_status_data(refund)
    try:
        host_application = booking.listing.host.hostapplication
    except HostApplication.DoesNotExist:
        host_application = None
    host_name = (
        (host_application.full_name if host_application else "")
        or booking.listing.host.full_name
        or booking.listing.host.get_full_name()
        or booking.listing.host.username
    )
    location = ", ".join(
        filter(
            None,
            [
                booking.listing.location_city,
                booking.listing.location_district,
                booking.listing.location_khoroo,
            ],
        )
    )
    return {
        "booking": booking,
        "duration": (booking.check_out - booking.check_in).days,
        "location": location or "—",
        "host_name": host_name,
        "received_amount": int(getattr(booking, "received_amount", 0) or 0),
        "payout": payout,
        "payout_code": payout_code,
        "payout_label": payout_label,
        "payout_class": payout_class,
        "remaining": remaining,
        "refund": refund,
        "refund_label": refund_label,
        "refund_class": refund_class,
        "status_label": BOOKING_STATUS_LABELS.get(booking.status, booking.status),
    }


def _sort_url(request, sort_value):
    params = request.GET.copy()
    params["sort"] = sort_value
    params.pop("page", None)
    return f"?{params.urlencode()}"


OVERVIEW_PERIOD_LABELS = {
    "today": "Өнөөдөр",
    "7d": "Сүүлийн 7 хоног",
    "30d": "Сүүлийн 30 хоног",
    "month": "Энэ сар",
    "year": "Энэ жил",
    "all": "Бүх хугацаа",
    "custom": "Сонгосон хугацаа",
}


def _local_midnight(target_date):
    return timezone.make_aware(
        datetime.combine(target_date, time.min),
        timezone=PLATFORM_TIME_ZONE,
    )


def _earliest_activity_date(today):
    candidates = [
        Booking.objects.aggregate(value=Min("created_at"))["value"],
        Payment.objects.aggregate(value=Min("paid_at"))["value"],
        User.objects.aggregate(value=Min("date_joined"))["value"],
        PlatformAnalyticsEvent.objects.aggregate(value=Min("created_at"))["value"],
    ]
    dates = [
        timezone.localtime(value, PLATFORM_TIME_ZONE).date()
        for value in candidates
        if value is not None
    ]
    return min(dates) if dates else today


def _overview_range(request, now):
    today = timezone.localtime(now, PLATFORM_TIME_ZONE).date()
    period = request.GET.get("overview_period", "30d")
    if period not in OVERVIEW_PERIOD_LABELS:
        period = "30d"

    if period == "today":
        start_date = today
    elif period == "7d":
        start_date = today - timedelta(days=6)
    elif period == "month":
        start_date = today.replace(day=1)
    elif period == "year":
        start_date = today.replace(month=1, day=1)
    elif period == "all":
        start_date = _earliest_activity_date(today)
    elif period == "custom":
        start_date = parse_date(request.GET.get("overview_from", ""))
        if not start_date:
            period = "30d"
            start_date = today - timedelta(days=29)
    else:
        start_date = today - timedelta(days=29)

    if period == "custom":
        end_date = parse_date(request.GET.get("overview_to", "")) or today
    else:
        end_date = today
    if start_date > end_date:
        start_date, end_date = end_date, start_date

    group_by = request.GET.get("group_by", "")
    if group_by not in {"day", "month"}:
        group_by = "day" if (end_date - start_date).days <= 62 else "month"
    order = request.GET.get("overview_order", "desc")
    if order not in {"asc", "desc"}:
        order = "desc"

    return {
        "period": period,
        "label": OVERVIEW_PERIOD_LABELS[period],
        "start_date": start_date,
        "end_date": end_date,
        "start_at": _local_midnight(start_date),
        "end_at": _local_midnight(end_date + timedelta(days=1)),
        "group_by": group_by,
        "order": order,
    }


def _bucket_date(value):
    return value.date() if isinstance(value, datetime) else value


def _next_month(target_date):
    if target_date.month == 12:
        return target_date.replace(year=target_date.year + 1, month=1, day=1)
    return target_date.replace(month=target_date.month + 1, day=1)


def _overview_trend(overview, payment_base):
    start_at = overview["start_at"]
    end_at = overview["end_at"]
    group_by = overview["group_by"]
    trunc = TruncDate if group_by == "day" else TruncMonth

    payment_rows = {
        _bucket_date(row["bucket"]): row
        for row in payment_base.filter(paid_at__gte=start_at, paid_at__lt=end_at)
        .annotate(bucket=trunc("paid_at", tzinfo=PLATFORM_TIME_ZONE))
        .values("bucket")
        .annotate(
            paid_bookings=Count("booking_id", distinct=True),
            gross=Sum("amount"),
            qpay_fees=Sum("provider_fee_amount"),
        )
    }
    booking_rows = {
        _bucket_date(row["bucket"]): row
        for row in Booking.objects.filter(created_at__gte=start_at, created_at__lt=end_at)
        .annotate(bucket=trunc("created_at", tzinfo=PLATFORM_TIME_ZONE))
        .values("bucket")
        .annotate(
            bookings=Count("id"),
            confirmed=Count("id", filter=Q(status="confirmed")),
            cancelled=Count("id", filter=Q(status="cancelled")),
        )
    }
    user_rows = {
        _bucket_date(row["bucket"]): row
        for row in User.objects.filter(date_joined__gte=start_at, date_joined__lt=end_at)
        .annotate(bucket=trunc("date_joined", tzinfo=PLATFORM_TIME_ZONE))
        .values("bucket")
        .annotate(new_users=Count("id"))
    }
    event_rows = {
        _bucket_date(row["bucket"]): row
        for row in PlatformAnalyticsEvent.objects.filter(
            created_at__gte=start_at, created_at__lt=end_at
        )
        .annotate(bucket=trunc("created_at", tzinfo=PLATFORM_TIME_ZONE))
        .values("bucket")
        .annotate(
            page_views=Count(
                "id", filter=Q(event_type=PlatformAnalyticsEvent.EVENT_WEB_PAGE_VIEW)
            ),
            unique_visitors=Count(
                "visitor_hash",
                filter=Q(event_type=PlatformAnalyticsEvent.EVENT_WEB_PAGE_VIEW),
                distinct=True,
            ),
            app_installs=Count(
                "id", filter=Q(event_type=PlatformAnalyticsEvent.EVENT_APP_INSTALL)
            ),
            app_opens=Count(
                "id", filter=Q(event_type=PlatformAnalyticsEvent.EVENT_APP_OPEN)
            ),
        )
    }

    cursor = overview["start_date"]
    if group_by == "month":
        cursor = cursor.replace(day=1)
        final = overview["end_date"].replace(day=1)
    else:
        final = overview["end_date"]

    rows = []
    while cursor <= final:
        payment = payment_rows.get(cursor, {})
        booking = booking_rows.get(cursor, {})
        users = user_rows.get(cursor, {})
        events = event_rows.get(cursor, {})
        gross = int(payment.get("gross") or 0)
        qpay_fees = int(payment.get("qpay_fees") or 0)
        rows.append(
            {
                "label": cursor.strftime("%Y/%m" if group_by == "month" else "%Y-%m-%d"),
                "paid_bookings": payment.get("paid_bookings", 0),
                "gross": gross,
                "qpay_fees": qpay_fees,
                "net_received": gross - qpay_fees,
                "bookings": booking.get("bookings", 0),
                "confirmed": booking.get("confirmed", 0),
                "cancelled": booking.get("cancelled", 0),
                "new_users": users.get("new_users", 0),
                "page_views": events.get("page_views", 0),
                "unique_visitors": events.get("unique_visitors", 0),
                "app_installs": events.get("app_installs", 0),
                "app_opens": events.get("app_opens", 0),
            }
        )
        cursor = _next_month(cursor) if group_by == "month" else cursor + timedelta(days=1)

    if overview["order"] == "desc":
        rows.reverse()
    return rows


def stats_view(request):
    now = timezone.now()
    this_month_start = _month_start(now)
    paid_payment_statuses = [Payment.STATUS_PAID, Payment.STATUS_REFUNDED]
    overview = _overview_range(request, now)

    payment_base = Payment.objects.filter(status__in=paid_payment_statuses)
    total_received = int(payment_base.aggregate(total=Sum("amount"))["total"] or 0)
    qpay_fees = int(
        payment_base.aggregate(total=Sum("provider_fee_amount"))["total"] or 0
    )
    net_received = total_received - qpay_fees
    period_payments = payment_base.filter(
        paid_at__gte=overview["start_at"], paid_at__lt=overview["end_at"]
    )
    period_total_received = int(
        period_payments.aggregate(total=Sum("amount"))["total"] or 0
    )
    period_qpay_fees = int(
        period_payments.aggregate(total=Sum("provider_fee_amount"))["total"] or 0
    )
    period_net_received = period_total_received - period_qpay_fees

    period_bookings = Booking.objects.filter(
        created_at__gte=overview["start_at"], created_at__lt=overview["end_at"]
    )
    period_users = User.objects.filter(
        date_joined__gte=overview["start_at"], date_joined__lt=overview["end_at"]
    )
    period_events = PlatformAnalyticsEvent.objects.filter(
        created_at__gte=overview["start_at"], created_at__lt=overview["end_at"]
    )
    period_paid_confirmed_bookings = Booking.objects.filter(
        status="confirmed", payments__in=period_payments
    ).distinct()
    period_guest_fees = int(
        period_paid_confirmed_bookings.aggregate(total=Sum("service_fee"))["total"] or 0
    )
    period_host_commissions = int(
        HostPayout.objects.filter(
            booking__in=period_paid_confirmed_bookings,
        )
        .exclude(status=HostPayout.STATUS_NOT_PAYABLE)
        .aggregate(total=Sum("commission_amount"))["total"]
        or 0
    )
    period_estimated_platform_income = (
        period_guest_fees + period_host_commissions - period_qpay_fees
    )
    overview_rows = _overview_trend(overview, payment_base)
    paid_to_hosts = int(
        HostPayout.objects.filter(status=HostPayout.STATUS_PAID).aggregate(total=Sum("net_amount"))[
            "total"
        ]
        or 0
    )
    refunded_to_guests = int(
        GuestRefund.objects.filter(status=GuestRefund.STATUS_PAID).aggregate(
            total=Sum("approved_amount")
        )["total"]
        or 0
    )
    book_cash_balance = net_received - paid_to_hosts - refunded_to_guests

    ready_payouts = HostPayout.objects.filter(
        status=HostPayout.STATUS_PENDING, eligible_at__lte=now
    )
    waiting_payouts = HostPayout.objects.filter(
        status=HostPayout.STATUS_PENDING, eligible_at__gt=now
    )
    review_payouts = HostPayout.objects.filter(status=HostPayout.STATUS_REVIEW)
    held_payouts = HostPayout.objects.filter(status=HostPayout.STATUS_HOLD)
    approved_refunds = GuestRefund.objects.filter(status=GuestRefund.STATUS_APPROVED)
    review_refunds = GuestRefund.objects.filter(status=GuestRefund.STATUS_REVIEW)

    payout_queue = list(
        HostPayout.objects.filter(
            status__in=[
                HostPayout.STATUS_PENDING,
                HostPayout.STATUS_REVIEW,
                HostPayout.STATUS_HOLD,
            ]
        )
        .select_related("booking__listing", "host")
        .order_by("eligible_at", "id")[:100]
    )
    payout_priority = {
        "ready": 0,
        HostPayout.STATUS_REVIEW: 1,
        HostPayout.STATUS_HOLD: 2,
        "waiting": 3,
    }
    payout_rows = []
    for payout in payout_queue:
        code, label, css_class, remaining = _payout_status_data(payout, now)
        payout_rows.append(
            {
                "payout": payout,
                "code": code,
                "label": label,
                "class": css_class,
                "remaining": remaining,
            }
        )
    payout_rows.sort(key=lambda row: (payout_priority.get(row["code"], 9), row["payout"].eligible_at))

    refund_rows = list(
        GuestRefund.objects.filter(
            status__in=[GuestRefund.STATUS_REVIEW, GuestRefund.STATUS_APPROVED]
        )
        .select_related("booking__listing", "guest")
        .order_by("status", "created_at")[:100]
    )

    bookings = (
        Booking.objects.select_related(
            "guest",
            "listing__host",
            "listing__host__hostapplication",
            "host_payout",
            "guest_refund",
        )
        .annotate(
            stay_duration=ExpressionWrapper(
                F("check_out") - F("check_in"), output_field=DurationField()
            ),
            received_amount=Coalesce(
                Sum(
                    "payments__amount",
                    filter=Q(payments__status__in=paid_payment_statuses),
                ),
                Value(0),
                output_field=BigIntegerField(),
            ),
        )
    )

    query = request.GET.get("q", "").strip()
    if query:
        search_filter = (
            Q(full_name__icontains=query)
            | Q(phone_number__icontains=query)
            | Q(guest__username__icontains=query)
            | Q(guest__email__icontains=query)
            | Q(listing__title__icontains=query)
            | Q(listing__host__username__icontains=query)
            | Q(listing__host__full_name__icontains=query)
            | Q(listing__host__hostapplication__full_name__icontains=query)
            | Q(listing__location_city__icontains=query)
            | Q(listing__location_district__icontains=query)
            | Q(listing__location_khoroo__icontains=query)
            | Q(listing__location_extra__icontains=query)
            | Q(listing__location_building__icontains=query)
            | Q(listing__location_apartment__icontains=query)
        )
        if query.isdigit():
            search_filter |= Q(id=int(query))
        bookings = bookings.filter(search_filter)

    status_filter = request.GET.get("status", "")
    if status_filter:
        bookings = bookings.filter(status=status_filter)

    finance_filter = request.GET.get("finance", "")
    if finance_filter == "ready":
        bookings = bookings.filter(
            host_payout__status=HostPayout.STATUS_PENDING,
            host_payout__eligible_at__lte=now,
        )
    elif finance_filter == "waiting":
        bookings = bookings.filter(
            host_payout__status=HostPayout.STATUS_PENDING,
            host_payout__eligible_at__gt=now,
        )
    elif finance_filter in {HostPayout.STATUS_REVIEW, HostPayout.STATUS_HOLD, HostPayout.STATUS_PAID}:
        bookings = bookings.filter(host_payout__status=finance_filter)
    elif finance_filter == "refund":
        bookings = bookings.filter(
            guest_refund__status__in=[GuestRefund.STATUS_REVIEW, GuestRefund.STATUS_APPROVED]
        )
    elif finance_filter == "missing":
        bookings = bookings.filter(host_payout__isnull=True, status="confirmed")

    date_from = request.GET.get("date_from", "")
    date_to = request.GET.get("date_to", "")
    parsed_date_from = parse_date(date_from) if date_from else None
    parsed_date_to = parse_date(date_to) if date_to else None
    if parsed_date_from:
        bookings = bookings.filter(check_in__gte=parsed_date_from)
    if parsed_date_to:
        bookings = bookings.filter(check_out__lte=parsed_date_to)

    sort_value = request.GET.get("sort", "created_desc")
    sort_fields = {
        "created_desc": ("-created_at", "-id"),
        "created_asc": ("created_at", "id"),
        "check_in_asc": ("check_in", "id"),
        "check_in_desc": ("-check_in", "-id"),
        "check_out_asc": ("check_out", "id"),
        "check_out_desc": ("-check_out", "-id"),
        "duration_asc": ("stay_duration", "id"),
        "duration_desc": ("-stay_duration", "-id"),
        "guest_asc": ("full_name", "id"),
        "guest_desc": ("-full_name", "-id"),
        "host_asc": ("listing__host__username", "id"),
        "host_desc": ("-listing__host__username", "-id"),
        "listing_asc": ("listing__title", "id"),
        "listing_desc": ("-listing__title", "-id"),
        "location_asc": (
            "listing__location_city",
            "listing__location_district",
            "listing__location_khoroo",
            "id",
        ),
        "location_desc": (
            "-listing__location_city",
            "-listing__location_district",
            "-listing__location_khoroo",
            "-id",
        ),
        "amount_asc": ("received_amount", "id"),
        "amount_desc": ("-received_amount", "-id"),
    }
    bookings = bookings.order_by(*sort_fields.get(sort_value, sort_fields["created_desc"]))
    paginator = Paginator(bookings, 50)
    booking_page = paginator.get_page(request.GET.get("page"))
    booking_rows = [_booking_row(booking, now) for booking in booking_page.object_list]
    page_params = request.GET.copy()
    page_params.pop("page", None)

    monthly_data = []
    for months_ago in range(5, -1, -1):
        start = _month_start(now, months_ago)
        end = _month_start(now, months_ago - 1) if months_ago else now
        received = int(
            payment_base.filter(paid_at__gte=start, paid_at__lt=end).aggregate(total=Sum("amount"))[
                "total"
            ]
            or 0
        )
        provider_fees = int(
            payment_base.filter(paid_at__gte=start, paid_at__lt=end).aggregate(
                total=Sum("provider_fee_amount")
            )["total"]
            or 0
        )
        host_out = int(
            HostPayout.objects.filter(
                status=HostPayout.STATUS_PAID, paid_at__gte=start, paid_at__lt=end
            ).aggregate(total=Sum("net_amount"))["total"]
            or 0
        )
        refund_out = int(
            GuestRefund.objects.filter(
                status=GuestRefund.STATUS_PAID,
                refunded_at__gte=start,
                refunded_at__lt=end,
            ).aggregate(total=Sum("approved_amount"))["total"]
            or 0
        )
        monthly_data.append(
            {
                "month": timezone.localtime(start).strftime("%Y/%m"),
                "booking_count": payment_base.filter(
                    paid_at__gte=start, paid_at__lt=end
                )
                .values("booking_id")
                .distinct()
                .count(),
                "received": received,
                "provider_fees": provider_fees,
                "net_received": received - provider_fees,
                "host_out": host_out,
                "refund_out": refund_out,
                "net_flow": received - provider_fees - host_out - refund_out,
            }
        )

    total_users = User.objects.count()
    total_hosts = User.objects.filter(is_host=True).count()
    all_page_views = PlatformAnalyticsEvent.objects.filter(
        event_type=PlatformAnalyticsEvent.EVENT_WEB_PAGE_VIEW
    )
    context = {
        **admin.site.each_context(request),
        "title": "Ерөнхий хяналтын самбар",
        "total_received": total_received,
        "qpay_fees": qpay_fees,
        "net_received": net_received,
        "overview": overview,
        "overview_rows": overview_rows,
        "period_total_received": period_total_received,
        "period_qpay_fees": period_qpay_fees,
        "period_net_received": period_net_received,
        "period_estimated_platform_income": period_estimated_platform_income,
        "period_booking_count": period_bookings.count(),
        "period_confirmed_count": period_bookings.filter(status="confirmed").count(),
        "period_cancelled_count": period_bookings.filter(status="cancelled").count(),
        "period_new_users": period_users.count(),
        "period_page_views": period_events.filter(
            event_type=PlatformAnalyticsEvent.EVENT_WEB_PAGE_VIEW
        ).count(),
        "period_unique_visitors": period_events.filter(
            event_type=PlatformAnalyticsEvent.EVENT_WEB_PAGE_VIEW
        )
        .values("visitor_hash")
        .distinct()
        .count(),
        "period_app_installs": period_events.filter(
            event_type=PlatformAnalyticsEvent.EVENT_APP_INSTALL
        ).count(),
        "period_app_opens": period_events.filter(
            event_type=PlatformAnalyticsEvent.EVENT_APP_OPEN
        ).count(),
        "analytics_data_available": PlatformAnalyticsEvent.objects.exists(),
        "all_page_views": all_page_views.count(),
        "all_unique_visitors": all_page_views.values("visitor_hash").distinct().count(),
        "all_app_installs": PlatformAnalyticsEvent.objects.filter(
            event_type=PlatformAnalyticsEvent.EVENT_APP_INSTALL
        ).count(),
        "all_app_opens": PlatformAnalyticsEvent.objects.filter(
            event_type=PlatformAnalyticsEvent.EVENT_APP_OPEN
        ).count(),
        "total_listings": Listing.objects.count(),
        "active_listings": Listing.objects.filter(is_active=True).count(),
        "paid_to_hosts": paid_to_hosts,
        "refunded_to_guests": refunded_to_guests,
        "book_cash_balance": book_cash_balance,
        "ready_count": ready_payouts.count(),
        "ready_amount": int(ready_payouts.aggregate(total=Sum("net_amount"))["total"] or 0),
        "waiting_count": waiting_payouts.count(),
        "waiting_amount": int(waiting_payouts.aggregate(total=Sum("net_amount"))["total"] or 0),
        "review_payout_count": review_payouts.count(),
        "held_payout_count": held_payouts.count(),
        "approved_refund_count": approved_refunds.count(),
        "approved_refund_amount": int(
            approved_refunds.aggregate(total=Sum("approved_amount"))["total"] or 0
        ),
        "review_refund_count": review_refunds.count(),
        "missing_accounting_count": Booking.objects.filter(
            status="confirmed", host_payout__isnull=True
        ).count(),
        "month_received": int(
            payment_base.filter(paid_at__gte=this_month_start).aggregate(total=Sum("amount"))[
                "total"
            ]
            or 0
        ),
        "month_qpay_fees": int(
            payment_base.filter(paid_at__gte=this_month_start).aggregate(
                total=Sum("provider_fee_amount")
            )["total"]
            or 0
        ),
        "total_users": total_users,
        "total_hosts": total_hosts,
        "total_guests": total_users - total_hosts,
        "new_users_month": User.objects.filter(date_joined__gte=this_month_start).count(),
        "pending_applications": HostApplication.objects.filter(status="pending").count(),
        "total_bookings": Booking.objects.count(),
        "active_bookings": Booking.objects.filter(status="confirmed").count(),
        "cancelled_bookings": Booking.objects.filter(status="cancelled").count(),
        "payout_rows": payout_rows,
        "refund_rows": refund_rows,
        "booking_page": booking_page,
        "booking_rows": booking_rows,
        "page_query": page_params.urlencode(),
        "q": query,
        "status_filter": status_filter,
        "finance_filter": finance_filter,
        "date_from": date_from,
        "date_to": date_to,
        "sort_value": sort_value,
        "sort_urls": {
            key: _sort_url(request, key)
            for key in sort_fields
        },
        "monthly_data": monthly_data,
    }
    return render(request, "admin/stats.html", context)


def booking_finance_detail_view(request, booking_id):
    booking = get_object_or_404(
        Booking.objects.select_related("guest", "listing__host").prefetch_related("payments"),
        pk=booking_id,
    )
    payout = _get_related_or_none(booking, "host_payout")
    refund = _get_related_or_none(booking, "guest_refund")
    now = timezone.now()
    payout_code, payout_label, payout_class, remaining = _payout_status_data(payout, now)
    refund_label, refund_class = _refund_status_data(refund)
    audit_logs = booking.financial_audit_logs.select_related("actor").all()
    host_application = HostApplication.objects.filter(user=booking.listing.host).first()
    full_location = ", ".join(
        filter(
            None,
            [
                booking.listing.location_city,
                booking.listing.location_district,
                booking.listing.location_khoroo,
                booking.listing.location_extra,
                booking.listing.location_building,
                booking.listing.location_apartment,
            ],
        )
    )
    context = {
        **admin.site.each_context(request),
        "title": f"Захиалга #{booking.id}",
        "booking": booking,
        "status_label": BOOKING_STATUS_LABELS.get(booking.status, booking.status),
        "duration": (booking.check_out - booking.check_in).days,
        "booking_total": int(booking.total_price) + int(booking.service_fee),
        "check_in_at": check_in_at(booking.check_in),
        "check_out_at": check_out_at(booking.check_out),
        "payout_eligible_at": payout_eligible_at(booking.check_out),
        "full_location": full_location or "—",
        "host_display_name": (host_application.full_name if host_application else "")
        or booking.listing.host.get_full_name()
        or booking.listing.host.username,
        "host_application": host_application,
        "payout": payout,
        "payout_code": payout_code,
        "payout_label": payout_label,
        "payout_class": payout_class,
        "remaining": remaining,
        "refund": refund,
        "refund_label": refund_label,
        "refund_class": refund_class,
        "payments": booking.payments.order_by("-created_at"),
        "audit_logs": audit_logs,
        "cancellation_at": booking.host_cancelled_at or booking.guest_cancelled_at,
        "cancellation_reason": booking.host_cancellation_reason
        or booking.guest_cancellation_reason,
        "cancellation_policy_version": booking.host_cancellation_policy_version
        or booking.guest_cancellation_policy_version,
    }
    return render(request, "admin/booking_finance_detail.html", context)
