from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

from core.models import (
    FinancialAuditLog,
    GuestRefund,
    HostApplication,
    HostPayout,
    Payment,
)
from core.services.booking_times import check_in_at, payout_eligible_at


def calculate_commission(gross_amount, commission_rate):
    return int(
        (Decimal(gross_amount) * Decimal(commission_rate) / Decimal("100")).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    )


def payment_received_amount(booking):
    payment = (
        booking.payments.filter(
            status__in=[Payment.STATUS_PAID, Payment.STATUS_REFUNDED]
        )
        .order_by("-paid_at", "-id")
        .first()
    )
    if payment:
        return int(payment.amount)
    return 0


def write_financial_audit(
    *,
    target,
    event,
    actor=None,
    previous_status="",
    new_status="",
    amount=0,
    message="",
    metadata=None,
):
    values = {
        "booking": target.booking,
        "actor": actor,
        "event": event,
        "previous_status": previous_status,
        "new_status": new_status,
        "amount": amount,
        "message": message,
        "metadata": metadata or {},
    }
    if isinstance(target, HostPayout):
        values["host_payout"] = target
    else:
        values["guest_refund"] = target
    return FinancialAuditLog.objects.create(**values)


def _host_payment_snapshot(booking):
    try:
        application = HostApplication.objects.get(user=booking.listing.host)
    except HostApplication.DoesNotExist:
        return Decimal("10.00"), "", "", booking.listing.host.get_full_name()

    return (
        application.host_commission_rate,
        application.bank_name,
        application.account_number,
        application.full_name,
    )


@transaction.atomic
def ensure_host_payout(booking, *, legacy_review=False):
    try:
        return HostPayout.objects.select_for_update().get(booking=booking), False
    except HostPayout.DoesNotExist:
        pass

    rate, bank_name, account_number, account_holder_name = _host_payment_snapshot(booking)
    gross_amount = int(booking.total_price)
    commission_amount = calculate_commission(gross_amount, rate)
    status = HostPayout.STATUS_REVIEW if legacy_review else HostPayout.STATUS_PENDING
    net_amount = max(gross_amount - commission_amount, 0)

    if booking.is_cancelled_by_host or booking.host_cancelled_at:
        status = HostPayout.STATUS_REVIEW if legacy_review else HostPayout.STATUS_NOT_PAYABLE
        net_amount = 0
    elif booking.guest_cancelled_at:
        status = HostPayout.STATUS_REVIEW
    elif not bank_name or not account_number or not account_holder_name:
        status = HostPayout.STATUS_REVIEW

    payout = HostPayout.objects.create(
        booking=booking,
        host=booking.listing.host,
        status=status,
        gross_amount=gross_amount,
        commission_rate=rate,
        commission_amount=commission_amount,
        adjustment_amount=0,
        net_amount=net_amount,
        eligible_at=payout_eligible_at(booking.check_out),
        bank_name=bank_name,
        account_number=account_number,
        account_holder_name=account_holder_name,
        legacy_review_required=legacy_review,
        notes=(
            "Хуучин захиалгын шилжүүлэг хийгдсэн эсэхийг баримтаар шалгана уу."
            if legacy_review
            else (
                "Түрээслүүлэгчийн банкны мэдээлэл дутуу тул шалгана уу."
                if not bank_name or not account_number or not account_holder_name
                else ""
            )
        ),
    )
    write_financial_audit(
        target=payout,
        event="payout_created",
        new_status=payout.status,
        amount=payout.net_amount,
        message="Түрээслүүлэгчийн төлбөрийн бүртгэл үүслээ.",
    )
    return payout, True


def _guest_refund_suggestion(booking, received_amount):
    if booking.is_cancelled_by_host or booking.host_cancelled_at:
        return received_amount
    if not booking.guest_cancelled_at:
        return 0
    full_refund_deadline = check_in_at(booking.check_in) - timedelta(hours=48)
    return received_amount if booking.guest_cancelled_at <= full_refund_deadline else 0


@transaction.atomic
def sync_cancellation_settlements(booking, *, legacy_review=False):
    payout, _ = ensure_host_payout(booking, legacy_review=legacy_review)
    payout = HostPayout.objects.select_for_update().get(pk=payout.pk)
    previous_payout_status = payout.status

    if payout.status != HostPayout.STATUS_PAID:
        if booking.is_cancelled_by_host or booking.host_cancelled_at:
            payout.status = (
                HostPayout.STATUS_REVIEW if legacy_review else HostPayout.STATUS_NOT_PAYABLE
            )
            payout.net_amount = 0
            payout.notes = "Түрээслүүлэгч захиалгыг цуцалсан тул төлбөр олгохгүй."
        elif booking.guest_cancelled_at:
            payout.status = HostPayout.STATUS_REVIEW
            payout.notes = (
                "Зочны цуцлалтыг хянаж, түрээслүүлэгчид олгох дүнг гараар шийдвэрлэнэ."
            )
        payout.legacy_review_required = legacy_review or payout.legacy_review_required
        payout.save(
            update_fields=[
                "status",
                "net_amount",
                "notes",
                "legacy_review_required",
                "updated_at",
            ]
        )
        if previous_payout_status != payout.status:
            write_financial_audit(
                target=payout,
                event="cancellation_updated_payout",
                previous_status=previous_payout_status,
                new_status=payout.status,
                amount=payout.net_amount,
                message="Цуцлалтын дагуу түрээслүүлэгчийн төлбөр шинэчлэгдлээ.",
            )
    else:
        write_financial_audit(
            target=payout,
            event="cancelled_after_payout",
            previous_status=payout.status,
            new_status=payout.status,
            amount=payout.net_amount,
            message="Шилжүүлэг хийгдсэний дараа захиалга цуцлагдсан тул гараар шалгана уу.",
        )

    received_amount = payment_received_amount(booking)
    reason = (
        GuestRefund.REASON_HOST_CANCELLED
        if booking.is_cancelled_by_host or booking.host_cancelled_at
        else GuestRefund.REASON_GUEST_CANCELLED
    )
    suggested_amount = _guest_refund_suggestion(booking, received_amount)
    automatic_approval = (
        reason == GuestRefund.REASON_HOST_CANCELLED
        and received_amount > 0
        and not legacy_review
    )
    defaults = {
        "guest": booking.guest,
        "reason": reason,
        "status": GuestRefund.STATUS_APPROVED if automatic_approval else GuestRefund.STATUS_REVIEW,
        "received_amount": received_amount,
        "suggested_amount": suggested_amount,
        "approved_amount": suggested_amount if automatic_approval else 0,
        "approved_at": timezone.now() if automatic_approval else None,
        "decision_notes": (
            "Түрээслүүлэгч цуцалсан тул дүрмийн дагуу 100% буцаалт."
            if automatic_approval
            else "Гараар хянаж шийдвэрлэнэ."
        ),
        "legacy_review_required": legacy_review,
    }
    refund, created = GuestRefund.objects.get_or_create(booking=booking, defaults=defaults)
    if created:
        write_financial_audit(
            target=refund,
            event="refund_created",
            new_status=refund.status,
            amount=refund.suggested_amount,
            message="Зочны буцаалтын бүртгэл үүслээ.",
        )
    return payout, refund
