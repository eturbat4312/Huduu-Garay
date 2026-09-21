import base64
from dataclasses import dataclass
from datetime import datetime
from datetime import timedelta
from datetime import timezone as datetime_timezone
from threading import Lock
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests
from django.conf import settings
from django.utils import timezone


class QPayConfigurationError(Exception):
    pass


class QPayAPIError(Exception):
    pass


@dataclass(frozen=True)
class QPayConfig:
    client_id: str
    client_secret: str
    invoice_code: str
    callback_url: str
    base_url: str
    auth_url: str
    timeout_seconds: int
    token_leeway_seconds: int

    @classmethod
    def from_settings(cls):
        config = cls(
            client_id=getattr(settings, "QPAY_CLIENT_ID", ""),
            client_secret=getattr(settings, "QPAY_CLIENT_SECRET", ""),
            invoice_code=getattr(settings, "QPAY_INVOICE_CODE", ""),
            callback_url=getattr(settings, "QPAY_CALLBACK_URL", ""),
            base_url=getattr(settings, "QPAY_BASE_URL", "https://merchant.qpay.mn"),
            auth_url=getattr(
                settings,
                "QPAY_AUTH_URL",
                "https://merchant.qpay.mn/v2/auth/token",
            ),
            timeout_seconds=int(getattr(settings, "QPAY_TIMEOUT_SECONDS", 30)),
            token_leeway_seconds=int(getattr(settings, "QPAY_TOKEN_LEEWAY_SECONDS", 60)),
        )
        config.validate()
        return config

    def validate(self):
        missing = [
            name
            for name, value in (
                ("QPAY_CLIENT_ID", self.client_id),
                ("QPAY_CLIENT_SECRET", self.client_secret),
                ("QPAY_INVOICE_CODE", self.invoice_code),
                ("QPAY_CALLBACK_URL", self.callback_url),
            )
            if not value
        ]
        if missing:
            raise QPayConfigurationError(
                f"Missing required QPay configuration: {', '.join(missing)}"
            )


@dataclass
class QPayToken:
    access_token: str
    refresh_token: str | None
    expires_at: datetime
    raw_response: dict


class QPayClient:
    _shared_tokens = {}
    _shared_token_lock = Lock()

    def __init__(self, config=None, session=None, use_shared_token_cache=None):
        self.config = config or QPayConfig.from_settings()
        self.session = session or requests.Session()
        self._token: QPayToken | None = None
        self.use_shared_token_cache = (
            session is None
            if use_shared_token_cache is None
            else bool(use_shared_token_cache)
        )

    def get_access_token(self):
        if self._token and not self._token_is_expiring(self._token):
            return self._token.access_token

        cache_key = self._token_cache_key()
        if self.use_shared_token_cache:
            shared_token = self._shared_tokens.get(cache_key)
            if shared_token and not self._token_is_expiring(shared_token):
                self._token = shared_token
                return shared_token.access_token

            with self._shared_token_lock:
                shared_token = self._shared_tokens.get(cache_key)
                if shared_token and not self._token_is_expiring(shared_token):
                    self._token = shared_token
                    return shared_token.access_token
                self._token = self.fetch_token()
                self._shared_tokens[cache_key] = self._token
        else:
            self._token = self.fetch_token()
        return self._token.access_token

    def fetch_token(self):
        response = self.session.post(
            self.config.auth_url,
            headers={
                "Authorization": f"Basic {self._basic_credentials()}",
                "Content-Type": "application/json",
            },
            timeout=self.config.timeout_seconds,
        )

        if response.status_code >= 400:
            raise QPayAPIError(f"QPay auth failed with status {response.status_code}")

        data = response.json()
        access_token = data.get("access_token")
        if not access_token:
            raise QPayAPIError("QPay auth response did not include access_token")

        expires_value = int(data.get("expires_in") or data.get("expiresIn") or 0)
        now = timezone.now()
        if expires_value <= 0:
            expires_at = now + timedelta(seconds=3600)
        elif expires_value > int(now.timestamp()) + 300:
            # QPay production returns expires_in as an absolute Unix timestamp.
            expires_at = datetime.fromtimestamp(
                expires_value,
                tz=datetime_timezone.utc,
            )
        else:
            # Keep compatibility with OAuth providers/test doubles that return TTL seconds.
            expires_at = now + timedelta(seconds=expires_value)

        return QPayToken(
            access_token=access_token,
            refresh_token=data.get("refresh_token"),
            expires_at=expires_at,
            raw_response=data,
        )

    def create_invoice(
        self,
        *,
        sender_invoice_no,
        amount,
        description,
        receiver_code="terminal",
    ):
        payload = {
            "invoice_code": self.config.invoice_code,
            "sender_invoice_no": sender_invoice_no,
            "invoice_receiver_code": receiver_code,
            "invoice_description": description,
            "amount": int(amount),
            "callback_url": self._callback_url(sender_invoice_no),
            "allow_partial": False,
            "allow_exceed": False,
        }
        response = self.session.post(
            f"{self.config.base_url.rstrip('/')}/v2/invoice",
            json=payload,
            headers={
                "Authorization": f"Bearer {self.get_access_token()}",
                "Content-Type": "application/json",
            },
            timeout=self.config.timeout_seconds,
        )

        if response.status_code >= 400:
            raise QPayAPIError(
                f"QPay invoice create failed with status {response.status_code}"
            )

        data = response.json()
        if not data.get("invoice_id"):
            raise QPayAPIError("QPay invoice response did not include invoice_id")

        return data

    def check_payment(self, *, invoice_id):
        payload = {
            "object_type": "INVOICE",
            "object_id": invoice_id,
            "offset": {
                "page_number": 1,
                "page_limit": 100,
            },
        }
        response = self.session.post(
            f"{self.config.base_url.rstrip('/')}/v2/payment/check",
            json=payload,
            headers={
                "Authorization": f"Bearer {self.get_access_token()}",
                "Content-Type": "application/json",
            },
            timeout=self.config.timeout_seconds,
        )

        if response.status_code >= 400:
            raise QPayAPIError(
                f"QPay payment check failed with status {response.status_code}"
            )

        return response.json()

    def cancel_invoice(self, *, invoice_id):
        response = self.session.delete(
            f"{self.config.base_url.rstrip('/')}/v2/invoice/{invoice_id}",
            headers={
                "Authorization": f"Bearer {self.get_access_token()}",
                "Content-Type": "application/json",
            },
            timeout=self.config.timeout_seconds,
        )

        if response.status_code >= 400:
            raise QPayAPIError(
                f"QPay invoice cancel failed with status {response.status_code}"
            )

        try:
            return response.json()
        except ValueError:
            return {}

    def _basic_credentials(self):
        raw = f"{self.config.client_id}:{self.config.client_secret}".encode("utf-8")
        return base64.b64encode(raw).decode("ascii")

    def _token_is_expiring(self, token):
        leeway = timedelta(seconds=self.config.token_leeway_seconds)
        return token.expires_at <= timezone.now() + leeway

    def _token_cache_key(self):
        return (self.config.auth_url, self.config.client_id)

    def _callback_url(self, sender_invoice_no):
        parts = urlsplit(self.config.callback_url)
        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        query["sender_invoice_no"] = sender_invoice_no
        return urlunsplit(
            (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
        )
