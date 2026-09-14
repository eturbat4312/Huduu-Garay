import base64
from dataclasses import dataclass
from datetime import datetime
from datetime import timedelta

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
    def __init__(self, config=None, session=None):
        self.config = config or QPayConfig.from_settings()
        self.session = session or requests.Session()
        self._token: QPayToken | None = None

    def get_access_token(self):
        if self._token and not self._token_is_expiring(self._token):
            return self._token.access_token

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

        expires_in = int(data.get("expires_in") or data.get("expiresIn") or 0)
        if expires_in <= 0:
            expires_in = 3600

        return QPayToken(
            access_token=access_token,
            refresh_token=data.get("refresh_token"),
            expires_at=timezone.now() + timedelta(seconds=expires_in),
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
            "callback_url": self.config.callback_url,
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

    def _basic_credentials(self):
        raw = f"{self.config.client_id}:{self.config.client_secret}".encode("utf-8")
        return base64.b64encode(raw).decode("ascii")

    def _token_is_expiring(self, token):
        leeway = timedelta(seconds=self.config.token_leeway_seconds)
        return token.expires_at <= timezone.now() + leeway
