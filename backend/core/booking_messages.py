from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import MethodNotAllowed, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from .models import Booking, BookingMessage, Notification
from .services.booking_lifecycle import (
    complete_booking_if_finished,
    complete_finished_bookings,
)
from .services.booking_contact import booking_contact_allowed


class MessageInput(serializers.Serializer):
    body = serializers.CharField(max_length=2000, trim_whitespace=True)
    client_id = serializers.UUIDField()


class MessageThrottle(UserRateThrottle):
    scope = "booking_messages"
    rate = "60/min"


def message_data(message, user):
    return {"id": message.pk, "body": message.body,
            "is_mine": message.sender_id == user.pk,
            "created_at": message.created_at, "read_at": message.read_at}


class BookingMessagesView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [MessageThrottle]

    def booking(self, request, booking_id):
        complete_finished_bookings()
        booking = get_object_or_404(
            Booking.objects.filter(
                Q(guest=request.user) | Q(listing__host=request.user)
            ), pk=booking_id,
        )
        complete_booking_if_finished(booking)
        if not booking_contact_allowed(booking, request.user):
            if booking.status == Booking.STATUS_COMPLETED or booking.check_out < timezone.localdate():
                raise PermissionDenied(
                    "Байрлах хугацаа дууссан тул чат болон холбоо барих "
                    "мэдээлэл хаагдсан. Асуудал байвал Тусламж хэсгээр хүсэлт илгээнэ үү."
                )
            raise PermissionDenied("Төлбөр төлөгдөж, захиалга баталгаажсаны дараа холбогдох боломжтой.")
        return booking

    def get(self, request, booking_id):
        booking = self.booking(request, booking_id)
        after = serializers.IntegerField(min_value=0, max_value=2**63 - 1).run_validation(
            request.query_params.get("after", 0)
        )
        messages = list(booking.messages.filter(pk__gt=after).order_by("pk")[:100])
        return Response({"messages": [message_data(m, request.user) for m in messages],
                         "has_more": bool(messages and booking.messages.filter(pk__gt=messages[-1].pk).exists())})

    def post(self, request, booking_id):
        booking = self.booking(request, booking_id)
        data = MessageInput(data=request.data)
        data.is_valid(raise_exception=True)
        with transaction.atomic():
            message, created = BookingMessage.objects.get_or_create(
                booking=booking, sender=request.user, client_id=data.validated_data["client_id"],
                defaults={"body": data.validated_data["body"]},
            )
            if created:
                recipient_id = booking.listing.host_id if request.user.pk == booking.guest_id else booking.guest_id
                Notification.objects.create(
                    user_id=recipient_id, type="booking_message", related_booking=booking,
                    message=f"Захиалга #{booking.pk}: шинэ мессеж ирлээ.",
                )
        return Response(message_data(message, request.user), status=201 if created else 200)


class BookingMessagesReadView(BookingMessagesView):
    def post(self, request, booking_id):
        booking = self.booking(request, booking_id)
        through = serializers.IntegerField(min_value=0, max_value=2**63 - 1).run_validation(
            request.data.get("through")
        )
        with transaction.atomic():
            booking.messages.filter(pk__lte=through, read_at__isnull=True).exclude(
                sender=request.user
            ).update(read_at=timezone.now())
            if not booking.messages.filter(read_at__isnull=True).exclude(sender=request.user).exists():
                Notification.objects.filter(user=request.user, related_booking=booking,
                                            type="booking_message", is_read=False).update(is_read=True)
        return Response({"ok": True})

    def get(self, request, booking_id):
        raise MethodNotAllowed("GET")
