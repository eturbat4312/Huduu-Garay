from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Availability, Booking, BookingHold, Listing, Notification, Payment
from core.services.cancellations import GUEST_CANCELLATION_POLICY_VERSION


class GuestCancellationTests(TestCase):
    def setUp(self):
        self.now = datetime(2030, 6, 1, 12, tzinfo=dt_timezone.utc)
        now_patch = patch("django.utils.timezone.now", return_value=self.now)
        now_patch.start()
        self.addCleanup(now_patch.stop)
        User = get_user_model()
        self.guest = User.objects.create_user(username="cancel_guest", email="guest@example.com")
        self.host = User.objects.create_user(username="cancel_host", email="host@example.com", is_host=True)
        self.staff = User.objects.create_user(username="cancel_staff", email="staff@example.com", is_staff=True)
        self.no_email = User.objects.create_user(username="cancel_staff_no_email", is_staff=True)
        self.inactive = User.objects.create_user(username="cancel_inactive", is_staff=True, is_active=False)
        self.other = User.objects.create_user(username="cancel_other")
        self.listing = Listing.objects.create(
            host=self.host, title="Cancellation test", price_per_night=100000,
        )
        self.booking = Booking.objects.create(
            listing=self.listing, guest=self.guest, full_name="Test Guest",
            check_in=self.now.date() + timedelta(days=5),
            check_out=self.now.date() + timedelta(days=7),
            total_price=200000, service_fee=20000, status="confirmed",
        )
        self.payment = Payment.objects.create(
            booking=self.booking, amount=220000, sender_invoice_no="cancel-test",
            invoice_id="cancel-test-invoice", status="paid", paid_at=self.now,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.guest)
        self.url = f"/api/bookings/{self.booking.pk}/guest-cancel/"
        self.payload = {
            "policy_accepted": True, "policy_version": GUEST_CANCELLATION_POLICY_VERSION,
            "reason": "  Plans changed  ",
        }

    def cancel(self, payload=None):
        return self.client.post(self.url, self.payload if payload is None else payload, format="json")

    def test_cancellation_records_consent_and_restores_only_booked_dates(self):
        outside_date = self.booking.check_out + timedelta(days=5)
        Availability.objects.create(listing=self.listing, date=outside_date)
        response = self.cancel()
        self.assertEqual(response.status_code, 200)
        self.booking.refresh_from_db()
        self.payment.refresh_from_db()
        self.assertEqual(self.booking.status, "cancelled")
        self.assertEqual(self.booking.guest_cancelled_at, self.now)
        self.assertEqual(self.booking.guest_cancellation_reason, "Plans changed")
        self.assertEqual(self.booking.guest_cancellation_policy_version, GUEST_CANCELLATION_POLICY_VERSION)
        self.assertFalse(self.booking.is_cancelled_by_host)
        self.assertEqual(self.payment.status, "paid")
        self.assertEqual(self.payment.amount, 220000)
        self.assertFalse(response.data["guest_cancellation"]["allowed"])
        self.assertSetEqual(set(Availability.objects.values_list("date", flat=True)), {
            self.booking.check_in, self.booking.check_in + timedelta(days=1), outside_date,
        })

    def test_consent_and_current_policy_are_required(self):
        for accepted in [False, "true", 1, None]:
            with self.subTest(accepted=accepted):
                response = self.cancel({**self.payload, "policy_accepted": accepted})
                self.assertEqual(response.status_code, 400)
        self.assertEqual(self.cancel({}).status_code, 400)
        self.assertEqual(self.cancel({**self.payload, "policy_version": "old"}).status_code, 409)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, "confirmed")
        self.assertFalse(Availability.objects.exists())

    def test_reason_is_optional_and_bounded(self):
        for reason in [None, [], "x" * 1001]:
            self.assertEqual(self.cancel({**self.payload, "reason": reason}).status_code, 400)
        self.assertEqual(self.cancel({**self.payload, "reason": ""}).status_code, 200)

    def test_only_booking_owner_can_cancel(self):
        for user in [self.other, self.host, self.staff]:
            self.client.force_authenticate(user)
            self.assertEqual(self.cancel().status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.cancel().status_code, 401)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, "confirmed")

    def test_pending_failed_expired_or_cancelled_bookings_cannot_be_cancelled(self):
        for state in ["pending_payment", "payment_failed", "expired", "cancelled"]:
            with self.subTest(state=state):
                self.booking.status = state
                self.booking.save(update_fields=["status"])
                self.assertEqual(self.cancel().status_code, 400)
        self.assertFalse(Availability.objects.exists())

    def test_pending_booking_keeps_its_payment_and_hold(self):
        self.booking.status = "pending_payment"
        self.booking.save(update_fields=["status"])
        self.payment.status = "pending"
        self.payment.save(update_fields=["status"])
        BookingHold.objects.create(booking=self.booking, listing=self.listing, date=self.booking.check_in)
        self.assertEqual(self.cancel().status_code, 400)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "pending")
        self.assertTrue(BookingHold.objects.filter(booking=self.booking).exists())

    def test_legacy_host_cancellation_is_respected(self):
        self.booking.is_cancelled_by_host = True
        self.booking.save(update_fields=["is_cancelled_by_host"])
        self.assertEqual(self.cancel().status_code, 400)

    def test_past_arrival_date_uses_mongolian_calendar_date(self):
        self.booking.check_in = self.now.date()
        self.booking.save(update_fields=["check_in"])
        with patch("django.utils.timezone.now", return_value=self.now.replace(hour=17)):
            self.assertEqual(self.cancel().status_code, 400)
        self.assertFalse(Availability.objects.exists())

    def test_same_day_cancellation_keeps_paid_money_for_manual_review(self):
        self.booking.check_in = self.now.date()
        self.booking.save(update_fields=["check_in"])
        self.assertEqual(self.cancel().status_code, 200)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "paid")

    def test_retry_does_not_reopen_dates_after_another_guest_books(self):
        self.assertEqual(self.cancel().status_code, 200)
        Availability.objects.filter(listing=self.listing).delete()
        Booking.objects.create(
            listing=self.listing, guest=self.other, check_in=self.booking.check_in,
            check_out=self.booking.check_out, status="confirmed",
        )
        count = Notification.objects.count()
        self.assertEqual(self.cancel().status_code, 200)
        self.assertEqual(Notification.objects.count(), count)
        self.assertFalse(Availability.objects.exists())
        self.client.force_authenticate(self.host)
        response = self.client.post(f"/api/bookings/{self.booking.pk}/host-cancel/")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Availability.objects.exists())

    @patch("core.views.send_notification_email")
    def test_notifications_emails_and_role_specific_links(self, send_email):
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.cancel().status_code, 200)
        recipients = set(Notification.objects.values_list("user_id", flat=True))
        self.assertSetEqual(recipients, {self.guest.pk, self.host.pk, self.staff.pk, self.no_email.pk})
        self.assertSetEqual({call.args[0].pk for call in send_email.call_args_list}, {self.guest.pk, self.host.pk, self.staff.pk})
        for user, role in [(self.guest, "guest"), (self.host, "host"), (self.staff, "admin")]:
            self.client.force_authenticate(user)
            data = self.client.get("/api/notifications/").data
            self.assertEqual(data[0]["booking_role"], role)
            self.assertEqual(data[0]["related_booking"], self.booking.pk)
            unread = self.client.get("/api/notifications/unread-count/").data
            self.assertEqual(unread["booking_unread"], 1)

    def test_cancelled_booking_is_removed_from_calendar_and_cannot_be_reviewed(self):
        self.cancel()
        self.client.force_authenticate(self.host)
        self.assertEqual(self.client.get("/api/host-booking-calendar/").data, [])
        self.client.force_authenticate(self.guest)
        with patch("django.utils.timezone.now", return_value=self.now + timedelta(days=10)):
            response = self.client.post(f"/api/listings/{self.listing.pk}/reviews/", {
                "listing": self.listing.pk, "rating": 5, "comment": "Never stayed",
            }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_guest_cancelled_booking_does_not_block_listing_deletion(self):
        self.cancel()
        self.client.force_authenticate(self.host)
        response = self.client.delete(f"/api/listings/{self.listing.pk}/delete/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Listing.objects.filter(pk=self.listing.pk).exists())

    @patch("core.views.QPayClient.check_payment", return_value={"count": 1})
    def test_repeated_payment_callback_does_not_revive_cancelled_booking(self, check_payment):
        self.cancel()
        count = Notification.objects.count()
        response = self.client.post("/api/payments/qpay/callback/", {"invoice_id": self.payment.invoice_id}, format="json")
        self.assertEqual(response.status_code, 200)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, "cancelled")
        self.assertEqual(Notification.objects.count(), count)

    def test_saved_price_and_service_fee_survive_listing_price_changes(self):
        self.listing.price_per_night = 999999
        self.listing.save(update_fields=["price_per_night"])
        response = self.client.get(f"/api/bookings/{self.booking.pk}/")
        self.assertEqual(response.data["total_price"], 200000)
        self.assertEqual(response.data["service_fee"], 20000)
        self.assertTrue(response.data["guest_cancellation"]["allowed"])
