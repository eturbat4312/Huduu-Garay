from datetime import timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PasswordRecoveryTests(TestCase):
    request_url = "/api/password-reset/"
    confirm_url = "/api/password-reset/confirm/"

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="recover", email="recover@example.com", password="OriginalSecret42!"
        )
        self.client = APIClient()

    def tearDown(self):
        cache.clear()

    def payload(self, password="ReplacementSecret93!"):
        return {
            "uid": urlsafe_base64_encode(force_bytes(self.user.pk)),
            "token": default_token_generator.make_token(self.user),
            "new_password": password,
        }

    def request_reset(self, **extra):
        return self.client.post(self.request_url, {"email": self.user.email, **extra}, format="json")

    def confirm(self, payload=None):
        return self.client.post(self.confirm_url, payload or self.payload(), format="json")

    @override_settings(FRONTEND_URL="https://www.tanaid-honoy.mn/")
    def test_email_to_reset_to_login_end_to_end(self):
        self.assertEqual(self.request_reset(email=" RECOVER@EXAMPLE.COM ", locale="fr").status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        link = next(line for line in mail.outbox[0].body.splitlines() if line.startswith("https://"))
        self.assertTrue(link.startswith("https://www.tanaid-honoy.mn/fr/reset-password?"))
        query = parse_qs(urlparse(link).query)
        payload = {"uid": query["uid"][0], "token": query["token"][0], "new_password": "ReplacementSecret93!"}
        self.assertEqual(self.confirm(payload).status_code, 200)
        self.assertEqual(self.confirm(payload).status_code, 400)
        for password, expected in [("OriginalSecret42!", 401), (payload["new_password"], 200)]:
            result = self.client.post("/api/token/", {"username": "RECOVER@EXAMPLE.COM", "password": password}, format="json")
            self.assertEqual(result.status_code, expected)

    def test_mobile_email_contains_app_and_web_links(self):
        self.assertEqual(self.request_reset(client="mobile").status_code, 200)
        body = mail.outbox[0].body
        self.assertIn("tanaidhonoy://reset-password?", body)
        self.assertIn(settings.FRONTEND_URL + "/mn/reset-password?", body)

    def test_unknown_and_inactive_accounts_are_not_disclosed(self):
        known = self.request_reset()
        unknown = self.request_reset(email="unknown@example.com")
        self.user.is_active = False
        self.user.save()
        inactive = self.request_reset()
        self.assertEqual(known.data, unknown.data)
        self.assertEqual(known.data, inactive.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(self.confirm().status_code, 400)

    def test_expired_auth_does_not_block_recovery(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer expired.invalid.token")
        self.assertEqual(self.request_reset().status_code, 200)
        self.assertEqual(self.confirm().status_code, 200)

    def test_password_change_revokes_access_and_refresh(self):
        refresh = RefreshToken.for_user(self.user)
        access = str(refresh.access_token)
        self.assertEqual(self.confirm().status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(self.client.get("/api/me/").status_code, 401)
        self.client.credentials()
        result = self.client.post("/api/token/refresh/", {"refresh": str(refresh)}, format="json")
        self.assertEqual(result.status_code, 401)

    def test_current_tokens_refresh_and_legacy_tokens_do_not(self):
        refresh = RefreshToken.for_user(self.user)
        result = self.client.post("/api/token/refresh/", {"refresh": str(refresh)}, format="json")
        self.assertEqual(result.status_code, 200)
        del refresh[api_settings.REVOKE_TOKEN_CLAIM]
        self.assertEqual(self.client.post("/api/token/refresh/", {"refresh": str(refresh)}, format="json").status_code, 401)

    def test_deleted_user_refresh_is_rejected(self):
        refresh = RefreshToken.for_user(self.user)
        self.user.delete()
        self.assertEqual(self.client.post("/api/token/refresh/", {"refresh": str(refresh)}, format="json").status_code, 401)

    def test_weak_passwords_rejected_without_consuming_link(self):
        payload = self.payload()
        for password in ["short", "12345678", "password", "recover", "x" * 129]:
            with self.subTest(password=password):
                self.assertEqual(self.confirm({**payload, "new_password": password}).status_code, 400)
        self.assertEqual(self.confirm(payload).status_code, 200)

    def test_expiration_matches_email_24_hours(self):
        self.assertEqual(settings.PASSWORD_RESET_TIMEOUT, 86400)
        with patch.object(default_token_generator, "_now", return_value=default_token_generator._now() - timedelta(hours=25)):
            payload = self.payload()
        self.assertEqual(self.confirm(payload).status_code, 400)
        with patch.object(default_token_generator, "_now", return_value=default_token_generator._now() - timedelta(hours=23)):
            payload = self.payload()
        self.assertEqual(self.confirm(payload).status_code, 200)

    def test_google_account_gets_password_without_new_account(self):
        self.user.set_unusable_password()
        self.user.save()
        self.assertEqual(self.request_reset().status_code, 200)
        self.assertEqual(self.confirm().status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("ReplacementSecret93!"))
        self.assertEqual(User.objects.count(), 1)

    @patch("core.utils.email_notifications.send_mail", side_effect=OSError("SMTP unavailable"))
    def test_delivery_error_is_reported(self, send):
        self.assertEqual(self.request_reset().status_code, 503)
        self.assertFalse(send.call_args.kwargs["fail_silently"])

    @patch("core.utils.email_notifications.send_mail", return_value=0)
    def test_zero_messages_sent_is_failure(self, send):
        self.assertEqual(self.request_reset().status_code, 503)

    def test_invalid_request_values_return_400(self):
        for data in [{"email": None}, {"email": []}, {"email": "bad"}, {"client": []}, {"locale": "invalid"}]:
            with self.subTest(data=data):
                self.assertEqual(self.request_reset(**data).status_code, 400)
        for data in [{"uid": []}, {"token": {}}, {"new_password": 123}, {"uid": "_w"}, {"uid": "OQ" * 100}]:
            with self.subTest(data=data):
                self.assertEqual(self.confirm({**self.payload(), **data}).status_code, 400)

    def test_request_throttle(self):
        for _ in range(10):
            self.assertEqual(self.request_reset(email="unknown@example.com").status_code, 200)
        self.assertEqual(self.request_reset().status_code, 429)

    def test_legacy_duplicate_recovery_does_not_pick_an_account(self):
        with patch.object(User.objects, "filter", return_value=[self.user, self.user]):
            self.assertEqual(self.request_reset().status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_duplicate_signup_is_rejected(self):
        result = self.client.post("/api/signup/", {
            "username": "another", "email": " RECOVER@EXAMPLE.COM ", "password": "OtherSecret42!",
        }, format="json")
        self.assertEqual(result.status_code, 400)
        self.assertIn("email", result.data)
        self.assertEqual(User.objects.count(), 1)

    def test_database_rejects_case_and_space_duplicate(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user(username="duplicate", email=" RECOVER@example.com ")

    def test_profile_cannot_take_existing_email(self):
        other = User.objects.create_user(username="other", email="other@example.com")
        self.client.force_authenticate(other)
        response = self.client.patch("/api/me/", {"email": "RECOVER@example.com"}, format="multipart")
        self.assertEqual(response.status_code, 400)
        other.refresh_from_db()
        self.assertEqual(other.email, "other@example.com")
