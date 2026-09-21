from urllib.parse import urlencode

from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings


class AccountAdapter(DefaultAccountAdapter):
    """Keep email-verification links on the public frontend."""

    def get_email_confirmation_url(self, request, emailconfirmation):
        query = urlencode({"key": emailconfirmation.key})
        return f"{settings.FRONTEND_URL}/mn/confirm-email?{query}"
