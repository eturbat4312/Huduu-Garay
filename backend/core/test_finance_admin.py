from datetime import date, datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from core.models import (
    Booking,
    FinancialAuditLog,
    GuestRefund,
    HostApplication,
    HostPayout,
    Listing,
    Payment,
    PlatformAnalyticsEvent,
)
from core.services.booking_times import check_in_at, check_out_at, payout_eligible_at
from core.services.settlements import ensure_host_payout, sync_cancellation_settlements


User = get_user_model()


class BookingTimeTests(TestCase):
    def test_platform_times_and_payout_deadline_are_exact(self):
        target_date = date(2030, 6, 10)

        self.assertEqual(check_in_at(target_date).hour, 14)
        self.assertEqual(check_out_at(target_date).hour, 12)
        self.assertEqual(
            payout_eligible_at(target_date) - check_out_at(target_date),
            timedelta(hours=72),
        )
        self.assertEqual(check_out_at(target_date).utcoffset(), timedelta(hours=8))


class PaymentFeeTests(TestCase):
    def setUp(self):
        host = User.objects.create_user(username="fee_host", is_host=True)
        guest = User.objects.create_user(username="fee_guest")
        listing = Listing.objects.create(
            host=host,
            title="QPay шимтгэлийн туршилт",
            price_per_night=100000,
        )
        self.booking = Booking.objects.create(
            listing=listing,
            guest=guest,
            check_in=date(2030, 1, 1),
            check_out=date(2030, 1, 2),
            total_price=200000,
            service_fee=20000,
            status="pending_payment",
        )

    def test_qpay_fee_is_recorded_when_payment_becomes_paid(self):
        payment = Payment.objects.create(
            booking=self.booking,
            amount=220000,
            sender_invoice_no="fee-pending",
            status=Payment.STATUS_PENDING,
        )
        self.assertEqual(payment.provider_fee_amount, 0)

        payment.status = Payment.STATUS_PAID
        payment.save(update_fields=["status", "updated_at"])
        payment.refresh_from_db()

        self.assertEqual(payment.provider_fee_rate, Payment.QPAY_FEE_RATE)
        self.assertEqual(payment.provider_fee_amount, 2200)
        self.assertEqual(payment.net_received_amount, 217800)

    def test_qpay_fee_rounds_each_transaction_to_whole_mnt(self):
        payment = Payment.objects.create(
            booking=self.booking,
            amount=151,
            sender_invoice_no="fee-rounding",
            status=Payment.STATUS_PAID,
        )

        self.assertEqual(payment.provider_fee_amount, 2)
        self.assertEqual(payment.net_received_amount, 149)


