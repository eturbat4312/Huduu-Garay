from datetime import date, timedelta
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import (
    Booking,
    Category,
    Listing,
    Notification,
    PushDelivery,
    PushDevice,
)
from core.services.push_notifications import (
    check_push_receipts,
    send_pending_push_deliveries,
)


User = get_user_model()


def expo_response(data):
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"data": data}
    return response


@override_settings(EXPO_PUSH_NOTIFICATIONS_ENABLED=True)
class PushDeviceAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="push-user", email="push@example.com", password="pass1234!"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.token = "ExpoPushToken[test-device-token]"

    def test_register_and_deactivate_device(self):
        response = self.client.post(
            "/api/push-devices/register/",
            {"token": self.token, "platform": "ios"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        device = PushDevice.objects.get(token=self.token)
        self.assertEqual(device.user, self.user)
        self.assertTrue(device.is_active)

        response = self.client.post(
            "/api/push-devices/deactivate/",
            {"token": self.token},
            format="json",
        )
        self.assertEqual(response.status_code, 204)
        device.refresh_from_db()
        self.assertFalse(device.is_active)

    def test_same_token_moves_to_current_signed_in_user(self):
        PushDevice.objects.create(
            user=self.user,
            token=self.token,
            platform=PushDevice.PLATFORM_IOS,
        )
        other = User.objects.create_user(
            username="other-push-user",
            email="other-push@example.com",
            password="pass1234!",
        )
        self.client.force_authenticate(other)

        response = self.client.post(
            "/api/push-devices/register/",
            {"token": self.token, "platform": "android"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        device = PushDevice.objects.get(token=self.token)
        self.assertEqual(device.user, other)
        self.assertEqual(device.platform, PushDevice.PLATFORM_ANDROID)

    def test_invalid_or_unauthenticated_registration_is_rejected(self):
        invalid = self.client.post(
            "/api/push-devices/register/",
            {"token": "plain-token", "platform": "ios"},
            format="json",
        )
        self.assertEqual(invalid.status_code, 400)

        self.client.force_authenticate(user=None)
        unauthenticated = self.client.post(
            "/api/push-devices/register/",
            {"token": self.token, "platform": "ios"},
            format="json",
        )
        self.assertEqual(unauthenticated.status_code, 401)


@override_settings(EXPO_PUSH_NOTIFICATIONS_ENABLED=True)
class PushDeliveryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="push-recipient",
            email="recipient@example.com",
            password="pass1234!",
        )
        self.device = PushDevice.objects.create(
            user=self.user,
            token="ExpoPushToken[recipient-device]",
            platform=PushDevice.PLATFORM_ANDROID,
        )

    @patch("core.services.push_notifications.requests.post")
    def test_new_notification_is_sent_and_ticket_saved(self, post):
        post.return_value = expo_response(
            [{"status": "ok", "id": "expo-ticket-1"}]
        )

        notification = Notification.objects.create(
            user=self.user,
            message="Таны захиалга баталгаажлаа.",
            type="booking_confirmed",
        )
        send_pending_push_deliveries(notification_id=notification.pk)

        delivery = PushDelivery.objects.get(notification=notification)
        self.assertEqual(delivery.status, PushDelivery.STATUS_ACCEPTED)
        self.assertEqual(delivery.ticket_id, "expo-ticket-1")
        sent = post.call_args.kwargs["json"][0]
        self.assertEqual(sent["to"], self.device.token)
        self.assertEqual(sent["data"]["notification_id"], notification.pk)
        self.assertEqual(sent["badge"], 1)

    @patch("core.services.push_notifications.requests.post")
    def test_device_not_registered_error_deactivates_token(self, post):
        post.return_value = expo_response(
            [
                {
                    "status": "error",
                    "message": "Device is not registered",
                    "details": {"error": "DeviceNotRegistered"},
                }
            ]
        )

        notification = Notification.objects.create(
            user=self.user,
            message="Тест мэдэгдэл",
            type="booking",
        )
        send_pending_push_deliveries(notification_id=notification.pk)

        delivery = PushDelivery.objects.get(notification=notification)
        self.device.refresh_from_db()
        self.assertEqual(delivery.status, PushDelivery.STATUS_FAILED)
        self.assertFalse(self.device.is_active)

    @patch("core.services.push_notifications.requests.post")
    def test_receipt_marks_delivery_delivered(self, post):
        notification = Notification.objects.create(
            user=self.user,
            message="Receipt тест",
            type="booking",
        )
        delivery = PushDelivery.objects.get(notification=notification)
        PushDelivery.objects.filter(pk=delivery.pk).update(
            status=PushDelivery.STATUS_ACCEPTED,
            ticket_id="expo-receipt-1",
            last_attempt_at=timezone.now() - timedelta(minutes=20),
        )
        post.return_value = expo_response(
            {"expo-receipt-1": {"status": "ok"}}
        )

        checked = check_push_receipts()

        self.assertEqual(checked, 1)
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, PushDelivery.STATUS_DELIVERED)


class NotificationHistoryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="history-user",
            email="history@example.com",
            password="pass1234!",
        )
        category = Category.objects.create(name="History category")
        self.listing = Listing.objects.create(
            host=self.user,
            category=category,
            title="History listing",
            description="History",
            price_per_night=10000,
            max_guests=2,
            beds=1,
            location_city="Улаанбаатар",
            location_district="Сүхбаатар",
            status=Listing.STATUS_ACTIVE,
        )

    def test_history_survives_related_booking_and_listing_deletion(self):
        booking = Booking.objects.create(
            listing=self.listing,
            guest=self.user,
            check_in=date.today() + timedelta(days=1),
            check_out=date.today() + timedelta(days=2),
        )
        notification = Notification.objects.create(
            user=self.user,
            message="Түүхэн notification",
            type="booking_created",
            related_booking=booking,
            related_listing=self.listing,
        )

        self.listing.delete()

        notification.refresh_from_db()
        self.assertIsNone(notification.related_booking)
        self.assertIsNone(notification.related_listing)
