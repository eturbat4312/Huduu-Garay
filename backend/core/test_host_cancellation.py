from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Availability, Booking, BookingHold, Listing, Notification, Payment
from core.services.cancellations import HOST_CANCELLATION_POLICY_VERSION


class HostCancellationTests(TestCase):
    def setUp(self):
        self.now = datetime(2030, 6, 1, 12, tzinfo=dt_timezone.utc)
        now_patch = patch("django.utils.timezone.now", return_value=self.now)
        now_patch.start()
        self.addCleanup(now_patch.stop)

        User = get_user_model()
        self.guest = User.objects.create_user(
            username="host_cancel_guest", email="guest@example.com"
        )
        self.host = User.objects.create_user(
            username="host_cancel_host", email="host@example.com", is_host=True
        )
        self.other_host = User.objects.create_user(
            username="host_cancel_other", is_host=True
        )
        self.staff = User.objects.create_user(
            username="host_cancel_staff", email="staff@example.com", is_staff=True
        )
        self.no_email = User.objects.create_user(
            username="host_cancel_staff_no_email", is_staff=True
        )
        self.inactive = User.objects.create_user(
            username="host_cancel_inactive", is_staff=True, is_active=False
        )
        self.listing = Listing.objects.create(
            host=self.host,
            title="Host cancellation test",
            price_per_night=100000,
            status=Listing.STATUS_ACTIVE,
        )
        self.booking = Booking.objects.create(
            listing=self.listing,
            guest=self.guest,
            full_name="Test Guest",
            phone_number="99001122",
            check_in=self.now.date() + timedelta(days=5),
            check_out=self.now.date() + timedelta(days=7),
            total_price=200000,
            service_fee=20000,
            status="confirmed",
        )
        self.payment = Payment.objects.create(
            booking=self.booking,
            amount=220000,
            sender_invoice_no="host-cancel-test",
            invoice_id="host-cancel-test-invoice",
            status="paid",
            paid_at=self.now,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.host)
        self.url = f"/api/bookings/{self.booking.pk}/host-cancel/"
        self.payload = {
            "policy_accepted": True,
            "policy_version": HOST_CANCELLATION_POLICY_VERSION,
            "reason": "  Ус алдаж, яаралтай засвар хийх шаардлагатай болсон.  ",
        }

    def cancel(self, payload=None):
        return self.client.post(
            self.url,
            self.payload if payload is None else payload,
            format="json",
        )

    def test_cancellation_records_consent_preserves_payment_and_restores_dates(self):
        outside_date = self.booking.check_out + timedelta(days=5)
        Availability.objects.create(listing=self.listing, date=outside_date)

        response = self.cancel()

        self.assertEqual(response.status_code, 200)
        self.booking.refresh_from_db()
        self.payment.refresh_from_db()
        self.assertEqual(self.booking.status, "cancelled")
        self.assertTrue(self.booking.is_cancelled_by_host)
        self.assertEqual(self.booking.host_cancelled_at, self.now)
        self.assertEqual(
            self.booking.host_cancellation_reason,
            "Ус алдаж, яаралтай засвар хийх шаардлагатай болсон.",
        )
        self.assertEqual(
            self.booking.host_cancellation_policy_version,
            HOST_CANCELLATION_POLICY_VERSION,
        )
        self.assertEqual(self.payment.status, "paid")
        self.assertEqual(self.payment.amount, 220000)
        self.assertFalse(response.data["host_cancellation"]["allowed"])
        self.assertSetEqual(
            set(Availability.objects.values_list("date", flat=True)),
            {
                self.booking.check_in,
                self.booking.check_in + timedelta(days=1),
                outside_date,
            },
        )

    def test_reason_consent_and_current_policy_are_required(self):
        for reason in [None, "", "   ", [], "x" * 1001]:
            with self.subTest(reason=reason):
                response = self.cancel({**self.payload, "reason": reason})
                self.assertEqual(response.status_code, 400)
        for accepted in [False, "true", 1, None]:
            with self.subTest(accepted=accepted):
                response = self.cancel({**self.payload, "policy_accepted": accepted})
                self.assertEqual(response.status_code, 400)
        self.assertEqual(
            self.cancel({**self.payload, "policy_version": "old"}).status_code,
            409,
        )
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, "confirmed")
        self.assertFalse(Availability.objects.exists())

    def test_only_listing_host_can_cancel(self):
        for user in [self.guest, self.other_host, self.staff]:
            self.client.force_authenticate(user)
            self.assertEqual(self.cancel().status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.cancel().status_code, 401)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, "confirmed")

    def test_non_confirmed_guest_cancelled_and_past_bookings_are_blocked(self):
        for booking_status in ["pending_payment", "payment_failed", "expired"]:
            with self.subTest(booking_status=booking_status):
                self.booking.status = booking_status
                self.booking.save(update_fields=["status"])
                self.assertEqual(self.cancel().status_code, 400)

        self.booking.status = "cancelled"
        self.booking.guest_cancelled_at = self.now
        self.booking.save(update_fields=["status", "guest_cancelled_at"])
        self.assertEqual(self.cancel().status_code, 400)

        self.booking.status = "confirmed"
        self.booking.guest_cancelled_at = None
        self.booking.check_in = self.now.date() - timedelta(days=1)
        self.booking.save(update_fields=["status", "guest_cancelled_at", "check_in"])
        self.assertEqual(self.cancel().status_code, 400)
        self.assertFalse(Availability.objects.exists())

    def test_same_day_cancellation_is_allowed_for_urgent_cases(self):
        self.booking.check_in = self.now.date()
        self.booking.check_out = self.now.date() + timedelta(days=1)
        self.booking.save(update_fields=["check_in", "check_out"])
        before_check_in = self.now.replace(hour=5)
        with patch("django.utils.timezone.now", return_value=before_check_in):
            self.assertEqual(self.cancel().status_code, 200)

    def test_pending_booking_keeps_payment_and_hold(self):
        self.booking.status = "pending_payment"
        self.booking.save(update_fields=["status"])
        self.payment.status = "pending"
        self.payment.save(update_fields=["status"])
        BookingHold.objects.create(
            booking=self.booking,
            listing=self.listing,
            date=self.booking.check_in,
        )
        self.assertEqual(self.cancel().status_code, 400)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "pending")
        self.assertTrue(BookingHold.objects.filter(booking=self.booking).exists())

    def test_retry_is_idempotent_and_does_not_reopen_dates(self):
        self.assertEqual(self.cancel().status_code, 200)
        notification_count = Notification.objects.filter(
            related_booking=self.booking
        ).count()
        Availability.objects.filter(listing=self.listing).delete()
        Booking.objects.create(
            listing=self.listing,
            guest=self.guest,
            check_in=self.booking.check_in,
            check_out=self.booking.check_out,
            status="confirmed",
        )

        response = self.cancel()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            Notification.objects.filter(related_booking=self.booking).count(),
            notification_count,
        )
        self.assertFalse(Availability.objects.exists())

    @patch("core.views.send_notification_email")
    def test_notifications_emails_and_role_specific_links(self, send_email):
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.cancel().status_code, 200)

        recipients = set(Notification.objects.values_list("user_id", flat=True))
        self.assertSetEqual(
            recipients,
            {self.guest.pk, self.host.pk, self.staff.pk, self.no_email.pk},
        )
        self.assertSetEqual(
            {call.args[0].pk for call in send_email.call_args_list},
            {self.guest.pk, self.host.pk, self.staff.pk},
        )
        for user, role in [
            (self.guest, "guest"),
            (self.host, "host"),
            (self.staff, "admin"),
        ]:
            self.client.force_authenticate(user)
            data = self.client.get("/api/notifications/").data
            self.assertEqual(data[0]["booking_role"], role)
            self.assertEqual(data[0]["related_booking"], self.booking.pk)
            unread = self.client.get("/api/notifications/unread-count/").data
            self.assertEqual(unread["booking_unread"], 2 if user.is_staff else 1)

    def test_host_detail_exposes_current_policy_only_to_host(self):
        response = self.client.get(f"/api/host-bookings/{self.booking.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["host_cancellation"]["allowed"])
        self.assertEqual(
            response.data["host_cancellation"]["policy_version"],
            HOST_CANCELLATION_POLICY_VERSION,
        )

        self.client.force_authenticate(self.guest)
        response = self.client.get(f"/api/bookings/{self.booking.pk}/")
        self.assertFalse(response.data["host_cancellation"]["allowed"])
