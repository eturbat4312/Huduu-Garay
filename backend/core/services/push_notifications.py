import logging
from datetime import timedelta

import requests
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from core.models import Notification, PushDelivery, PushDevice


logger = logging.getLogger(__name__)

PUSH_TITLES = {
    "booking_created": "Шинэ захиалга",
    "booking_confirmed": "Захиалга баталгаажлаа",
    "admin_booking": "Шинэ захиалга",
    "booking_cancelled": "Захиалга цуцлагдлаа",
    "host_application": "Шинэ түрээслүүлэгчийн хүсэлт",
    "host_approved": "Түрээслүүлэгчийн эрх батлагдлаа",
    "host_rejected": "Түрээслүүлэгчийн хүсэлт",
    "review": "Шинэ сэтгэгдэл",
    "listing_published": "Зар нийтлэгдлээ",
    "listing_review": "Зарын хяналтын төлөв",
    "admin_listing_review": "Шалгах шинэ зар",
    "payment": "Төлбөрийн мэдээлэл",
    "admin_support": "Шинэ тусламжийн хүсэлт",
    "support_reply": "Тусламжийн хүсэлтийн хариу",
    "admin_user": "Шинэ хэрэглэгч",
}

PERMANENT_EXPO_ERRORS = {"DeviceNotRegistered", "InvalidCredentials", "MessageTooBig"}


def _headers():
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
    }
    access_token = getattr(settings, "EXPO_PUSH_ACCESS_TOKEN", "")
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    return headers


def _booking_role(notification):
    booking = notification.related_booking
    if not booking:
        return None
    if notification.user_id == booking.guest_id:
        return "guest"
    if notification.user_id == booking.listing.host_id:
        return "host"
    if notification.user.is_staff:
        return "admin"
    return None


def _message(delivery, unread_count):
    notification = delivery.notification
    data = {
        "notification_id": notification.pk,
        "type": notification.type,
    }
    if notification.related_booking_id:
        data["related_booking"] = notification.related_booking_id
        data["booking_role"] = _booking_role(notification)
    if notification.related_listing_id:
        data["related_listing"] = notification.related_listing_id
    if notification.related_support_request_id:
        data["related_support_request"] = notification.related_support_request_id

    return {
        "to": delivery.token,
        "sound": "default",
        "title": PUSH_TITLES.get(notification.type, "Танайд Хоноё"),
        "body": notification.message[:500],
        "data": data,
        "badge": unread_count,
        "channelId": "default",
        "priority": "high",
    }


def queue_push_for_notification(notification):
    if not getattr(settings, "EXPO_PUSH_NOTIFICATIONS_ENABLED", True):
        return 0

    devices = list(
        PushDevice.objects.filter(user_id=notification.user_id, is_active=True)
    )
    if not devices:
        return 0

    PushDelivery.objects.bulk_create(
        [
            PushDelivery(
                notification=notification,
                device=device,
                token=device.token,
            )
            for device in devices
        ],
        ignore_conflicts=True,
    )
    return len(devices)


def _claim_pending_deliveries(notification_id=None, limit=100, max_attempts=5):
    with transaction.atomic():
        queryset = (
            PushDelivery.objects.select_for_update(skip_locked=True, of=("self",))
            .filter(
                status=PushDelivery.STATUS_PENDING,
                attempt_count__lt=max_attempts,
                device__is_active=True,
            )
            .select_related(
                "notification__user",
                "notification__related_booking__listing",
                "device",
            )
            .order_by("created_at", "id")
        )
        if notification_id is not None:
            queryset = queryset.filter(notification_id=notification_id)
        deliveries = list(queryset[:limit])
        if not deliveries:
            return []

        now = timezone.now()
        ids = [delivery.pk for delivery in deliveries]
        PushDelivery.objects.filter(pk__in=ids).update(
            status=PushDelivery.STATUS_SENDING,
            attempt_count=F("attempt_count") + 1,
            last_attempt_at=now,
            error_code="",
            error_message="",
        )
        for delivery in deliveries:
            delivery.status = PushDelivery.STATUS_SENDING
            delivery.attempt_count += 1
            delivery.last_attempt_at = now
        return deliveries


