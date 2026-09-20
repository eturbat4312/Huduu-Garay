import re
import time
from datetime import timedelta
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse

import requests
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.facebook_views import digest
from core.models import FacebookAccount, FacebookAuthFlow
from core.services.facebook import exchange_code, FacebookProviderError

User = get_user_model()
CONFIG = {
    "FACEBOOK_ENABLED": True,
    "FACEBOOK_APP_ID": "123456",
    "FACEBOOK_APP_SECRET": "test-only-facebook-secret",
    "FACEBOOK_GRAPH_VERSION": "v24.0",
    "FACEBOOK_REDIRECT_URI": "https://www.tanaid-honoy.mn/api/auth/facebook/callback/",
    "FRONTEND_URL": "https://www.tanaid-honoy.mn",
    "EMAIL_BACKEND": "django.core.mail.backends.locmem.EmailBackend",
}


@override_settings(**CONFIG)
class FacebookLoginTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.verifier = "a" * 64
        self.profile = {"facebook_id": "998877", "email": "facebook@example.com", "name": "Facebook User"}

    def tearDown(self):
        cache.clear()

    def post(self, path, data):
        return self.client.post(f"/api/auth/facebook/{path}/", data, format="json")

    def start(self, **data):
        result = self.post("start", {"challenge": digest(self.verifier), **data})
        self.assertEqual(result.status_code, 200)
        query = parse_qs(urlparse(result.data["authorization_url"]).query)
        return query["state"][0]

    def callback(self, state, **query):
        with patch("core.facebook_views.exchange_code", return_value=self.profile) as provider:
            response = self.client.get("/api/auth/facebook/callback/", {"state": state, "code": "provider-code", **query})
        return response, provider

    def exchange(self, **start_data):
        state = self.start(**start_data)
        response, _ = self.callback(state)
        code = parse_qs(urlparse(response["Location"]).query)["code"][0]
        return self.post("exchange", {"code": code, "verifier": self.verifier})

    def pending(self, **start_data):
        response = self.exchange(**start_data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "account_required")
        return response.data["pending_token"]

    def email_code(self, pending):
        response = self.post("send-code", {"pending_token": pending})
        self.assertEqual(response.status_code, 200)
        return re.search(r"код: ([0-9]{6})", mail.outbox[-1].body).group(1)

    @override_settings(FACEBOOK_ENABLED=False)
    def test_disabled_hides_button_and_rejects_start(self):
        self.assertEqual(self.client.get("/api/auth/facebook/config/").data, {"enabled": False})
        self.assertEqual(self.post("start", {"challenge": digest(self.verifier)}).status_code, 503)
        self.assertEqual(FacebookAuthFlow.objects.count(), 0)

    @override_settings(FACEBOOK_APP_SECRET="")
    def test_missing_configuration_is_not_enabled(self):
        self.assertFalse(self.client.get("/api/auth/facebook/config/").data["enabled"])

    def test_start_validation_and_fixed_redirect(self):
        for data in [{"challenge": "bad"}, {"challenge": None}, {"client": "https://evil.example"}, {"intent": []}, {"locale": "../../"}]:
            response = self.post("start", {"challenge": digest(self.verifier), **data})
            self.assertEqual(response.status_code, 400)
        state = self.start(redirect_uri="https://evil.example")
        flow = FacebookAuthFlow.objects.get()
        self.assertEqual(flow.pk, digest(state))
        self.assertEqual(flow.challenge, digest(self.verifier))

    def test_state_invalid_expired_and_replayed(self):
        state = self.start()
        response, provider = self.callback("wrong" * 10)
        self.assertEqual(response.status_code, 400)
        provider.assert_not_called()
        FacebookAuthFlow.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        response, provider = self.callback(state)
        self.assertEqual(response.status_code, 400)
        provider.assert_not_called()
        state = self.start()
        self.assertEqual(self.callback(state)[0].status_code, 302)
        response, provider = self.callback(state)
        self.assertEqual(response.status_code, 400)
        provider.assert_not_called()

    def test_callback_has_only_one_use_code_not_tokens(self):
        response, _ = self.callback(self.start())
        parsed = urlparse(response["Location"])
        self.assertEqual(parsed.path, "/mn/facebook/callback")
        self.assertEqual(set(parse_qs(parsed.query)), {"code"})
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(response["Referrer-Policy"], "no-referrer")
        code = parse_qs(parsed.query)["code"][0]
        self.assertEqual(self.post("exchange", {"code": code, "verifier": "x" * 64}).status_code, 400)
        self.assertEqual(self.post("exchange", {"code": code, "verifier": self.verifier}).status_code, 200)
        self.assertEqual(self.post("exchange", {"code": code, "verifier": self.verifier}).status_code, 400)

    def test_mobile_callback_uses_fixed_scheme(self):
        response, _ = self.callback(self.start(client="mobile"))
        self.assertTrue(response["Location"].startswith("tanaidhonoy://facebook-callback?code="))

    def test_cancel_does_not_call_provider_or_create_account(self):
        response, provider = self.callback(self.start(), error="access_denied")
        provider.assert_not_called()
        code = parse_qs(urlparse(response["Location"]).query)["code"][0]
        result = self.post("exchange", {"code": code, "verifier": self.verifier})
        self.assertEqual(result.data["status"], "cancelled")
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(FacebookAuthFlow.objects.count(), 0)

    def test_provider_error_is_generic(self):
        state = self.start()
        with patch("core.facebook_views.exchange_code", side_effect=FacebookProviderError()):
            response = self.client.get("/api/auth/facebook/callback/", {"state": state, "code": "abc"})
        code = parse_qs(urlparse(response["Location"]).query)["code"][0]
        self.assertEqual(self.post("exchange", {"code": code, "verifier": self.verifier}).data, {"status": "provider_error"})

    def test_existing_facebook_identity_logs_into_same_account_even_email_changes(self):
        user = User.objects.create_user(username="existing", email="old@example.com", password=None)
        FacebookAccount.objects.create(user=user, facebook_id=self.profile["facebook_id"])
        result = self.exchange()
        self.assertEqual(result.data["status"], "authenticated")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {result.data['access']}")
        me = self.client.get("/api/me/").data
        self.assertEqual(me["id"], user.pk)
        self.assertTrue(me["facebook_connected"])
        user.refresh_from_db()
        self.assertEqual(user.email, "old@example.com")
        self.assertEqual(User.objects.count(), 1)

    def test_inactive_account_is_rejected(self):
        user = User.objects.create_user(username="inactive", is_active=False)
        FacebookAccount.objects.create(user=user, facebook_id=self.profile["facebook_id"])
        self.assertEqual(self.exchange().status_code, 403)

    def test_same_email_never_auto_links(self):
        user = User.objects.create_user(username="google", email="FACEBOOK@example.com")
        result = self.exchange()
        self.assertEqual(result.data["status"], "account_required")
        self.assertFalse(result.data["can_register"])
        self.assertNotIn("access", result.data)
        self.assertEqual(FacebookAccount.objects.count(), 0)
        token = result.data["pending_token"]
        self.assertEqual(self.post("register", {"pending_token": token, "confirm_new_account": True, "email_code": "123456"}).status_code, 409)
        self.assertEqual(self.post("connect", {"pending_token": token, "confirm_link": True}).status_code, 401)
        self.client.force_authenticate(user)
        self.assertEqual(self.post("connect", {"pending_token": token}).status_code, 400)
        self.assertEqual(self.post("connect", {"pending_token": token, "confirm_link": True}).status_code, 200)
        self.assertEqual(FacebookAccount.objects.get().user_id, user.pk)
        self.assertEqual(self.post("connect", {"pending_token": token, "confirm_link": True}).status_code, 400)

    def test_different_email_can_link_only_after_local_login(self):
        user = User.objects.create_user(username="local", email="local@example.com")
        token = self.pending()
        self.client.force_authenticate(user)
        self.assertEqual(self.post("connect", {"pending_token": token, "confirm_link": True}).status_code, 200)
        self.assertEqual(User.objects.count(), 1)
        user.refresh_from_db()
        self.assertEqual(user.email, "local@example.com")

    def test_missing_email_needs_existing_or_separate_registration(self):
        self.profile["email"] = ""
        result = self.exchange()
        self.assertFalse(result.data["can_register"])
        token = result.data["pending_token"]
        self.assertEqual(self.post("send-code", {"pending_token": token}).status_code, 400)
        self.assertEqual(self.post("register", {"pending_token": token, "confirm_new_account": True}).status_code, 400)
        user = User.objects.create_user(username="emailuser", email="email@example.com")
        self.client.force_authenticate(user)
        self.assertEqual(self.post("connect", {"pending_token": token, "confirm_link": True}).status_code, 200)

    def test_new_registration_requires_consent_and_email_code(self):
        token = self.pending()
        self.assertEqual(self.post("register", {"pending_token": token}).status_code, 400)
        self.assertEqual(self.post("register", {"pending_token": token, "confirm_new_account": True, "email_code": "123456"}).status_code, 400)
        code = self.email_code(token)
        flow = FacebookAuthFlow.objects.get()
        self.assertNotEqual(flow.email_code_hash, code)
        result = self.post("register", {"pending_token": token, "confirm_new_account": True, "email_code": code})
        self.assertEqual(result.status_code, 201)
        user = User.objects.get()
        self.assertEqual(user.email, self.profile["email"])
        self.assertFalse(user.has_usable_password())
        self.assertEqual(FacebookAccount.objects.get().user_id, user.pk)
        self.assertEqual(FacebookAuthFlow.objects.count(), 0)
        self.assertEqual(self.post("register", {"pending_token": token, "confirm_new_account": True, "email_code": code}).status_code, 400)

    def test_email_attempts_are_limited_and_resend_has_cooldown(self):
        token = self.pending()
        code = self.email_code(token)
        self.assertEqual(self.post("send-code", {"pending_token": token}).status_code, 429)
        for _ in range(5):
            self.assertEqual(self.post("register", {"pending_token": token, "confirm_new_account": True, "email_code": "bad"}).status_code, 400)
        self.assertEqual(self.post("register", {"pending_token": token, "confirm_new_account": True, "email_code": code}).status_code, 400)
        self.assertEqual(self.post("send-code", {"pending_token": token}).status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    @patch("core.facebook_views.send_mail", side_effect=OSError())
    def test_email_delivery_error_does_not_create_user(self, send):
        token = self.pending()
        self.assertEqual(self.post("send-code", {"pending_token": token}).status_code, 503)
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(FacebookAuthFlow.objects.get().email_code_hash, "")

    def test_registration_rechecks_email_after_verification(self):
        token = self.pending()
        code = self.email_code(token)
        User.objects.create_user(username="race", email=self.profile["email"])
        self.assertEqual(self.post("register", {"pending_token": token, "confirm_new_account": True, "email_code": code}).status_code, 409)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(FacebookAccount.objects.count(), 0)

    def test_link_cannot_steal_identity_or_replace_link(self):
        owner = User.objects.create_user(username="owner")
        other = User.objects.create_user(username="other")
        FacebookAccount.objects.create(user=owner, facebook_id=self.profile["facebook_id"])
        token = self.pending(intent="connect")
        self.client.force_authenticate(other)
        self.assertEqual(self.post("connect", {"pending_token": token, "confirm_link": True}).status_code, 409)
        self.client.force_authenticate(owner)
        self.assertEqual(self.post("connect", {"pending_token": token, "confirm_link": True}).status_code, 200)
        self.profile["facebook_id"] = "112233"
        token = self.pending(intent="connect")
        self.assertEqual(self.post("connect", {"pending_token": token, "confirm_link": True}).status_code, 409)
        self.assertEqual(FacebookAccount.objects.get().facebook_id, "998877")

    def test_pending_ticket_expires(self):
        token = self.pending()
        FacebookAuthFlow.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.post("send-code", {"pending_token": token}).status_code, 400)
        self.assertEqual(self.post("register", {"pending_token": token, "confirm_new_account": True}).status_code, 400)

    def test_stale_access_token_does_not_block_login(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer expired.invalid.token")
        self.assertEqual(self.exchange().status_code, 200)

    def test_identity_database_uniqueness(self):
        a = User.objects.create_user(username="a")
        b = User.objects.create_user(username="b")
        FacebookAccount.objects.create(user=a, facebook_id="123")
        with self.assertRaises(IntegrityError), transaction.atomic():
            FacebookAccount.objects.create(user=b, facebook_id="123")
        with self.assertRaises(IntegrityError), transaction.atomic():
            FacebookAccount.objects.create(user=a, facebook_id="456")


@override_settings(**CONFIG)
class FacebookProviderTests(TestCase):
    def responses(self, debug=None, profile=None):
        return [
            Mock(json=Mock(return_value={"access_token": "provider-secret-token"})),
            Mock(json=Mock(return_value={"data": debug or {"app_id": "123456", "user_id": "998877", "is_valid": True, "expires_at": int(time.time()) + 3600}})),
            Mock(json=Mock(return_value=profile or {"id": "998877", "email": " FB@EXAMPLE.COM ", "name": "Test"})),
        ]

    @patch("core.services.facebook.requests.get")
    def test_code_exchange_checks_app_and_identity_and_uses_appsecret_proof(self, get):
        get.side_effect = self.responses()
        self.assertEqual(exchange_code("oauth-code"), {"facebook_id": "998877", "email": "fb@example.com", "name": "Test"})
        self.assertEqual(get.call_args_list[0].kwargs["params"]["redirect_uri"], CONFIG["FACEBOOK_REDIRECT_URI"])
        self.assertEqual(get.call_args_list[2].kwargs["headers"]["Authorization"], "Bearer provider-secret-token")
        self.assertEqual(len(get.call_args_list[2].kwargs["params"]["appsecret_proof"]), 64)

    @patch("core.services.facebook.requests.get")
    def test_wrong_app_invalid_expired_and_wrong_subject_rejected(self, get):
        base = {"app_id": "123456", "user_id": "998877", "is_valid": True}
        for data in [{"app_id": "other"}, {"is_valid": False}, {"user_id": ""}, {"expires_at": 1}, {"data_access_expires_at": 1}, {"expires_at": "bad"}]:
            with self.subTest(data=data):
                get.side_effect = self.responses(debug={**base, **data})
                with self.assertRaises(FacebookProviderError): exchange_code("code")
        get.side_effect = self.responses(profile={"id": "wrong"})
        with self.assertRaises(FacebookProviderError): exchange_code("code")

    @patch("core.services.facebook.requests.get")
    def test_email_is_optional_and_malformed_email_is_ignored(self, get):
        for email in [None, "invalid", []]:
            get.side_effect = self.responses(profile={"id": "998877", "email": email})
            self.assertEqual(exchange_code("code")["email"], "")

    @patch("core.services.facebook.requests.get", side_effect=requests.Timeout("secret url"))
    def test_network_errors_do_not_leak_secrets(self, get):
        with self.assertRaises(FacebookProviderError) as caught:
            exchange_code("code")
        self.assertNotIn("secret", str(caught.exception))
