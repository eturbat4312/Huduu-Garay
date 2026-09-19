from django.contrib import admin
from django.db.models import Q, Sum
from django.utils.html import format_html
from django.shortcuts import render
from django.utils import timezone
from datetime import timedelta
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
)
from django.contrib.auth import get_user_model

User = get_user_model()


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
        "amount", "currency", "status", "paid_at", "created_at",
    )
    list_filter = ("provider", "status", "currency", "created_at")
    search_fields = ("sender_invoice_no", "invoice_id", "booking__id", "booking__full_name")
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "updated_at")


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


# ── Custom stats dashboard ────────────────────────────────────────────────────
def stats_view(request):
    now = timezone.now()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    bookings = Booking.objects.all()
    active = bookings.filter(is_cancelled_by_host=False, status="confirmed")

    total_revenue = active.aggregate(s=Sum("total_price"))["s"] or 0
    total_guest_fees = active.aggregate(s=Sum("service_fee"))["s"] or 0
    total_host_fees = int(total_revenue * 0.10)
    platform_total = total_guest_fees + total_host_fees

    month_bookings = active.filter(created_at__gte=this_month_start)
    month_revenue = month_bookings.aggregate(s=Sum("total_price"))["s"] or 0
    month_guest_fees = month_bookings.aggregate(s=Sum("service_fee"))["s"] or 0
    month_host_fees = int(month_revenue * 0.10)
    month_platform = month_guest_fees + month_host_fees

    total_users = User.objects.count()
    total_hosts = User.objects.filter(is_host=True).count()
    new_users_month = User.objects.filter(date_joined__gte=this_month_start).count()
    pending_applications = HostApplication.objects.filter(status="pending").count()

    total_bookings = bookings.count()
    active_bookings = active.count()
    cancelled_bookings = bookings.filter(Q(is_cancelled_by_host=True) | Q(status="cancelled")).count()
    month_booking_count = month_bookings.count()

    monthly_data = []
    for i in range(5, -1, -1):
        d = now - timedelta(days=30 * i)
        start = d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i == 0:
            end = now
        else:
            end = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        count = active.filter(created_at__gte=start, created_at__lt=end).count()
        revenue = active.filter(created_at__gte=start, created_at__lt=end).aggregate(s=Sum("total_price"))["s"] or 0
        monthly_data.append({
            "month": start.strftime("%Y/%m"),
            "count": count,
            "revenue": revenue,
            "platform": int(revenue * 0.20),
        })

    context = {
        **admin.site.each_context(request),
        "title": "Статистик тайлан",
        "total_revenue": total_revenue,
        "total_guest_fees": total_guest_fees,
        "total_host_fees": total_host_fees,
        "platform_total": platform_total,
        "month_revenue": month_revenue,
        "month_guest_fees": month_guest_fees,
        "month_host_fees": month_host_fees,
        "month_platform": month_platform,
        "total_users": total_users,
        "total_hosts": total_hosts,
        "total_guests": total_users - total_hosts,
        "new_users_month": new_users_month,
        "pending_applications": pending_applications,
        "total_bookings": total_bookings,
        "active_bookings": active_bookings,
        "cancelled_bookings": cancelled_bookings,
        "month_booking_count": month_booking_count,
        "monthly_data": monthly_data,
    }
    return render(request, "admin/stats.html", context)
