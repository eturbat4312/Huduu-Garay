from django.db.models import F


def booking_contact_allowed(booking, user):
    return bool(
        user and user.is_authenticated
        and user.pk in (booking.guest_id, booking.listing.host_id)
        and booking.status == "confirmed"
        and not booking.is_cancelled_by_host
        and not booking.guest_cancelled_at
        and booking.payments.filter(
            status="paid", amount__gte=F("booking__total_price") + F("booking__service_fee")
        ).exists()
    )
