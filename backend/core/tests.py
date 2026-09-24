from datetime import date, timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from .models import (
    Availability,
    Booking,
    BookingHold,
    Category,
    Listing,
    ListingImage,
    Notification,
    Payment,
)
from .services.qpay import QPayClient, QPayConfig, QPayConfigurationError


class FakeQPayResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self.payload = payload or {}

    def json(self):
        return self.payload


class FakeQPaySession:
    def __init__(self, responses):
        if isinstance(responses, list):
            self.responses = responses
        else:
            self.responses = [responses]
        self.calls = []

    def post(self, url, headers=None, timeout=None, json=None):
        self.calls.append(
            {
                "method": "POST",
                "url": url,
                "headers": headers or {},
                "timeout": timeout,
                "json": json,
            }
        )
        return self.responses.pop(0)

    def delete(self, url, headers=None, timeout=None):
        self.calls.append(
            {
                "method": "DELETE",
                "url": url,
                "headers": headers or {},
                "timeout": timeout,
                "json": None,
            }
        )
        return self.responses.pop(0)


class QPayClientTests(TestCase):
    def setUp(self):
        QPayClient._shared_tokens.clear()

    def _config(self):
        return QPayConfig(
            client_id="client",
            client_secret="secret",
            invoice_code="invoice-code",
            callback_url="https://example.com/api/payments/qpay/callback/",
            base_url="https://merchant.qpay.mn",
            auth_url="https://merchant.qpay.mn/v2/auth/token",
            timeout_seconds=30,
            token_leeway_seconds=60,
        )

    def test_qpay_config_requires_credentials(self):
        with self.assertRaises(QPayConfigurationError):
            QPayConfig(
                client_id="",
                client_secret="",
                invoice_code="",
                callback_url="",
                base_url="https://merchant.qpay.mn",
                auth_url="https://merchant.qpay.mn/v2/auth/token",
                timeout_seconds=30,
                token_leeway_seconds=60,
            ).validate()

    def test_qpay_client_fetches_token_with_basic_auth(self):
        session = FakeQPaySession(
            FakeQPayResponse(
                payload={
                    "access_token": "access-token",
                    "refresh_token": "refresh-token",
                    "expires_in": 3600,
                }
            )
        )
        client = QPayClient(config=self._config(), session=session)

        token = client.get_access_token()

        self.assertEqual(token, "access-token")
        self.assertEqual(len(session.calls), 1)
        self.assertEqual(
            session.calls[0]["headers"]["Authorization"],
            "Basic Y2xpZW50OnNlY3JldA==",
        )
        self.assertEqual(session.calls[0]["timeout"], 30)

    def test_qpay_client_reuses_cached_token_until_leeway(self):
        session = FakeQPaySession(
            FakeQPayResponse(payload={"access_token": "cached-token", "expires_in": 3600})
        )
        client = QPayClient(config=self._config(), session=session)

        first = client.get_access_token()
        second = client.get_access_token()

        self.assertEqual(first, "cached-token")
        self.assertEqual(second, "cached-token")
        self.assertEqual(len(session.calls), 1)

    def test_qpay_client_understands_absolute_expiry_timestamp(self):
        expires_at = timezone.now() + timedelta(hours=24)
        session = FakeQPaySession(
            FakeQPayResponse(
                payload={
                    "access_token": "absolute-expiry-token",
                    "expires_in": int(expires_at.timestamp()),
                }
            )
        )

        token = QPayClient(config=self._config(), session=session).fetch_token()

        self.assertAlmostEqual(
            token.expires_at.timestamp(),
            expires_at.timestamp(),
            delta=1,
        )

    def test_qpay_clients_share_a_valid_token_within_a_worker(self):
        first_session = FakeQPaySession(
            FakeQPayResponse(
                payload={"access_token": "shared-token", "expires_in": 3600}
            )
        )
        second_session = FakeQPaySession([])

        first = QPayClient(
            config=self._config(),
            session=first_session,
            use_shared_token_cache=True,
        ).get_access_token()
        second = QPayClient(
            config=self._config(),
            session=second_session,
            use_shared_token_cache=True,
        ).get_access_token()

        self.assertEqual(first, "shared-token")
        self.assertEqual(second, "shared-token")
        self.assertEqual(len(first_session.calls), 1)
        self.assertEqual(len(second_session.calls), 0)

    def test_qpay_client_creates_invoice_with_bearer_token(self):
        session = FakeQPaySession(
            [
                FakeQPayResponse(payload={"access_token": "invoice-token", "expires_in": 3600}),
                FakeQPayResponse(
                    payload={
                        "invoice_id": "qpay-invoice-1",
                        "qr_text": "qr-text",
                        "urls": [{"name": "bank", "link": "bank://pay"}],
                    }
                ),
            ]
        )
        client = QPayClient(config=self._config(), session=session)

        invoice = client.create_invoice(
            sender_invoice_no="booking-1-test",
            amount=220000,
            description="Танайд Хоной захиалга #1",
        )

        self.assertEqual(invoice["invoice_id"], "qpay-invoice-1")
        self.assertEqual(len(session.calls), 2)
        self.assertEqual(
            session.calls[1]["url"], "https://merchant.qpay.mn/v2/invoice"
        )
        self.assertEqual(
            session.calls[1]["headers"]["Authorization"], "Bearer invoice-token"
        )
        self.assertEqual(session.calls[1]["json"]["invoice_code"], "invoice-code")
        self.assertEqual(session.calls[1]["json"]["sender_invoice_no"], "booking-1-test")
        self.assertEqual(session.calls[1]["json"]["amount"], 220000)
        self.assertEqual(
            session.calls[1]["json"]["callback_url"],
            (
                "https://example.com/api/payments/qpay/callback/"
                "?sender_invoice_no=booking-1-test"
            ),
        )

    def test_qpay_client_checks_payment_by_invoice_id(self):
        session = FakeQPaySession(
            [
                FakeQPayResponse(payload={"access_token": "check-token", "expires_in": 3600}),
                FakeQPayResponse(payload={"count": 1, "rows": [{"payment_id": "p1"}]}),
            ]
        )
        client = QPayClient(config=self._config(), session=session)

        result = client.check_payment(invoice_id="qpay-invoice-1")

        self.assertEqual(result["count"], 1)
        self.assertEqual(
            session.calls[1]["url"], "https://merchant.qpay.mn/v2/payment/check"
        )
        self.assertEqual(
            session.calls[1]["headers"]["Authorization"], "Bearer check-token"
        )
        self.assertEqual(session.calls[1]["json"]["object_type"], "INVOICE")
        self.assertEqual(session.calls[1]["json"]["object_id"], "qpay-invoice-1")

    def test_qpay_client_cancels_invoice_by_invoice_id(self):
        session = FakeQPaySession(
            [
                FakeQPayResponse(
                    payload={"access_token": "cancel-token", "expires_in": 3600}
                ),
                FakeQPayResponse(payload={}),
            ]
        )
        client = QPayClient(config=self._config(), session=session)

        client.cancel_invoice(invoice_id="qpay-invoice-1")

        self.assertEqual(session.calls[1]["method"], "DELETE")
        self.assertEqual(
            session.calls[1]["url"],
            "https://merchant.qpay.mn/v2/invoice/qpay-invoice-1",
        )
        self.assertEqual(
            session.calls[1]["headers"]["Authorization"], "Bearer cancel-token"
        )


class ListingImageUploadTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.host = User.objects.create_user(
            username="imagehost",
            email="imagehost@example.com",
            password="pass12345",
            is_host=True,
        )
        self.other_host = User.objects.create_user(
            username="otherimagehost",
            email="otherimagehost@example.com",
            password="pass12345",
            is_host=True,
        )
        self.category = Category.objects.create(name="Image test")
        self.listing = Listing.objects.create(
            host=self.host,
            category=self.category,
            title="Image upload listing",
            description="A listing used for image upload tests",
            price_per_night=100000,
            max_guests=2,
            beds=1,
            location_city="Ulaanbaatar",
            location_district="Sukhbaatar",
            status=Listing.STATUS_ACTIVE,
        )
        self.other_listing = Listing.objects.create(
            host=self.other_host,
            category=self.category,
            title="Other host listing",
            description="A listing owned by another host",
            price_per_night=100000,
            max_guests=2,
            beds=1,
            location_city="Ulaanbaatar",
            location_district="Sukhbaatar",
            status=Listing.STATUS_ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.host)

    def _jpeg_file(self):
        buffer = BytesIO()
        Image.new("RGB", (16, 16), color="white").save(buffer, format="JPEG")
        buffer.seek(0)
        return SimpleUploadedFile(
            "test.jpg",
            buffer.read(),
            content_type="image/jpeg",
        )

    def test_upload_rejects_svg_with_friendly_error(self):
        svg = SimpleUploadedFile(
            "bad.svg",
            b"<svg xmlns='http://www.w3.org/2000/svg'></svg>",
            content_type="image/svg+xml",
        )

        response = self.client.post(
            "/api/listing-images/",
            {"listing": self.listing.id, "images": [svg]},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("SVG", response.data["error"])
        self.assertEqual(ListingImage.objects.count(), 0)

    def test_upload_requires_listing_owner(self):
        response = self.client.post(
            "/api/listing-images/",
            {"listing": self.other_listing.id, "images": [self._jpeg_file()]},
            format="multipart",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(ListingImage.objects.count(), 0)

    def test_upload_resizes_large_image_and_stores_optimized_jpeg(self):
        buffer = BytesIO()
        Image.new("RGB", (3000, 2000), color=(80, 140, 90)).save(
            buffer, format="JPEG", quality=95
        )
        buffer.seek(0)
        upload = SimpleUploadedFile(
            "camera-photo.jpg",
            buffer.read(),
            content_type="image/jpeg",
        )

        response = self.client.post(
            "/api/listing-images/",
            {"listing": self.listing.id, "images": [upload]},
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        stored = ListingImage.objects.get()
        self.assertTrue(stored.image.name.endswith(".jpg"))
        with Image.open(stored.image.path) as optimized:
            self.assertEqual(optimized.format, "JPEG")
            self.assertEqual(optimized.size, (1920, 1280))


class PaymentFoundationTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.host = User.objects.create_user(
            username="pfhost",
            email="pfhost@example.com",
            password="pass12345",
            is_host=True,
        )
        self.guest = User.objects.create_user(
            username="pfguest",
            email="pfguest@example.com",
            password="pass12345",
        )
        self.category = Category.objects.create(name="Ger")
        self.listing = Listing.objects.create(
            host=self.host,
            category=self.category,
            title="Payment foundation listing",
            description="A listing used for payment foundation tests",
            price_per_night=100000,
            max_guests=2,
            beds=1,
            location_city="Ulaanbaatar",
            location_district="Sukhbaatar",
            status=Listing.STATUS_ACTIVE,
        )

    def test_booking_defaults_to_confirmed_for_current_checkout_flow(self):
        booking = Booking.objects.create(
            listing=self.listing,
            guest=self.guest,
            check_in=date.today() + timedelta(days=1),
            check_out=date.today() + timedelta(days=2),
            full_name="Payment Guest",
            phone_number="99001122",
            guest_count=1,
            total_price=100000,
            service_fee=10000,
        )

        self.assertEqual(booking.status, "confirmed")

    def test_payment_record_tracks_invoice_state(self):
        booking = Booking.objects.create(
            listing=self.listing,
            guest=self.guest,
            check_in=date.today() + timedelta(days=1),
            check_out=date.today() + timedelta(days=2),
            full_name="Payment Guest",
            phone_number="99001122",
            guest_count=1,
        )

        payment = Payment.objects.create(
            booking=booking,
            provider=Payment.PROVIDER_QPAY,
            sender_invoice_no="booking-1-test",
            invoice_id="qpay-invoice-1",
            amount=110000,
            raw_response={"invoice_id": "qpay-invoice-1"},
        )

        self.assertEqual(payment.status, Payment.STATUS_PENDING)
        self.assertEqual(payment.currency, "MNT")
        self.assertEqual(booking.payments.get(), payment)

    def test_availability_is_unique_per_listing_date(self):
        target_date = date.today() + timedelta(days=1)
        Availability.objects.create(listing=self.listing, date=target_date)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Availability.objects.create(listing=self.listing, date=target_date)


@override_settings(DEBUG=True)
class BookingCreateRegressionTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.host = User.objects.create_user(
            username="bookinghost",
            email="bookinghost@example.com",
            password="pass12345",
            is_host=True,
        )
        self.guest = User.objects.create_user(
            username="bookingguest",
            email="bookingguest@example.com",
            password="pass12345",
        )
        self.category = Category.objects.create(name="Cabin")
        self.listing = Listing.objects.create(
            host=self.host,
            category=self.category,
            title="Bookable listing",
            description="A listing used for booking regression tests",
            price_per_night=100000,
            max_guests=2,
            beds=1,
            location_city="Ulaanbaatar",
            location_district="Sukhbaatar",
            status=Listing.STATUS_ACTIVE,
        )
        self.check_in = date.today() + timedelta(days=1)
        self.check_out = date.today() + timedelta(days=3)
        current = self.check_in
        while current < self.check_out:
            Availability.objects.create(listing=self.listing, date=current)
            current += timedelta(days=1)

    def test_current_checkout_flow_creates_confirmed_booking(self):
        client = APIClient()
        client.force_authenticate(user=self.guest)

        response = client.post(
            "/api/bookings/",
            {
                "listing_id": self.listing.id,
                "check_in": self.check_in.isoformat(),
                "check_out": self.check_out.isoformat(),
                "full_name": "Booking Guest",
                "phone_number": "99001122",
                "guest_count": 1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        booking = Booking.objects.get(id=response.data["id"])
        self.assertEqual(booking.status, "confirmed")
        self.assertEqual(booking.total_price, 200000)
        self.assertEqual(booking.service_fee, 20000)
        self.assertFalse(
            Availability.objects.filter(
                listing=self.listing,
                date__gte=self.check_in,
                date__lt=self.check_out,
            ).exists()
        )


@override_settings(DEBUG=True)
class PaymentApiSkeletonTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.host = User.objects.create_user(
            username="payhost",
            email="payhost@example.com",
            password="pass12345",
            is_host=True,
        )
        self.guest = User.objects.create_user(
            username="payguest",
            email="payguest@example.com",
            password="pass12345",
        )
        self.other_guest = User.objects.create_user(
            username="otherpayguest",
            email="otherpayguest@example.com",
            password="pass12345",
        )
        self.admin_user = User.objects.create_user(
            username="payadmin",
            email="payadmin@example.com",
            password="pass12345",
            is_staff=True,
        )
        self.category = Category.objects.create(name="Payment cabin")
        self.listing = Listing.objects.create(
            host=self.host,
            category=self.category,
            title="Payment API listing",
            description="A listing used for payment API tests",
            price_per_night=100000,
            max_guests=2,
            beds=1,
            location_city="Ulaanbaatar",
            location_district="Sukhbaatar",
            status=Listing.STATUS_ACTIVE,
        )
        self.check_in = date.today() + timedelta(days=1)
        self.check_out = date.today() + timedelta(days=3)
        current = self.check_in
        while current < self.check_out:
            Availability.objects.create(listing=self.listing, date=current)
            current += timedelta(days=1)
        self.client = APIClient()
        self.client.force_authenticate(user=self.guest)

    def _payment_intent_payload(self):
        return {
            "listing_id": self.listing.id,
            "check_in": self.check_in.isoformat(),
            "check_out": self.check_out.isoformat(),
            "full_name": "Payment Guest",
            "phone_number": "99001122",
            "guest_count": 1,
        }

    def _create_pending_booking(self):
        response = self.client.post(
            "/api/bookings/payment-intent/",
            self._payment_intent_payload(),
            format="json",
            HTTP_X_IDEMPOTENCY_KEY="intent-key-1",
        )
        self.assertEqual(response.status_code, 201)
        return Booking.objects.get(id=response.data["booking"]["id"])

    def test_payment_intent_creates_pending_booking_and_holds_availability(self):
        booking = self._create_pending_booking()

        self.assertEqual(booking.status, "pending_payment")
        self.assertEqual(booking.total_price, 200000)
        self.assertEqual(booking.service_fee, 20000)
        self.assertEqual(booking.payment_intent_key, "intent-key-1")
        self.assertIsNotNone(booking.hold_expires_at)
        self.assertGreater(booking.hold_expires_at, timezone.now())
        self.assertEqual(
            Availability.objects.filter(
                listing=self.listing,
                date__gte=self.check_in,
                date__lt=self.check_out,
            ).count(),
            0,
        )
        self.assertEqual(
            BookingHold.objects.filter(
                booking=booking,
                listing=self.listing,
                date__gte=self.check_in,
                date__lt=self.check_out,
            ).count(),
            2,
        )

    def test_payment_intent_is_idempotent_for_same_user_and_key(self):
        first = self.client.post(
            "/api/bookings/payment-intent/",
            self._payment_intent_payload(),
            format="json",
            HTTP_X_IDEMPOTENCY_KEY="same-key",
        )
        second = self.client.post(
            "/api/bookings/payment-intent/",
            self._payment_intent_payload(),
            format="json",
            HTTP_X_IDEMPOTENCY_KEY="same-key",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["booking"]["id"], second.data["booking"]["id"])
        self.assertEqual(Booking.objects.count(), 1)

    def test_payment_create_returns_mock_invoice_and_is_retrievable(self):
        booking = self._create_pending_booking()

        response = self.client.post(
            "/api/payments/",
            {"booking_id": booking.id},
            format="json",
            HTTP_X_IDEMPOTENCY_KEY="payment-key-1",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["booking_id"], booking.id)
        self.assertEqual(response.data["booking_status"], "pending_payment")
        self.assertEqual(response.data["status"], Payment.STATUS_PENDING)
        self.assertEqual(response.data["amount"], 220000)
        self.assertEqual(response.data["idempotency_key"], "payment-key-1")

        detail = self.client.get(f"/api/payments/{response.data['id']}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["id"], response.data["id"])

    @override_settings(QPAY_ENABLED=True)
    def test_payment_create_uses_qpay_invoice_when_enabled(self):
        booking = self._create_pending_booking()

        with patch("core.views.QPayClient") as qpay_client_class:
            qpay_client_class.return_value.create_invoice.return_value = {
                "invoice_id": "real-qpay-invoice-1",
                "qr_text": "qr-text",
                "urls": [{"name": "bank", "link": "bank://pay"}],
            }

            response = self.client.post(
                "/api/payments/",
                {"booking_id": booking.id},
                format="json",
                HTTP_X_IDEMPOTENCY_KEY="qpay-payment-key-1",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["invoice_id"], "real-qpay-invoice-1")
        self.assertEqual(response.data["raw_response"]["qr_text"], "qr-text")
        qpay_client_class.return_value.create_invoice.assert_called_once()
        call_kwargs = qpay_client_class.return_value.create_invoice.call_args.kwargs
        self.assertEqual(call_kwargs["amount"], 220000)
        self.assertIn(str(booking.id), call_kwargs["description"])

    def test_other_user_cannot_create_payment_for_booking(self):
        booking = self._create_pending_booking()
        other_client = APIClient()
        other_client.force_authenticate(user=self.other_guest)

        response = other_client.post(
            "/api/payments/",
            {"booking_id": booking.id},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(Payment.objects.count(), 0)

    def test_mock_confirm_marks_payment_paid_confirms_booking_and_closes_availability(self):
        booking = self._create_pending_booking()
        payment_response = self.client.post(
            "/api/payments/", {"booking_id": booking.id}, format="json"
        )

        confirm = self.client.post(
            f"/api/payments/{payment_response.data['id']}/mock-confirm/"
        )

        self.assertEqual(confirm.status_code, 200)
        booking.refresh_from_db()
        payment = Payment.objects.get(id=payment_response.data["id"])
        self.assertEqual(booking.status, "confirmed")
        self.assertEqual(payment.status, Payment.STATUS_PAID)
        self.assertIsNotNone(payment.paid_at)
        self.assertFalse(
            Availability.objects.filter(
                listing=self.listing,
                date__gte=self.check_in,
                date__lt=self.check_out,
            ).exists()
        )

    def test_mock_confirm_fails_when_hold_is_missing(self):
        booking = self._create_pending_booking()
        payment_response = self.client.post(
            "/api/payments/", {"booking_id": booking.id}, format="json"
        )
        BookingHold.objects.filter(booking=booking).delete()

        confirm = self.client.post(
            f"/api/payments/{payment_response.data['id']}/mock-confirm/"
        )

        self.assertEqual(confirm.status_code, 409)
        booking.refresh_from_db()
        payment = Payment.objects.get(id=payment_response.data["id"])
        self.assertEqual(booking.status, "payment_failed")
        self.assertEqual(payment.status, Payment.STATUS_FAILED)

    @override_settings(QPAY_ENABLED=True)
    def test_payment_check_confirms_paid_qpay_payment_for_owner(self):
        booking = self._create_pending_booking()
        payment = Payment.objects.create(
            booking=booking,
            provider=Payment.PROVIDER_QPAY,
            sender_invoice_no="manual-check-paid-test",
            invoice_id="qpay-manual-check-paid",
            amount=booking.total_price + booking.service_fee,
        )

        with patch("core.views.QPayClient") as qpay_client_class, patch(
            "core.views.send_notification_email"
        ) as send_email:
            qpay_client_class.return_value.check_payment.return_value = {
                "count": 1,
                "rows": [{
                    "payment_id": "payment-manual",
                    "payment_status": "PAID",
                    "payment_amount": str(payment.amount),
                    "payment_currency": "MNT",
                }],
            }
            response = self.client.post(f"/api/payments/{payment.id}/check/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["booking_status"], "confirmed")
        self.assertEqual(response.data["status"], Payment.STATUS_PAID)
        booking.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(booking.status, "confirmed")
        self.assertEqual(payment.status, Payment.STATUS_PAID)
        self.assertTrue(
            Notification.objects.filter(
                user=self.host,
                type="booking_created",
                related_booking=booking,
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.guest,
                type="booking_confirmed",
                related_booking=booking,
            ).exists()
        )
        admin_notification = Notification.objects.get(
            user=self.admin_user,
            type="admin_booking",
            related_booking=booking,
        )
        self.assertIn(str(booking.id), admin_notification.message)
        self.assertIn(self.listing.title, admin_notification.message)
        self.assertIn("Payment", admin_notification.message)
        host_notification = Notification.objects.get(
            user=self.host,
            type="booking_created",
            related_booking=booking,
        )
        guest_notification = Notification.objects.get(
            user=self.guest,
            type="booking_confirmed",
            related_booking=booking,
        )
        self.assertNotEqual(host_notification.message, guest_notification.message)
        self.assertNotEqual(host_notification.message, admin_notification.message)
        self.assertNotEqual(guest_notification.message, admin_notification.message)
        self.assertEqual(send_email.call_count, 3)
        sent_users = {call.kwargs["user"] for call in send_email.call_args_list}
        self.assertEqual(sent_users, {self.host, self.guest, self.admin_user})
        notif_types = {call.kwargs["notif_type"] for call in send_email.call_args_list}
        self.assertEqual(
            notif_types,
            {"booking_created", "booking_confirmed", "admin_booking_confirmed"},
        )
        self.assertEqual(BookingHold.objects.filter(booking=booking).count(), 0)

    @override_settings(QPAY_ENABLED=True)
    def test_payment_check_pending_does_not_confirm(self):
        booking = self._create_pending_booking()
        payment = Payment.objects.create(
            booking=booking,
            provider=Payment.PROVIDER_QPAY,
            sender_invoice_no="manual-check-pending-test",
            invoice_id="qpay-manual-check-pending",
            amount=booking.total_price + booking.service_fee,
        )

        with patch("core.views.QPayClient") as qpay_client_class:
            qpay_client_class.return_value.check_payment.return_value = {
                "count": 0,
                "rows": [],
            }
            response = self.client.post(f"/api/payments/{payment.id}/check/")

        self.assertEqual(response.status_code, 200)
        booking.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(booking.status, "pending_payment")
        self.assertEqual(payment.status, Payment.STATUS_PENDING)
        self.assertEqual(BookingHold.objects.filter(booking=booking).count(), 2)

    @override_settings(QPAY_ENABLED=True)
    def test_payment_check_rejects_wrong_amount_or_currency(self):
        booking = self._create_pending_booking()
        payment = Payment.objects.create(
            booking=booking,
            provider=Payment.PROVIDER_QPAY,
            sender_invoice_no="manual-check-mismatch-test",
            invoice_id="qpay-manual-check-mismatch",
            amount=booking.total_price + booking.service_fee,
        )

        mismatches = [
            {
                "payment_status": "PAID",
                "payment_amount": str(payment.amount - 1),
                "payment_currency": "MNT",
            },
            {
                "payment_status": "PAID",
                "payment_amount": str(payment.amount),
                "payment_currency": "USD",
            },
            {
                "payment_status": "PENDING",
                "payment_amount": str(payment.amount),
                "payment_currency": "MNT",
            },
        ]

        with patch("core.views.QPayClient") as qpay_client_class:
            for row in mismatches:
                with self.subTest(row=row):
                    qpay_client_class.return_value.check_payment.return_value = {
                        "count": 1,
                        "rows": [{"payment_id": "mismatch", **row}],
                    }
                    response = self.client.post(f"/api/payments/{payment.id}/check/")
                    self.assertEqual(response.status_code, 200)
                    payment.refresh_from_db()
                    booking.refresh_from_db()
                    self.assertEqual(payment.status, Payment.STATUS_PENDING)
                    self.assertEqual(booking.status, "pending_payment")

    def test_other_user_cannot_check_payment(self):
        booking = self._create_pending_booking()
        payment = Payment.objects.create(
            booking=booking,
            provider=Payment.PROVIDER_QPAY,
            sender_invoice_no="manual-check-other-user-test",
            invoice_id="qpay-manual-check-other-user",
            amount=booking.total_price + booking.service_fee,
        )
        other_client = APIClient()
        other_client.force_authenticate(user=self.other_guest)

        response = other_client.post(f"/api/payments/{payment.id}/check/")

        self.assertEqual(response.status_code, 404)
        booking.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(booking.status, "pending_payment")
        self.assertEqual(payment.status, Payment.STATUS_PENDING)

    @override_settings(QPAY_ENABLED=True)
    def test_qpay_callback_confirms_paid_payment(self):
        booking = self._create_pending_booking()
        payment = Payment.objects.create(
            booking=booking,
            provider=Payment.PROVIDER_QPAY,
            sender_invoice_no="callback-paid-test",
            invoice_id="qpay-callback-paid",
            amount=booking.total_price + booking.service_fee,
        )

        with patch("core.views.QPayClient") as qpay_client_class:
            qpay_client_class.return_value.check_payment.return_value = {
                "count": 1,
                "rows": [{
                    "payment_id": "payment-1",
                    "payment_status": "PAID",
                    "payment_amount": str(payment.amount),
                    "payment_currency": "MNT",
                }],
            }
            response = APIClient().post(
                "/api/payments/qpay/callback/",
                {"invoice_id": payment.invoice_id},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        booking.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(booking.status, "confirmed")
        self.assertEqual(payment.status, Payment.STATUS_PAID)
        self.assertIsNotNone(payment.paid_at)
        self.assertEqual(BookingHold.objects.filter(booking=booking).count(), 0)

    @override_settings(QPAY_ENABLED=True)
    def test_qpay_callback_maps_provider_payment_id_using_sender_invoice_query(self):
        booking = self._create_pending_booking()
        payment = Payment.objects.create(
            booking=booking,
            provider=Payment.PROVIDER_QPAY,
            sender_invoice_no="callback-sender-query-test",
            invoice_id="qpay-callback-sender-query",
            amount=booking.total_price + booking.service_fee,
        )

        with patch("core.views.QPayClient") as qpay_client_class:
            qpay_client_class.return_value.check_payment.return_value = {
                "count": 1,
                "rows": [{
                    "payment_id": "provider-payment-id",
                    "payment_status": "PAID",
                    "payment_amount": str(payment.amount),
                    "payment_currency": "MNT",
                }],
            }
            response = APIClient().post(
                (
                    "/api/payments/qpay/callback/"
                    f"?sender_invoice_no={payment.sender_invoice_no}"
                ),
                {"payment_id": "provider-payment-id"},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        qpay_client_class.return_value.check_payment.assert_called_once_with(
            invoice_id=payment.invoice_id
        )
        payment.refresh_from_db()
        booking.refresh_from_db()
        self.assertEqual(payment.status, Payment.STATUS_PAID)
        self.assertEqual(booking.status, "confirmed")

    @override_settings(QPAY_ENABLED=True)
    def test_qpay_get_callback_confirms_payment_from_real_provider_shape(self):
        booking = self._create_pending_booking()
        payment = Payment.objects.create(
            booking=booking,
            provider=Payment.PROVIDER_QPAY,
            sender_invoice_no="callback-get-test",
            invoice_id="qpay-callback-get",
            amount=booking.total_price + booking.service_fee,
        )

        with patch("core.views.QPayClient") as qpay_client_class:
            qpay_client_class.return_value.check_payment.return_value = {
                "count": 1,
                "rows": [{
                    "payment_id": "provider-payment-id",
                    "payment_status": "PAID",
                    "payment_amount": str(payment.amount),
                    "payment_currency": "MNT",
                }],
            }
            response = APIClient().get(
                (
                    "/api/payments/qpay/callback/"
                    f"?sender_invoice_no={payment.sender_invoice_no}"
                    "&qpay_payment_id=provider-payment-id"
                )
            )

        self.assertEqual(response.status_code, 200)
        qpay_client_class.return_value.check_payment.assert_called_once_with(
            invoice_id=payment.invoice_id
        )
        payment.refresh_from_db()
        booking.refresh_from_db()
        self.assertEqual(payment.status, Payment.STATUS_PAID)
        self.assertEqual(booking.status, "confirmed")
        self.assertEqual(
            payment.raw_response["qpay_check"]["callback"]["qpay_payment_id"],
            "provider-payment-id",
        )

    @override_settings(QPAY_ENABLED=True)
    def test_unknown_qpay_callback_does_not_call_provider(self):
        with patch("core.views.QPayClient") as qpay_client_class:
            response = APIClient().post(
                "/api/payments/qpay/callback/?sender_invoice_no=unknown",
                {"payment_id": "provider-payment-id"},
                format="json",
            )

        self.assertEqual(response.status_code, 404)
        qpay_client_class.assert_not_called()

    @override_settings(QPAY_ENABLED=True)
    def test_qpay_callback_pending_check_does_not_confirm(self):
        booking = self._create_pending_booking()
        payment = Payment.objects.create(
            booking=booking,
            provider=Payment.PROVIDER_QPAY,
            sender_invoice_no="callback-pending-test",
            invoice_id="qpay-callback-pending",
            amount=booking.total_price + booking.service_fee,
        )

        with patch("core.views.QPayClient") as qpay_client_class:
            qpay_client_class.return_value.check_payment.return_value = {
                "count": 0,
                "rows": [],
            }
            response = APIClient().post(
                "/api/payments/qpay/callback/",
                {"invoice_id": payment.invoice_id},
                format="json",
            )

        self.assertEqual(response.status_code, 202)
        booking.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(booking.status, "pending_payment")
        self.assertEqual(payment.status, Payment.STATUS_PENDING)
        self.assertEqual(BookingHold.objects.filter(booking=booking).count(), 2)

    @override_settings(QPAY_ENABLED=True)
    def test_qpay_callback_is_idempotent_after_payment_confirmed(self):
        booking = self._create_pending_booking()
        payment = Payment.objects.create(
            booking=booking,
            provider=Payment.PROVIDER_QPAY,
            sender_invoice_no="callback-duplicate-test",
            invoice_id="qpay-callback-duplicate",
            amount=booking.total_price + booking.service_fee,
        )

        with patch("core.views.QPayClient") as qpay_client_class:
            qpay_client_class.return_value.check_payment.return_value = {
                "count": 1,
                "rows": [{
                    "payment_id": "payment-duplicate",
                    "payment_status": "PAID",
                    "payment_amount": str(payment.amount),
                    "payment_currency": "MNT",
                }],
            }
            first = APIClient().post(
                "/api/payments/qpay/callback/",
                {"invoice_id": payment.invoice_id},
                format="json",
            )
            second = APIClient().post(
                "/api/payments/qpay/callback/",
                {"invoice_id": payment.invoice_id},
                format="json",
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        qpay_client_class.return_value.check_payment.assert_called_once_with(
            invoice_id=payment.invoice_id
        )
        booking.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(booking.status, "confirmed")
        self.assertEqual(payment.status, Payment.STATUS_PAID)

    @override_settings(QPAY_ENABLED=True)
    def test_expired_payment_hold_is_released_and_invoice_is_cancelled(self):
        booking = self._create_pending_booking()
        payment = Payment.objects.create(
            booking=booking,
            provider=Payment.PROVIDER_QPAY,
            sender_invoice_no="expired-hold-test",
            invoice_id="qpay-expired-hold-test",
            amount=booking.total_price + booking.service_fee,
        )
        booking.hold_expires_at = timezone.now() - timedelta(minutes=1)
        booking.save(update_fields=["hold_expires_at"])

        with patch("core.views.QPayClient") as qpay_client_class:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.get(f"/api/payments/{payment.id}/")

        self.assertEqual(response.status_code, 200)
        qpay_client_class.return_value.cancel_invoice.assert_called_once_with(
            invoice_id=payment.invoice_id
        )
        booking.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(booking.status, "expired")
        self.assertEqual(payment.status, Payment.STATUS_EXPIRED)
        self.assertTrue(payment.raw_response["qpay_invoice_cancelled"])
        self.assertEqual(BookingHold.objects.filter(booking=booking).count(), 0)
        self.assertEqual(
            Availability.objects.filter(
                listing=self.listing,
                date__gte=self.check_in,
                date__lt=self.check_out,
            ).count(),
            2,
        )
