"""huduu_garay backend — бүрэн тест"""

from datetime import date, timedelta
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import (
    Category, Amenity, Listing, Availability,
    Booking, Favorite, Notification, Review, HostApplication,
)

User = get_user_model()


def make_user(username="testuser", password="pass1234!", email="test@example.com", is_host=False):
    u = User.objects.create_user(username=username, password=password, email=email)
    u.is_host = is_host
    u.save()
    return u


def auth_client(user):
    c = APIClient()
    resp = c.post("/api/token/", {"username": user.username, "password": "pass1234!"}, format="json")
    assert resp.status_code == 200, f"Token авахад алдаа: {resp.data}"
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return c


def make_category(name="Байр"):
    return Category.objects.create(name=name)


def make_listing(host, category=None, price=50000, title="Тест байр"):
    cat = category or make_category()
    return Listing.objects.create(
        host=host, category=cat, title=title, description="Тайлбар",
        price_per_night=price, max_guests=4, beds=2,
        location_city="Улаанбаатар", location_district="Баянзүрх",
    )


def add_availability(listing, start=1, count=5):
    today = date.today()
    result = []
    for i in range(start, start + count):
        av, _ = Availability.objects.get_or_create(listing=listing, date=today + timedelta(days=i))
        result.append(av.date)
    return result


# ── 1. AUTH ──────────────────────────────────────────────────

