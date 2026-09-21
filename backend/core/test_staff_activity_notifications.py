from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from allauth.account.models import EmailAddress
from allauth.account.models import EmailConfirmationHMAC
from rest_framework.test import APIClient

from core.adapters import AccountAdapter
from core.models import Booking, Category, Listing, Notification, Review


User = get_user_model()


@override_settings(
    STAFF_ACTIVITY_EMAILS_ENABLED=True,
    FRONTEND_URL="https://www.tanaid-honoy.mn",
)
class EmailConfirmationLinkTests(TestCase):
    def test_confirmation_link_opens_frontend_confirmation_page(self):
        url = AccountAdapter().get_email_confirmation_url(
            None, SimpleNamespace(key="abc:123")
        )

        self.assertEqual(
            url,
            "https://www.tanaid-honoy.mn/mn/confirm-email?key=abc%3A123",
        )

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"
    )
    def test_verification_api_confirms_registration_email(self):
        client = APIClient()
        response = client.post(
            "/api/auth/registration/",
            {
                "username": "verify-user",
                "email": "verify@example.com",
                "password1": "StrongVerifyPass1!",
                "password2": "StrongVerifyPass1!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        address = EmailAddress.objects.get(email="verify@example.com")
        self.assertFalse(address.verified)
        key = EmailConfirmationHMAC(address).key

        verified = client.post(
            "/api/auth/registration/verify-email/", {"key": key}, format="json"
        )
        self.assertEqual(verified.status_code, 200)
        address.refresh_from_db()
        self.assertTrue(address.verified)


@override_settings(STAFF_ACTIVITY_EMAILS_ENABLED=True)
class StaffActivityNotificationTests(TestCase):
    def setUp(self):
        with override_settings(STAFF_ACTIVITY_EMAILS_ENABLED=False):
            self.staff = User.objects.create_user(
                username="activity-staff",
                email="staff@example.com",
                password="pass",
                is_staff=True,
            )
            self.staff_without_email = User.objects.create_user(
                username="activity-staff-no-email",
                password="pass",
                is_staff=True,
            )
        Notification.objects.all().delete()

    def assert_staff_event(self, notification_type, mocked_email):
        self.assertEqual(
            set(Notification.objects.values_list("user_id", "type")),
            {
                (self.staff.pk, notification_type),
                (self.staff_without_email.pk, notification_type),
            },
        )
        mocked_email.assert_called_once()
        self.assertEqual(mocked_email.call_args.args[0], self.staff)
        self.assertEqual(mocked_email.call_args.args[1], "staff_activity")

    @patch("core.utils.staff_notifications.send_notification_email", return_value=1)
    def test_new_user_notifies_staff(self, send_email):
        with self.captureOnCommitCallbacks(execute=True):
            User.objects.create_user(
                username="new-user", email="new@example.com", password="pass"
            )

        self.assert_staff_event("admin_user", send_email)

    @patch("core.utils.staff_notifications.send_notification_email", return_value=1)
    def test_listing_booking_and_review_each_notify_staff(self, send_email):
        with override_settings(STAFF_ACTIVITY_EMAILS_ENABLED=False):
            host = User.objects.create_user(
                username="host", email="host@example.com", is_host=True
            )
            guest = User.objects.create_user(
                username="guest", email="guest@example.com"
            )
        Notification.objects.all().delete()
        category = Category.objects.create(name="Гэр")

        with self.captureOnCommitCallbacks(execute=True):
            listing = Listing.objects.create(
                host=host,
                category=category,
                title="Тест зар",
                description="Тайлбар",
                price_per_night=100000,
                location_city="Улаанбаатар",
                location_district="Сүхбаатар",
            )
        self.assert_staff_event("listing_published", send_email)

        Notification.objects.all().delete()
        send_email.reset_mock()
        with self.captureOnCommitCallbacks(execute=True):
            booking = Booking.objects.create(
                listing=listing,
                guest=guest,
                check_in="2026-10-01",
                check_out="2026-10-02",
                full_name="Зочин",
                phone_number="99001122",
                guest_count=2,
                total_price=100000,
                service_fee=10000,
                status="pending_payment",
            )
        self.assert_staff_event("payment", send_email)

        Notification.objects.all().delete()
        send_email.reset_mock()
        with self.captureOnCommitCallbacks(execute=True):
            Review.objects.create(
                listing=listing,
                booking=booking,
                guest=guest,
                rating=5,
                comment="Маш гоё",
            )
        self.assert_staff_event("review", send_email)

    @override_settings(STAFF_ACTIVITY_EMAILS_ENABLED=False)
    @patch("core.utils.staff_notifications.send_notification_email", return_value=1)
    def test_email_switch_keeps_in_app_notification(self, send_email):
        User.objects.create_user(
            username="quiet-user", email="quiet@example.com", password="pass"
        )

        self.assertTrue(
            Notification.objects.filter(user=self.staff, type="admin_user").exists()
        )
        send_email.assert_not_called()