class AnalyticsTests(TestCase):
    def test_web_event_is_hashed_and_idempotent(self):
        event_id = str(uuid4())
        payload = {
            "event_id": event_id,
            "event_type": "web_page_view",
            "visitor_id": "visitor-12345678",
            "session_id": "session-12345678",
            "path": "/mn/listings/1",
            "platform": "web",
        }

        created = self.client.post(
            "/api/analytics/events/", payload, content_type="application/json"
        )
        repeated = self.client.post(
            "/api/analytics/events/", payload, content_type="application/json"
        )

        self.assertEqual(created.status_code, 201)
        self.assertEqual(repeated.status_code, 200)
        event = PlatformAnalyticsEvent.objects.get()
        self.assertNotEqual(event.visitor_hash, payload["visitor_id"])
        self.assertNotEqual(event.session_hash, payload["session_id"])
        self.assertEqual(event.path, payload["path"])

    def test_app_install_is_counted_once_per_installation(self):
        base = {
            "event_type": "app_install",
            "visitor_id": "installation-12345678",
            "session_id": "session-12345678",
            "platform": "ios",
            "app_version": "1.0.0",
        }

        first = self.client.post(
            "/api/analytics/events/",
            {**base, "event_id": str(uuid4())},
            content_type="application/json",
        )
        second = self.client.post(
            "/api/analytics/events/",
            {**base, "event_id": str(uuid4())},
            content_type="application/json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(
            PlatformAnalyticsEvent.objects.filter(event_type="app_install").count(), 1
        )

    def test_admin_home_shows_daily_analytics_and_period_controls(self):
        staff = User.objects.create_user(
            username="analytics_staff",
            password="pass",
            is_staff=True,
            is_superuser=True,
        )
        PlatformAnalyticsEvent.objects.create(
            event_id=uuid4(),
            event_type="web_page_view",
            visitor_hash="visitor-a",
            session_hash="session-a",
            path="/mn",
            platform="web",
        )
        PlatformAnalyticsEvent.objects.create(
            event_id=uuid4(),
            event_type="web_page_view",
            visitor_hash="visitor-a",
            session_hash="session-a",
            path="/mn/listings",
            platform="web",
        )
        PlatformAnalyticsEvent.objects.create(
            event_id=uuid4(),
            event_type="app_install",
            visitor_hash="install-a",
            session_hash="app-session-a",
            platform="android",
        )
        self.client.force_login(staff)

        response = self.client.get(
            "/admin/",
            {"overview_period": "today", "group_by": "day", "overview_order": "asc"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["period_page_views"], 2)
        self.assertEqual(response.context["period_unique_visitors"], 1)
        self.assertEqual(response.context["period_app_installs"], 1)
        self.assertEqual(len(response.context["overview_rows"]), 1)
        self.assertContains(response, "Өдрөөр")
        self.assertContains(response, "Аппын анхны нээлт")

    def test_admin_home_groups_the_year_by_month_and_keeps_model_admin_routes(self):
        staff = User.objects.create_user(
            username="monthly_analytics_staff",
            password="pass",
            is_staff=True,
            is_superuser=True,
        )
        PlatformAnalyticsEvent.objects.create(
            event_id=uuid4(),
            event_type="app_open",
            visitor_hash="monthly-installation",
            session_hash="monthly-session",
            platform="ios",
        )
        self.client.force_login(staff)

        response = self.client.get(
            "/admin/",
            {"overview_period": "year", "group_by": "month", "overview_order": "asc"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["overview"]["group_by"], "month")
        self.assertEqual(response.context["overview_rows"][0]["label"][-3:], "/01")
        self.assertEqual(
            sum(row["app_opens"] for row in response.context["overview_rows"]), 1
        )
        self.assertContains(response, "Сараар")

        model_admin = self.client.get("/admin/core/platformanalyticsevent/")
        self.assertEqual(model_admin.status_code, 200)


class SettlementServiceTests(TestCase):
    def setUp(self):
        self.now = datetime(2030, 6, 1, 4, tzinfo=dt_timezone.utc)
        self.host = User.objects.create_user(username="finance_host", is_host=True)
        self.guest = User.objects.create_user(username="finance_guest")
        self.listing = Listing.objects.create(
            host=self.host,
            title="Санхүүгийн туршилтын байр",
            price_per_night=100000,
            location_city="Улаанбаатар",
            location_district="Сүхбаатар",
        )
        with patch("core.models.send_notification_email"):
            HostApplication.objects.create(
                user=self.host,
                full_name="Бат Түрээслүүлэгч",
                phone_number="99112233",
                bank_name="Хаан Банк",
                account_number="5000000000",
                id_card_image="id_cards/test.jpg",
                selfie_with_id="selfies/test.jpg",
                status="approved",
                host_commission_rate="10.00",
            )

    def create_paid_booking(self, suffix="one"):
        booking = Booking.objects.create(
            listing=self.listing,
            guest=self.guest,
            check_in=date(2030, 6, 5),
            check_out=date(2030, 6, 7),
            full_name="Туршилтын зочин",
            phone_number="99001122",
            total_price=200000,
            service_fee=20000,
            status="confirmed",
        )
        Payment.objects.create(
            booking=booking,
            amount=220000,
            sender_invoice_no=f"finance-{suffix}",
            status=Payment.STATUS_PAID,
            paid_at=self.now,
        )
        return booking

    def test_payout_snapshot_is_idempotent_and_uses_checkout_plus_72_hours(self):
        booking = self.create_paid_booking()

        payout, created = ensure_host_payout(booking)
        same_payout, created_again = ensure_host_payout(booking)

        self.assertTrue(created)
        self.assertFalse(created_again)
        self.assertEqual(payout.pk, same_payout.pk)
        self.assertEqual(payout.gross_amount, 200000)
        self.assertEqual(payout.commission_amount, 20000)
        self.assertEqual(payout.net_amount, 180000)
        self.assertEqual(payout.bank_name, "Хаан Банк")
        self.assertEqual(payout.account_number, "5000000000")
        self.assertEqual(payout.eligible_at, payout_eligible_at(booking.check_out))
        self.assertEqual(HostPayout.objects.filter(booking=booking).count(), 1)
        self.assertEqual(FinancialAuditLog.objects.filter(host_payout=payout).count(), 1)

    def test_host_cancellation_creates_full_approved_refund_and_no_payout(self):
        booking = self.create_paid_booking("host-cancel")
        booking.status = "cancelled"
        booking.is_cancelled_by_host = True
        booking.host_cancelled_at = self.now
        booking.save(update_fields=["status", "is_cancelled_by_host", "host_cancelled_at"])

        payout, refund = sync_cancellation_settlements(booking)

        self.assertEqual(payout.status, HostPayout.STATUS_NOT_PAYABLE)
        self.assertEqual(payout.net_amount, 0)
        self.assertEqual(refund.reason, GuestRefund.REASON_HOST_CANCELLED)
        self.assertEqual(refund.status, GuestRefund.STATUS_APPROVED)
        self.assertEqual(refund.received_amount, 220000)
        self.assertEqual(refund.approved_amount, 220000)

    def test_guest_cancellation_before_48_hours_suggests_full_manual_refund(self):
        booking = self.create_paid_booking("guest-cancel")
        booking.status = "cancelled"
        booking.guest_cancelled_at = check_in_at(booking.check_in) - timedelta(hours=60)
        booking.save(update_fields=["status", "guest_cancelled_at"])

        payout, refund = sync_cancellation_settlements(booking)

        self.assertEqual(payout.status, HostPayout.STATUS_REVIEW)
        self.assertEqual(refund.status, GuestRefund.STATUS_REVIEW)
        self.assertEqual(refund.suggested_amount, 220000)
        self.assertEqual(refund.approved_amount, 0)


class FinanceAdminTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username="finance_staff", password="pass", is_staff=True, is_superuser=True
        )
        self.host = User.objects.create_user(
            username="admin_finance_host",
            full_name="Админ Түрээслүүлэгч",
            is_host=True,
        )
        self.guest = User.objects.create_user(username="admin_finance_guest")
        self.listing = Listing.objects.create(
            host=self.host,
            title="Төв талбайн байр",
            price_per_night=150000,
            location_city="Улаанбаатар",
            location_district="Сүхбаатар",
            location_khoroo="1-р хороо",
            location_extra="Төв талбайн зүүн тал",
            location_building="А байр",
            location_apartment="1201",
        )
        self.booking = Booking.objects.create(
            listing=self.listing,
            guest=self.guest,
            check_in=date(2030, 7, 1),
            check_out=date(2030, 7, 4),
            full_name="Нэрээр хайх зочин",
            phone_number="99887766",
            total_price=450000,
            service_fee=45000,
            status="confirmed",
        )
        Payment.objects.create(
            booking=self.booking,
            amount=495000,
            sender_invoice_no="admin-finance-payment",
            status=Payment.STATUS_PAID,
            paid_at=timezone.now(),
        )
        self.payout, _ = ensure_host_payout(self.booking)
        self.payout.bank_name = "Хаан Банк"
        self.payout.account_number = "5000000000"
        self.payout.account_holder_name = "Админ Түрээслүүлэгч"
        self.payout.status = HostPayout.STATUS_PENDING
        self.payout.save(
            update_fields=[
                "bank_name",
                "account_number",
                "account_holder_name",
                "status",
            ]
        )
        self.client.force_login(self.staff)

    def test_dashboard_supports_search_filters_and_sorting(self):
        response = self.client.get(
            "/admin/stats/",
            {
                "q": "Нэрээр хайх",
                "status": "confirmed",
                "sort": "duration_desc",
                "date_from": "2030-07-01",
                "date_to": "2030-07-04",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Нэрээр хайх зочин")
        self.assertContains(response, "Төв талбайн байр")
        self.assertContains(response, "Сүхбаатар")
        self.assertContains(response, "3 хоног")
        self.assertContains(response, "14:00")
        self.assertContains(response, "12:00")
        self.assertContains(response, "Админ Түрээслүүлэгч")
        self.assertEqual(response.context["total_received"], 495000)
        self.assertEqual(response.context["qpay_fees"], 4950)
        self.assertEqual(response.context["net_received"], 490050)
        self.assertEqual(response.context["book_cash_balance"], 490050)

    def test_amount_sort_uses_received_payment_not_unpaid_booking_total(self):
        unpaid_booking = Booking.objects.create(
            listing=self.listing,
            guest=self.guest,
            check_in=date(2030, 8, 1),
            check_out=date(2030, 8, 3),
            full_name="Төлбөргүй өндөр дүн",
            phone_number="99000000",
            total_price=999999,
            service_fee=99999,
            status="pending_payment",
        )

        response = self.client.get("/admin/stats/", {"sort": "amount_desc"})

        self.assertEqual(response.status_code, 200)
        rows = response.context["booking_rows"]
        self.assertEqual(rows[0]["booking"], self.booking)
        self.assertEqual(rows[-1]["booking"], unpaid_booking)

    def test_booking_detail_contains_finance_address_and_audit_data(self):
        response = self.client.get(f"/admin/stats/bookings/{self.booking.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "99887766")
        self.assertContains(response, "А байр")
        self.assertContains(response, "1201")
        self.assertContains(response, "₮405000")
        self.assertContains(response, "₮4950 (1.00%)")
        self.assertContains(response, "₮490050")
        self.assertContains(response, "payout_created")

    def test_non_staff_cannot_open_finance_pages(self):
        self.client.force_login(self.guest)

        dashboard = self.client.get("/admin/stats/")
        detail = self.client.get(f"/admin/stats/bookings/{self.booking.id}/")

        self.assertEqual(dashboard.status_code, 302)
        self.assertEqual(detail.status_code, 302)

    def test_payout_cannot_be_marked_paid_before_72_hours(self):
        response = self.client.post(
            f"/admin/core/hostpayout/{self.payout.id}/change/",
            {
                "status": HostPayout.STATUS_PAID,
                "adjustment_amount": 0,
                "hold_reason": "",
                "notes": "",
                "bank_name": self.payout.bank_name,
                "account_number": self.payout.account_number,
                "account_holder_name": self.payout.account_holder_name,
                "transfer_reference": "BANK-001",
                "_save": "Хадгалах",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, HostPayout.STATUS_PENDING)
        self.assertContains(response, "72 цаг дуусаагүй")

    def test_paid_payout_records_actor_time_reference_and_audit(self):
        self.payout.eligible_at = timezone.now() - timedelta(minutes=1)
        self.payout.save(update_fields=["eligible_at"])

        response = self.client.post(
            f"/admin/core/hostpayout/{self.payout.id}/change/",
            {
                "status": HostPayout.STATUS_PAID,
                "adjustment_amount": 0,
                "hold_reason": "",
                "notes": "Банкны хуулгатай тулгав.",
                "bank_name": self.payout.bank_name,
                "account_number": self.payout.account_number,
                "account_holder_name": self.payout.account_holder_name,
                "transfer_reference": "BANK-002",
                "_save": "Хадгалах",
            },
        )

        self.assertEqual(response.status_code, 302)
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, HostPayout.STATUS_PAID)
        self.assertEqual(self.payout.paid_by, self.staff)
        self.assertIsNotNone(self.payout.paid_at)
        self.assertEqual(self.payout.transfer_reference, "BANK-002")
        self.assertTrue(
            FinancialAuditLog.objects.filter(
                host_payout=self.payout,
                event="payout_updated_by_staff",
                new_status=HostPayout.STATUS_PAID,
            ).exists()
        )

    def test_paid_refund_records_method_actor_reference_and_updates_payment(self):
        self.booking.status = "cancelled"
        self.booking.is_cancelled_by_host = True
        self.booking.host_cancelled_at = timezone.now()
        self.booking.save(
            update_fields=["status", "is_cancelled_by_host", "host_cancelled_at"]
        )
        _, refund = sync_cancellation_settlements(self.booking)

        response = self.client.post(
            f"/admin/core/guestrefund/{refund.id}/change/",
            {
                "status": GuestRefund.STATUS_PAID,
                "received_amount": 495000,
                "approved_amount": 495000,
                "decision_notes": "Түрээслүүлэгч цуцалсан тул бүрэн буцаав.",
                "refund_method": GuestRefund.METHOD_QPAY,
                "recipient_name": "",
                "bank_name": "",
                "account_number": "",
                "transfer_reference": "REFUND-001",
                "_save": "Хадгалах",
            },
        )

        self.assertEqual(response.status_code, 302)
        refund.refresh_from_db()
        self.assertEqual(refund.status, GuestRefund.STATUS_PAID)
        self.assertEqual(refund.refunded_by, self.staff)
        self.assertIsNotNone(refund.refunded_at)
        self.assertEqual(refund.transfer_reference, "REFUND-001")
        self.assertEqual(
            self.booking.payments.get().status,
            Payment.STATUS_REFUNDED,
        )
        self.assertTrue(
            FinancialAuditLog.objects.filter(
                guest_refund=refund,
                event="refund_updated_by_staff",
                new_status=GuestRefund.STATUS_PAID,
            ).exists()
        )

    def test_bank_refund_requires_destination_details(self):
        self.booking.status = "cancelled"
        self.booking.is_cancelled_by_host = True
        self.booking.host_cancelled_at = timezone.now()
        self.booking.save(
            update_fields=["status", "is_cancelled_by_host", "host_cancelled_at"]
        )
        _, refund = sync_cancellation_settlements(self.booking)

        response = self.client.post(
            f"/admin/core/guestrefund/{refund.id}/change/",
            {
                "status": GuestRefund.STATUS_PAID,
                "received_amount": 495000,
                "approved_amount": 495000,
                "decision_notes": "Банк руу буцаах.",
                "refund_method": GuestRefund.METHOD_BANK,
                "recipient_name": "",
                "bank_name": "",
                "account_number": "",
                "transfer_reference": "REFUND-002",
                "_save": "Хадгалах",
            },
        )

        self.assertEqual(response.status_code, 200)
        refund.refresh_from_db()
        self.assertEqual(refund.status, GuestRefund.STATUS_APPROVED)
        self.assertContains(response, "Хүлээн авагчийн нэр дутуу")
