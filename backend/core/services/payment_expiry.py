import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from core.models import Availability, Booking, BookingHold, Payment
from core.services.qpay import QPayAPIError, QPayClient, QPayConfigurationError


logger = logging.getLogger(__name__)

REASON_HOLD_EXPIRED = "payment_hold_expired"
REASON_GUEST_CANCELLED = "cancelled_by_guest_before_payment"


def _retry_delay(attempt_count):
    return timedelta(seconds=min(5 * (2 ** max(attempt_count - 1, 0)), 300))


def _release_locked_booking_hold(booking):
    holds = list(
        BookingHold.objects.select_for_update().filter(
            booking=booking,
            listing=booking.listing,
        )
    )
    for hold in holds:
        Availability.objects.get_or_create(listing=booking.listing, date=hold.date)
    if holds:
        BookingHold.objects.filter(id__in=[hold.id for hold in holds]).delete()
    return len(holds)


def release_expired_booking_without_invoice(booking_id, now=None):
    """Release a hold only when no live payment invoice exists."""
    closed_at = now or timezone.now()
    with transaction.atomic():
        booking = (
            Booking.objects.select_for_update()
            .select_related("listing")
            .get(id=booking_id)
        )
        if booking.status != Booking.STATUS_PENDING_PAYMENT:
            return False
        if Payment.objects.filter(
            booking=booking,
            status__in=[Payment.STATUS_PENDING, Payment.STATUS_CANCELLATION_PENDING],
        ).exists():
            return False
        _release_locked_booking_hold(booking)
        booking.status = Booking.STATUS_EXPIRED
        booking.save(update_fields=["status"])
        return True


def request_payment_cancellation(payment_id, reason, now=None, attempt_now=True):
    """Freeze the hold, mark the invoice for closing, then cancel provider-first."""
    requested_at = now or timezone.now()
    should_attempt = False
    with transaction.atomic():
        payment = (
            Payment.objects.select_for_update()
            .select_related("booking", "booking__listing")
            .get(id=payment_id)
        )
        if payment.status in {
            Payment.STATUS_PAID,
            Payment.STATUS_CANCELLED,
            Payment.STATUS_EXPIRED,
            Payment.STATUS_FAILED,
            Payment.STATUS_REFUNDED,
        }:
            return payment
        if payment.booking.status == Booking.STATUS_CONFIRMED:
            return payment

        if payment.status == Payment.STATUS_PENDING:
            payment.status = Payment.STATUS_CANCELLATION_PENDING
            payment.cancellation_requested_at = requested_at
            payment.cancellation_reason = reason
            payment.next_cancellation_attempt_at = requested_at
            payment.last_cancellation_error = ""
            payment.raw_response = {
                **(payment.raw_response or {}),
                "cancellation_requested_at": requested_at.isoformat(),
                "cancellation_reason": reason,
            }
            payment.save(
                update_fields=[
                    "status",
                    "cancellation_requested_at",
                    "cancellation_reason",
                    "next_cancellation_attempt_at",
                    "last_cancellation_error",
                    "raw_response",
                    "updated_at",
                ]
            )
            should_attempt = True
        elif (
            payment.status == Payment.STATUS_CANCELLATION_PENDING
            and (
                payment.next_cancellation_attempt_at is None
                or payment.next_cancellation_attempt_at <= requested_at
            )
        ):
            should_attempt = True

    if attempt_now and should_attempt:
        return attempt_payment_cancellation(payment_id)
    return Payment.objects.select_related("booking").get(id=payment_id)


def _finalize_cancelled_payment(payment_id, provider_response, now=None):
    closed_at = now or timezone.now()
    with transaction.atomic():
        payment = (
            Payment.objects.select_for_update()
            .select_related("booking", "booking__listing")
            .get(id=payment_id)
        )
        if payment.status != Payment.STATUS_CANCELLATION_PENDING:
            return payment

        booking = (
            Booking.objects.select_for_update()
            .select_related("listing")
            .get(id=payment.booking_id)
        )
        if booking.status == Booking.STATUS_CONFIRMED:
            return payment

        _release_locked_booking_hold(booking)
        booking.status = Booking.STATUS_EXPIRED
        booking.save(update_fields=["status"])

        payment.status = (
            Payment.STATUS_CANCELLED
            if payment.cancellation_reason == REASON_GUEST_CANCELLED
            else Payment.STATUS_EXPIRED
        )
        payment.next_cancellation_attempt_at = None
        payment.last_cancellation_error = ""
        payment.raw_response = {
            **(payment.raw_response or {}),
            "qpay_invoice_cancelled": True,
            "qpay_invoice_cancel_response": provider_response or {},
            "closed_at": closed_at.isoformat(),
        }
        payment.save(
            update_fields=[
                "status",
                "next_cancellation_attempt_at",
                "last_cancellation_error",
                "raw_response",
                "updated_at",
            ]
        )
        payment.booking = booking
        return payment


