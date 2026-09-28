from django.db.models import Q

from core.models import Booking, Notification
from core.services.booking_times import CHECK_OUT_TIME, local_now, stay_has_ended


def _read_message_notifications(booking_ids):
    Notification.objects.filter(
        related_booking_id__in=booking_ids,
        type="booking_message",
        is_read=False,
    ).update(is_read=True)


def complete_finished_bookings(now=None):
    """Move paid stays to completed after the local 12:00 checkout time."""
    current = local_now(now)
    ended = Q(check_out__lt=current.date())
    if current.time().replace(tzinfo=None) >= CHECK_OUT_TIME:
        ended |= Q(check_out=current.date())

    finished = Booking.objects.filter(
        ended,
        status=Booking.STATUS_CONFIRMED,
        is_cancelled_by_host=False,
        guest_cancelled_at__isnull=True,
    )
    booking_ids = list(finished.values_list("pk", flat=True))
    updated = finished.update(status=Booking.STATUS_COMPLETED)
    if booking_ids:
        _read_message_notifications(booking_ids)
    return updated


def complete_booking_if_finished(booking, now=None):
    """Complete one finished booking and keep the in-memory object in sync."""
    if (
        booking.status == Booking.STATUS_CONFIRMED
        and not booking.is_cancelled_by_host
        and booking.guest_cancelled_at is None
        and stay_has_ended(booking, now=now)
    ):
        updated = Booking.objects.filter(
            pk=booking.pk,
            status=Booking.STATUS_CONFIRMED,
        ).update(status=Booking.STATUS_COMPLETED)
        if updated:
            booking.status = Booking.STATUS_COMPLETED
            _read_message_notifications([booking.pk])
            return True
    return False