def _set_delivery_error(delivery, code, message, retryable=False):
    retryable = retryable and delivery.attempt_count < 5
    delivery.status = (
        PushDelivery.STATUS_PENDING if retryable else PushDelivery.STATUS_FAILED
    )
    delivery.error_code = code or "ExpoPushError"
    delivery.error_message = str(message or "Push notification илгээж чадсангүй.")[:2000]
    delivery.save(
        update_fields=["status", "error_code", "error_message", "updated_at"]
    )
    if code == "DeviceNotRegistered" and delivery.device_id:
        PushDevice.objects.filter(pk=delivery.device_id).update(is_active=False)


def send_pending_push_deliveries(notification_id=None, limit=100):
    if not getattr(settings, "EXPO_PUSH_NOTIFICATIONS_ENABLED", True):
        return 0

    deliveries = _claim_pending_deliveries(notification_id=notification_id, limit=limit)
    if not deliveries:
        return 0

    user_ids = {delivery.notification.user_id for delivery in deliveries}
    unread_counts = {
        user_id: Notification.objects.filter(
            user_id=user_id, is_read=False
        ).count()
        for user_id in user_ids
    }
    payload = [
        _message(delivery, unread_counts[delivery.notification.user_id])
        for delivery in deliveries
    ]

    try:
        response = requests.post(
            getattr(settings, "EXPO_PUSH_URL"),
            headers=_headers(),
            json=payload,
            timeout=getattr(settings, "EXPO_PUSH_TIMEOUT_SECONDS", 10),
        )
        response.raise_for_status()
        result = response.json()
        tickets = result.get("data")
        if not isinstance(tickets, list) or len(tickets) != len(deliveries):
            raise ValueError("Expo push ticket response хэмжээ тохирохгүй байна.")
    except (requests.RequestException, ValueError) as exc:
        logger.exception("Expo push request failed for %s deliveries", len(deliveries))
        for delivery in deliveries:
            _set_delivery_error(delivery, "TransportError", exc, retryable=True)
        return 0

    accepted = 0
    for delivery, ticket in zip(deliveries, tickets):
        if ticket.get("status") == "ok" and ticket.get("id"):
            delivery.status = PushDelivery.STATUS_ACCEPTED
            delivery.ticket_id = ticket["id"]
            delivery.error_code = ""
            delivery.error_message = ""
            delivery.save(
                update_fields=[
                    "status",
                    "ticket_id",
                    "error_code",
                    "error_message",
                    "updated_at",
                ]
            )
            accepted += 1
            continue

        details = ticket.get("details") or {}
        code = details.get("error") or "ExpoPushError"
        _set_delivery_error(
            delivery,
            code,
            ticket.get("message"),
            retryable=code not in PERMANENT_EXPO_ERRORS,
        )
    return accepted


def check_push_receipts(limit=1000, minimum_age_minutes=15):
    cutoff = timezone.now() - timedelta(minutes=minimum_age_minutes)
    deliveries = list(
        PushDelivery.objects.filter(
            status=PushDelivery.STATUS_ACCEPTED,
            ticket_id__gt="",
            last_attempt_at__lte=cutoff,
        )
        .select_related("device")
        .order_by("last_attempt_at", "id")[:limit]
    )
    if not deliveries:
        return 0

    try:
        response = requests.post(
            getattr(settings, "EXPO_PUSH_RECEIPTS_URL"),
            headers=_headers(),
            json={"ids": [delivery.ticket_id for delivery in deliveries]},
            timeout=getattr(settings, "EXPO_PUSH_TIMEOUT_SECONDS", 10),
        )
        response.raise_for_status()
        receipts = response.json().get("data", {})
        if not isinstance(receipts, dict):
            raise ValueError("Expo receipt response буруу байна.")
    except (requests.RequestException, ValueError):
        logger.exception("Expo push receipt request failed")
        return 0

    checked = 0
    for delivery in deliveries:
        receipt = receipts.get(delivery.ticket_id)
        if not receipt:
            continue
        checked += 1
        if receipt.get("status") == "ok":
            delivery.status = PushDelivery.STATUS_DELIVERED
            delivery.error_code = ""
            delivery.error_message = ""
            delivery.save(
                update_fields=["status", "error_code", "error_message", "updated_at"]
            )
            continue

        details = receipt.get("details") or {}
        _set_delivery_error(
            delivery,
            details.get("error") or "ExpoReceiptError",
            receipt.get("message"),
            retryable=False,
        )
    return checked