def attempt_payment_cancellation(payment_id, now=None):
    """Cancel QPay first. Never release dates on an error or unknown result."""
    attempted_at = now or timezone.now()
    payment = Payment.objects.select_related("booking").get(id=payment_id)
    if payment.status != Payment.STATUS_CANCELLATION_PENDING:
        return payment

    is_local_invoice = (
        not settings.QPAY_ENABLED
        or payment.provider != Payment.PROVIDER_QPAY
        or not payment.invoice_id
        or payment.invoice_id.startswith("mock-")
    )
    if is_local_invoice:
        return _finalize_cancelled_payment(
            payment.id,
            {"mode": "local", "cancelled": True},
            now=attempted_at,
        )

    try:
        provider_response = QPayClient().cancel_invoice(invoice_id=payment.invoice_id)
    except (QPayConfigurationError, QPayAPIError) as exc:
        logger.exception("QPay invoice cancellation failed for payment %s", payment.id)
        with transaction.atomic():
            locked = Payment.objects.select_for_update().get(id=payment.id)
            if locked.status != Payment.STATUS_CANCELLATION_PENDING:
                return locked
            locked.cancellation_attempt_count += 1
            locked.last_cancellation_error = exc.__class__.__name__
            locked.next_cancellation_attempt_at = attempted_at + _retry_delay(
                locked.cancellation_attempt_count
            )
            locked.raw_response = {
                **(locked.raw_response or {}),
                "qpay_invoice_cancelled": False,
                "qpay_invoice_cancel_error": exc.__class__.__name__,
                "last_cancel_attempt_at": attempted_at.isoformat(),
            }
            locked.save(
                update_fields=[
                    "cancellation_attempt_count",
                    "last_cancellation_error",
                    "next_cancellation_attempt_at",
                    "raw_response",
                    "updated_at",
                ]
            )
            return locked

    with transaction.atomic():
        locked = Payment.objects.select_for_update().get(id=payment.id)
        if locked.status != Payment.STATUS_CANCELLATION_PENDING:
            return locked
        locked.cancellation_attempt_count += 1
        locked.save(update_fields=["cancellation_attempt_count", "updated_at"])
    return _finalize_cancelled_payment(
        payment.id,
        provider_response,
        now=attempted_at,
    )


def process_due_payment_cancellations(now=None, limit=100):
    current_time = now or timezone.now()
    expired_booking_ids = list(
        Booking.objects.filter(
            status=Booking.STATUS_PENDING_PAYMENT,
            hold_expires_at__isnull=False,
            hold_expires_at__lte=current_time,
        ).values_list("id", flat=True)[:limit]
    )

    for booking_id in expired_booking_ids:
        payment = (
            Payment.objects.filter(
                booking_id=booking_id,
                status__in=[Payment.STATUS_PENDING, Payment.STATUS_CANCELLATION_PENDING],
            )
            .order_by("-created_at")
            .first()
        )
        if payment is None:
            release_expired_booking_without_invoice(booking_id, now=current_time)
        elif payment.status == Payment.STATUS_PENDING:
            request_payment_cancellation(
                payment.id,
                REASON_HOLD_EXPIRED,
                now=current_time,
                attempt_now=False,
            )

    due_ids = list(
        Payment.objects.filter(
            status=Payment.STATUS_CANCELLATION_PENDING,
            next_cancellation_attempt_at__lte=current_time,
        )
        .order_by("next_cancellation_attempt_at")
        .values_list("id", flat=True)[:limit]
    )
    for payment_id in due_ids:
        attempt_payment_cancellation(payment_id, now=current_time)
    return len(expired_booking_ids), len(due_ids)
