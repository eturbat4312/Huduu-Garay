from datetime import datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from django.db import migrations
from django.db.models import Q
from django.utils import timezone


PLATFORM_TIME_ZONE = ZoneInfo("Asia/Ulaanbaatar")


def backfill_financial_ledgers(apps, schema_editor):
    Booking = apps.get_model("core", "Booking")
    Payment = apps.get_model("core", "Payment")
    HostApplication = apps.get_model("core", "HostApplication")
    HostPayout = apps.get_model("core", "HostPayout")
    GuestRefund = apps.get_model("core", "GuestRefund")
    FinancialAuditLog = apps.get_model("core", "FinancialAuditLog")

    bookings = Booking.objects.filter(
        Q(status="confirmed")
        | Q(status="cancelled")
        | Q(is_cancelled_by_host=True)
        | Q(guest_cancelled_at__isnull=False)
        | Q(host_cancelled_at__isnull=False)
    ).select_related("listing__host", "guest")

    for booking in bookings.iterator():
        application = HostApplication.objects.filter(user_id=booking.listing.host_id).first()
        host_user = booking.listing.host
        fallback_holder_name = (
            host_user.full_name
            or f"{host_user.first_name} {host_user.last_name}".strip()
            or host_user.username
        )
        rate = application.host_commission_rate if application else Decimal("10.00")
        gross_amount = int(booking.total_price)
        commission_amount = int(
            (Decimal(gross_amount) * Decimal(rate) / Decimal("100")).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
        checkout_at = timezone.make_aware(
            datetime.combine(booking.check_out, time(hour=12)),
            timezone=PLATFORM_TIME_ZONE,
        )
        host_cancelled = bool(booking.is_cancelled_by_host or booking.host_cancelled_at)
        payout, payout_created = HostPayout.objects.get_or_create(
            booking_id=booking.id,
            defaults={
                "host_id": booking.listing.host_id,
                "status": "review",
                "gross_amount": gross_amount,
                "commission_rate": rate,
                "commission_amount": commission_amount,
                "adjustment_amount": 0,
                "net_amount": 0 if host_cancelled else max(gross_amount - commission_amount, 0),
                "eligible_at": checkout_at + timedelta(hours=72),
                "bank_name": application.bank_name if application else "",
                "account_number": application.account_number if application else "",
                "account_holder_name": (
                    application.full_name
                    if application
                    else fallback_holder_name
                ),
                "notes": "Хуучин захиалгын шилжүүлэг хийгдсэн эсэхийг баримтаар шалгана уу.",
                "legacy_review_required": True,
            },
        )
        if payout_created:
            FinancialAuditLog.objects.create(
                booking_id=booking.id,
                host_payout_id=payout.id,
                event="legacy_payout_created",
                new_status="review",
                amount=payout.net_amount,
                message="Хуучин захиалгыг шалгах төлөвөөр санхүүгийн бүртгэлд оруулав.",
            )

        if not (booking.guest_cancelled_at or host_cancelled):
            continue

        payment = (
            Payment.objects.filter(booking_id=booking.id, status__in=["paid", "refunded"])
            .order_by("-paid_at", "-id")
            .first()
        )
        received_amount = int(payment.amount) if payment else 0
        reason = "host_cancelled" if host_cancelled else "guest_cancelled"
        suggested_amount = received_amount if host_cancelled else 0
        if booking.guest_cancelled_at:
            checkin_at = timezone.make_aware(
                datetime.combine(booking.check_in, time(hour=14)),
                timezone=PLATFORM_TIME_ZONE,
            )
            if booking.guest_cancelled_at <= checkin_at - timedelta(hours=48):
                suggested_amount = received_amount

        refund, refund_created = GuestRefund.objects.get_or_create(
            booking_id=booking.id,
            defaults={
                "guest_id": booking.guest_id,
                "reason": reason,
                "status": "review",
                "received_amount": received_amount,
                "suggested_amount": suggested_amount,
                "approved_amount": 0,
                "decision_notes": "Хуучин цуцлалтыг баримтаар шалгаж шийдвэрлэнэ.",
                "legacy_review_required": True,
            },
        )
        if refund_created:
            FinancialAuditLog.objects.create(
                booking_id=booking.id,
                guest_refund_id=refund.id,
                event="legacy_refund_created",
                new_status="review",
                amount=refund.suggested_amount,
                message="Хуучин цуцлалтыг шалгах төлөвөөр буцаалтын бүртгэлд оруулав.",
            )


class Migration(migrations.Migration):
    dependencies = [("core", "0044_guestrefund_hostpayout_financialauditlog_and_more")]

    operations = [migrations.RunPython(backfill_financial_ledgers, migrations.RunPython.noop)]
