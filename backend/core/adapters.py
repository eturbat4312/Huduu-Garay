from urllib.parse import urlencode

from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings


class AccountAdapter(DefaultAccountAdapter):
    """Send email-verification links back to the client that registered."""

    def get_email_confirmation_url(self, request, emailconfirmation):
        query = urlencode({"key": emailconfirmation.key})
        raw_request = getattr(request, "_request", request)
        client_platform = ""
        if raw_request is not None:
            client_platform = raw_request.META.get("HTTP_X_CLIENT_PLATFORM", "")
        if client_platform.lower() == "mobile":
            scheme = getattr(settings, "MOBILE_APP_SCHEME", "tanaidhonoy").rstrip(":/")
            return f"{scheme}://confirm-email?{query}"
        return f"{settings.FRONTEND_URL}/mn/confirm-email?{query}"