class SignupLoginTests(TestCase):
    def test_signup_success(self):
        c = APIClient()
        r = c.post("/api/signup/", {"username": "u1", "email": "u1@x.com", "password": "StrongPass1!"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(User.objects.filter(username="u1").exists())

    def test_signup_duplicate(self):
        make_user("dup")
        c = APIClient()
        r = c.post("/api/signup/", {"username": "dup", "email": "x@x.com", "password": "pass1234!"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_login_success(self):
        make_user("lu")
        c = APIClient()
        r = c.post("/api/token/", {"username": "lu", "password": "pass1234!"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)

    def test_login_wrong_password(self):
        make_user("wp")
        c = APIClient()
        r = c.post("/api/token/", {"username": "wp", "password": "wrong"}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_token_refresh(self):
        make_user("ru")
        c = APIClient()
        r = c.post("/api/token/", {"username": "ru", "password": "pass1234!"}, format="json")
        r2 = c.post("/api/token/refresh/", {"refresh": r.data["refresh"]}, format="json")
        self.assertEqual(r2.status_code, 200)
        self.assertIn("access", r2.data)

    def test_login_by_email(self):
        make_user("el", email="el@x.com")
        c = APIClient()
        r = c.post("/api/token/", {"username": "el@x.com", "password": "pass1234!"}, format="json")
        self.assertEqual(r.status_code, 200)


# ── 2. ME ─────────────────────────────────────────────────────

class MeTests(TestCase):
    def setUp(self):
        self.user = make_user()
        self.c = auth_client(self.user)

    def test_get_me(self):
        r = self.c.get("/api/me/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["username"], self.user.username)
        self.assertIn("is_host", r.data)

    def test_patch_phone(self):
        r = self.c.patch("/api/me/", {"phone": "99001234"}, format="multipart")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, "99001234")

    def test_unauthenticated(self):
        r = APIClient().get("/api/me/")
        self.assertEqual(r.status_code, 401)


# ── 3. CATEGORIES ─────────────────────────────────────────────

class CategoryTests(TestCase):
    def test_list(self):
        Category.objects.create(name="Гэр")
        Category.objects.create(name="Байр")
        r = APIClient().get("/api/categories/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 2)


# ── 4. LISTINGS ───────────────────────────────────────────────

class ListingTests(TestCase):
    def setUp(self):
        self.host = make_user("host", is_host=True)
        self.guest = make_user("guest", email="guest@x.com")
        self.hc = auth_client(self.host)
        self.gc = auth_client(self.guest)
        self.cat = make_category()

    def test_create_as_host(self):
        r = self.hc.post("/api/listings/", {
            "title": "Шинэ байр", "description": "x", "price_per_night": 80000,
            "max_guests": 3, "beds": 2, "category_id": self.cat.id,
            "location_city": "УБ", "location_district": "СБД",
        }, format="json")
        self.assertEqual(r.status_code, 201)

    def test_create_as_guest_blocked(self):
        r = self.gc.post("/api/listings/", {
            "title": "x", "description": "x", "price_per_night": 1,
            "max_guests": 1, "beds": 1, "category_id": self.cat.id,
            "location_city": "УБ", "location_district": "СБД",
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_list_public(self):
        make_listing(self.host, self.cat)
        r = APIClient().get("/api/listings/")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.data), 1)

    def test_retrieve(self):
        listing = make_listing(self.host, self.cat)
        r = APIClient().get(f"/api/listings/{listing.id}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["id"], listing.id)

    def test_filter_by_category(self):
        cat2 = make_category("Гэр")
        make_listing(self.host, self.cat, title="Байр нэг")
        make_listing(self.host, cat2, title="Гэр нэг")
        r = APIClient().get("/api/listings/", {"category": "Байр"})
        self.assertEqual(r.status_code, 200)
        for item in r.data:
            self.assertIn("Байр", item["category"]["name"])

    def test_filter_by_price_max(self):
        make_listing(self.host, self.cat, price=30000, title="Хямд")
        make_listing(self.host, self.cat, price=150000, title="Үнэтэй")
        r = APIClient().get("/api/listings/", {"price_max": 50000})
        self.assertEqual(r.status_code, 200)
        for item in r.data:
            self.assertLessEqual(float(item["price_per_night"]), 50000)

    def test_update(self):
        listing = make_listing(self.host, self.cat)
        r = self.hc.patch(f"/api/listings/{listing.id}/edit/", {
            "title": "Засварласан", "description": "x", "price_per_night": 90000,
            "max_guests": 3, "beds": 2, "category_id": self.cat.id,
            "location_city": "УБ", "location_district": "СБД",
        }, format="json")
        self.assertEqual(r.status_code, 200)
        listing.refresh_from_db()
        self.assertEqual(listing.title, "Засварласан")

    def test_delete_no_booking(self):
        listing = make_listing(self.host, self.cat)
        r = self.hc.delete(f"/api/listings/{listing.id}/delete/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(Listing.objects.filter(id=listing.id).exists())

    def test_delete_with_booking_blocked(self):
        listing = make_listing(self.host, self.cat)
        today = date.today()
        Booking.objects.create(
            listing=listing, guest=self.guest,
            check_in=today + timedelta(days=1), check_out=today + timedelta(days=3),
            full_name="G", phone_number="9900", total_price=100000,
        )
        r = self.hc.delete(f"/api/listings/{listing.id}/delete/")
        self.assertEqual(r.status_code, 409)

    def test_my_listings(self):
        make_listing(self.host, self.cat)
        r = self.hc.get("/api/my-listings/")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.data), 1)

    def test_my_listings_unauth(self):
        r = APIClient().get("/api/my-listings/")
        self.assertEqual(r.status_code, 401)

    def test_average_rating_none(self):
        listing = make_listing(self.host, self.cat)
        r = APIClient().get(f"/api/listings/{listing.id}/")
        self.assertIsNone(r.data["average_rating"])


# ── 5. AVAILABILITY ───────────────────────────────────────────

class AvailabilityTests(TestCase):
    def setUp(self):
        self.host = make_user("avh", is_host=True)
        self.hc = auth_client(self.host)
        self.listing = make_listing(self.host)

    def test_bulk_create(self):
        today = date.today()
        dates = [(today + timedelta(days=i)).isoformat() for i in range(1, 6)]
        r = self.hc.post("/api/availability/bulk/", {"listing": self.listing.id, "dates": dates}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Availability.objects.filter(listing=self.listing).count(), 5)

    def test_list_by_listing(self):
        add_availability(self.listing, 1, 3)
        r = APIClient().get("/api/availability/", {"listing": self.listing.id})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 3)

    def test_delete_by_listing(self):
        add_availability(self.listing, 1, 4)
        r = self.hc.post("/api/availability/delete-by-listing/", {"listing": self.listing.id}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Availability.objects.filter(listing=self.listing).count(), 0)


# ── 6. BOOKING ────────────────────────────────────────────────

class BookingTests(TestCase):
    def setUp(self):
        self.host = make_user("bh", is_host=True)
        self.guest = make_user("bg", email="bg@x.com")
        self.hc = auth_client(self.host)
        self.gc = auth_client(self.guest)
        self.listing = make_listing(self.host)
        add_availability(self.listing, 1, 5)

    def _book(self, start=1, nights=3):
        today = date.today()
        return self.gc.post("/api/bookings/", {
            "listing_id": self.listing.id,
            "check_in": (today + timedelta(days=start)).isoformat(),
            "check_out": (today + timedelta(days=start + nights)).isoformat(),
            "full_name": "Тест Зочин", "phone_number": "99001234",
            "notes": "", "guest_count": 2,
        }, format="json")

    def test_book_success(self):
        r = self._book()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Booking.objects.count(), 1)

    def test_availability_removed_after_booking(self):
        self._book(start=1, nights=3)
        self.assertEqual(Availability.objects.filter(listing=self.listing).count(), 2)

    def test_double_booking_fails(self):
        self._book(start=1, nights=3)
        r = self._book(start=1, nights=3)
        self.assertEqual(r.status_code, 400)

    def test_unauth_booking_fails(self):
        today = date.today()
        r = APIClient().post("/api/bookings/", {
            "listing_id": self.listing.id,
            "check_in": (today + timedelta(days=1)).isoformat(),
            "check_out": (today + timedelta(days=3)).isoformat(),
            "full_name": "x", "phone_number": "9900", "guest_count": 1,
        }, format="json")
        self.assertEqual(r.status_code, 401)

    def test_total_price(self):
        self._book(start=1, nights=3)
        b = Booking.objects.first()
        self.assertEqual(b.total_price, 3 * 50000)

    def test_service_fee(self):
        self._book(start=1, nights=3)
        b = Booking.objects.first()
        self.assertEqual(b.service_fee, int(3 * 50000 * 0.10))

    def test_my_bookings(self):
        self._book()
        r = self.gc.get("/api/bookings/my/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_host_cancel(self):
        self._book()
        b = Booking.objects.first()
        r = self.hc.post(f"/api/bookings/{b.id}/host-cancel/")
        self.assertEqual(r.status_code, 200)
        b.refresh_from_db()
        self.assertTrue(b.is_cancelled_by_host)

    def test_cancel_restores_availability(self):
        self._book(start=1, nights=3)
        b = Booking.objects.first()
        before = Availability.objects.filter(listing=self.listing).count()
        self.hc.post(f"/api/bookings/{b.id}/host-cancel/")
        after = Availability.objects.filter(listing=self.listing).count()
        self.assertEqual(after - before, 3)

    def test_double_cancel_fails(self):
        self._book()
        b = Booking.objects.first()
        self.hc.post(f"/api/bookings/{b.id}/host-cancel/")
        r = self.hc.post(f"/api/bookings/{b.id}/host-cancel/")
        self.assertEqual(r.status_code, 400)

    def test_notifications_on_booking(self):
        self._book()
        self.assertEqual(Notification.objects.filter(user=self.host).count(), 1)
        self.assertEqual(Notification.objects.filter(user=self.guest).count(), 1)

    def test_notification_on_cancel(self):
        self._book()
        b = Booking.objects.first()
        self.hc.post(f"/api/bookings/{b.id}/host-cancel/")
        self.assertEqual(
            Notification.objects.filter(user=self.guest, type="booking_cancelled").count(), 1
        )


# ── 7. FAVORITES ──────────────────────────────────────────────

class FavoriteTests(TestCase):
    def setUp(self):
        self.host = make_user("fh", is_host=True)
        self.guest = make_user("fg", email="fg@x.com")
        self.c = auth_client(self.guest)
        self.listing = make_listing(self.host)

    def test_add(self):
        r = self.c.post("/api/favorites/", {"listing_id": self.listing.id}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(Favorite.objects.filter(user=self.guest, listing=self.listing).exists())

    def test_idempotent(self):
        self.c.post("/api/favorites/", {"listing_id": self.listing.id}, format="json")
        self.c.post("/api/favorites/", {"listing_id": self.listing.id}, format="json")
        self.assertEqual(Favorite.objects.filter(user=self.guest, listing=self.listing).count(), 1)

    def test_remove(self):
        r = self.c.post("/api/favorites/", {"listing_id": self.listing.id}, format="json")
        fav_id = r.data["id"]
        r2 = self.c.delete(f"/api/favorites/{fav_id}/")
        self.assertEqual(r2.status_code, 204)

    def test_list(self):
        self.c.post("/api/favorites/", {"listing_id": self.listing.id}, format="json")
        r = self.c.get("/api/my-favorites/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_unauth(self):
        r = APIClient().get("/api/my-favorites/")
        self.assertEqual(r.status_code, 401)

    def test_is_favorited_field(self):
        self.c.post("/api/favorites/", {"listing_id": self.listing.id}, format="json")
        r = self.c.get(f"/api/listings/{self.listing.id}/")
        self.assertTrue(r.data["is_favorited"])
        self.assertIsNotNone(r.data["favorite_id"])

    def test_is_favorited_false_for_anon(self):
        r = APIClient().get(f"/api/listings/{self.listing.id}/")
        self.assertFalse(r.data["is_favorited"])


# ── 8. NOTIFICATIONS ──────────────────────────────────────────

class NotificationTests(TestCase):
    def setUp(self):
        self.user = make_user("nu")
        self.c = auth_client(self.user)

    def _make(self, t="booking"):
        return Notification.objects.create(user=self.user, message="test", type=t)

    def test_list(self):
        self._make()
        r = self.c.get("/api/notifications/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_unread_count(self):
        self._make(); self._make()
        r = self.c.get("/api/notifications/unread-count/")
        self.assertEqual(r.data["total_unread"], 2)

    def test_booking_unread_count_includes_admin_booking(self):
        self._make("booking_created")
        self._make("booking_confirmed")
        self._make("booking_cancelled")
        self._make("admin_booking")
        self._make("review")

        r = self.c.get("/api/notifications/unread-count/")

        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["total_unread"], 5)
        self.assertEqual(r.data["booking_unread"], 4)

    def test_mark_all_read(self):
        self._make(); self._make()
        self.c.post("/api/notifications/mark-read/", format="json")
        self.assertEqual(Notification.objects.filter(user=self.user, is_read=False).count(), 0)

    def test_mark_by_type(self):
        self._make("booking_created")
        self._make("review")
        self.c.post("/api/notifications/mark-read/", {"type": "booking_created"}, format="json")
        self.assertEqual(Notification.objects.filter(user=self.user, is_read=False, type="booking_created").count(), 0)
        self.assertEqual(Notification.objects.filter(user=self.user, is_read=False, type="review").count(), 1)


# ── 9. REVIEWS ────────────────────────────────────────────────

class ReviewTests(TestCase):
    def setUp(self):
        self.host = make_user("rh", is_host=True)
        self.guest = make_user("rg", email="rg@x.com")
        self.gc = auth_client(self.guest)
        self.listing = make_listing(self.host)
        yesterday = date.today() - timedelta(days=1)
        self.booking = Booking.objects.create(
            listing=self.listing, guest=self.guest,
            check_in=yesterday - timedelta(days=2), check_out=yesterday,
            full_name="RG", phone_number="9900", total_price=100000,
        )

    def test_create(self):
        r = self.gc.post(f"/api/listings/{self.listing.id}/reviews/", {
            "listing": self.listing.id, "rating": 5, "comment": "Сайн!",
        }, format="json")
        self.assertEqual(r.status_code, 201)

    def test_double_review_blocked(self):
        self.gc.post(f"/api/listings/{self.listing.id}/reviews/", {
            "listing": self.listing.id, "rating": 4, "comment": "1",
        }, format="json")
        r = self.gc.post(f"/api/listings/{self.listing.id}/reviews/", {
            "listing": self.listing.id, "rating": 3, "comment": "2",
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_review_without_stay_blocked(self):
        other = make_user("og", email="og@x.com")
        c = auth_client(other)
        r = c.post(f"/api/listings/{self.listing.id}/reviews/", {
            "listing": self.listing.id, "rating": 5, "comment": "x",
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_list_public(self):
        Review.objects.create(
            listing=self.listing, booking=self.booking,
            guest=self.guest, rating=4, comment="ok",
        )
        r = APIClient().get(f"/api/listings/{self.listing.id}/reviews/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_average_rating(self):
        Review.objects.create(
            listing=self.listing, booking=self.booking,
            guest=self.guest, rating=4, comment="ok",
        )
        r = APIClient().get(f"/api/listings/{self.listing.id}/")
        self.assertEqual(r.data["average_rating"], 4.0)


# ── 10. HOST APPLICATION ──────────────────────────────────────

class HostApplicationTests(TestCase):
    def setUp(self):
        self.user = make_user("ha", email="ha@x.com")
        self.c = auth_client(self.user)

    @staticmethod
    def _make_valid_image():
        from PIL import Image
        from io import BytesIO
        from django.core.files.uploadedfile import InMemoryUploadedFile
        buf = BytesIO()
        Image.new("RGB", (10, 10), color="red").save(buf, format="JPEG")
        buf.seek(0)
        return InMemoryUploadedFile(buf, None, "test.jpg", "image/jpeg", buf.getbuffer().nbytes, None)

    def _apply(self):
        img = self._make_valid_image()
        selfie = self._make_valid_image()
        return self.c.post("/api/host/apply/", {
            "full_name": "Хэрэглэгч", "phone_number": "9900",
            "bank_name": "Хаан Банк", "account_number": "12345678",
            "id_card_image": img, "selfie_with_id": selfie,
            "host_terms_accepted": "true",
        }, format="multipart")

    def test_apply(self):
        r = self._apply()
        self.assertEqual(r.status_code, 201)
        app = HostApplication.objects.get(user=self.user)
        self.assertIsNotNone(app.host_terms_accepted_at)
        self.assertEqual(app.host_terms_version, "2026-09-15")
        self.assertEqual(str(app.host_commission_rate), "10.00")

    def test_apply_notifies_staff_users(self):
        admin = User.objects.create_user(
            username="hostadmin",
            email="hostadmin@example.com",
            password="pass1234!",
            is_staff=True,
        )
        staff_without_email = User.objects.create_user(
            username="staffnoemail",
            email="",
            password="pass1234!",
            is_staff=True,
        )

        with patch("core.models.send_notification_email") as send_email:
            r = self._apply()

        self.assertEqual(r.status_code, 201)
        app = HostApplication.objects.get(user=self.user)
        self.assertTrue(
            Notification.objects.filter(
                user=admin,
                type="host_application",
                message__contains=str(app.id),
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=staff_without_email,
                type="host_application",
                message__contains=str(app.id),
            ).exists()
        )
        sent_types = [call.kwargs["notif_type"] for call in send_email.call_args_list]
        self.assertEqual(
            sent_types,
            ["host_application_created", "admin_host_application_created"],
        )
        self.assertEqual(send_email.call_args_list[1].args[0], admin)

    def test_apply_requires_host_terms_acceptance(self):
        img = self._make_valid_image()
        selfie = self._make_valid_image()
        r = self.c.post("/api/host/apply/", {
            "full_name": "Хэрэглэгч", "phone_number": "9900",
            "bank_name": "Хаан Банк", "account_number": "12345678",
            "id_card_image": img, "selfie_with_id": selfie,
        }, format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(HostApplication.objects.count(), 0)

    def test_double_apply_blocked(self):
        self._apply()
        r = self._apply()
        self.assertEqual(r.status_code, 400)

    def test_get_my_application(self):
        self._apply()
        r = self.c.get("/api/host/application/me/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "pending")

    def test_not_found_before_apply(self):
        r = self.c.get("/api/host/application/me/")
        self.assertEqual(r.status_code, 404)

    def test_approval_sets_is_host(self):
        self._apply()
        app = HostApplication.objects.get(user=self.user)
        app.status = "approved"
        app.save()
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_host)

    def test_rejection_keeps_not_host(self):
        self._apply()
        app = HostApplication.objects.get(user=self.user)
        app.status = "rejected"
        app.save()
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_host)


# ── 11. PASSWORD RESET ────────────────────────────────────────

class PasswordResetTests(TestCase):
    def setUp(self):
        self.user = make_user("pr", email="pr@x.com")

    def test_request_existing_email(self):
        r = APIClient().post("/api/password-reset/", {"email": "pr@x.com"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_request_unknown_email_still_200(self):
        r = APIClient().post("/api/password-reset/", {"email": "nobody@x.com"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_confirm_invalid_token(self):
        r = APIClient().post("/api/password-reset/confirm/", {
            "uid": "bad", "token": "bad", "new_password": "NewPass123!",
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_confirm_short_password(self):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        r = APIClient().post("/api/password-reset/confirm/", {
            "uid": uid, "token": token, "new_password": "short",
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_confirm_success(self):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        r = APIClient().post("/api/password-reset/confirm/", {
            "uid": uid, "token": token, "new_password": "NewPassword999!",
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPassword999!"))


# ── 12. AMENITIES ─────────────────────────────────────────────

class AmenityTests(TestCase):
    def test_list(self):
        Amenity.objects.create(name="WiFi", translation_key="wifi")
        Amenity.objects.create(name="Паркинг", translation_key="parking")
        r = APIClient().get("/api/amenities/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 2)


# ── 13. HOST BOOKING VIEWS ────────────────────────────────────

class HostBookingViewTests(TestCase):
    def setUp(self):
        self.host = make_user("hbh", is_host=True)
        self.guest = make_user("hbg", email="hbg@x.com")
        self.hc = auth_client(self.host)
        self.gc = auth_client(self.guest)
        self.listing = make_listing(self.host)
        add_availability(self.listing, 1, 5)
        today = date.today()
        r = self.gc.post("/api/bookings/", {
            "listing_id": self.listing.id,
            "check_in": (today + timedelta(days=1)).isoformat(),
            "check_out": (today + timedelta(days=3)).isoformat(),
            "full_name": "HBG", "phone_number": "9900", "guest_count": 1,
        }, format="json")
        self.bid = r.data["id"]

    def test_host_booking_list(self):
        r = self.hc.get("/api/host-bookings/")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.data), 1)

    def test_host_booking_detail(self):
        r = self.hc.get(f"/api/host-bookings/{self.bid}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["id"], self.bid)

    def test_guest_sees_no_host_bookings(self):
        r = self.gc.get("/api/host-bookings/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 0)

    def test_calendar(self):
        r = self.hc.get("/api/host-booking-calendar/")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.data), 1)
