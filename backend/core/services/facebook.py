"""Server-side Facebook authorization-code verification; secrets stay on the backend."""
import hashlib
import hmac
import re
import time
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email


class FacebookProviderError(Exception):
    pass


def configured():
    callback = urlparse(settings.FACEBOOK_REDIRECT_URI)
    frontend = urlparse(settings.FRONTEND_URL)
    return bool(
        settings.FACEBOOK_ENABLED
        and settings.FACEBOOK_APP_ID.isdigit()
        and settings.FACEBOOK_APP_SECRET
        and re.fullmatch(r"v\d+\.0", settings.FACEBOOK_GRAPH_VERSION)
        and callback.scheme == "https" and callback.netloc
        and not callback.query and not callback.fragment
        and frontend.scheme in {"https", "http"} and frontend.netloc
    )


def _get(path, **kwargs):
    try:
        response = requests.get(
            f"https://graph.facebook.com/{settings.FACEBOOK_GRAPH_VERSION}/{path}",
            timeout=15, **kwargs,
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict) or data.get("error"):
            raise FacebookProviderError()
        return data
    except (requests.RequestException, ValueError):
        # Do not surface request URLs containing credentials or provider error details.
        raise FacebookProviderError() from None


def exchange_code(code):
    token = _get("oauth/access_token", params={
        "client_id": settings.FACEBOOK_APP_ID,
        "client_secret": settings.FACEBOOK_APP_SECRET,
        "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
        "code": code,
    }).get("access_token")
    if not isinstance(token, str) or not token:
        raise FacebookProviderError()
    debug = _get("debug_token", params={"input_token": token}, headers={
        "Authorization": f"Bearer {settings.FACEBOOK_APP_ID}|{settings.FACEBOOK_APP_SECRET}",
    }).get("data", {})
    if not isinstance(debug, dict) or debug.get("is_valid") is not True or str(debug.get("app_id")) != settings.FACEBOOK_APP_ID:
        raise FacebookProviderError()
    facebook_id = str(debug.get("user_id", ""))
    if not facebook_id.isdigit() or len(facebook_id) > 128:
        raise FacebookProviderError()
    for field in ("expires_at", "data_access_expires_at"):
        expiry = debug.get(field)
        if expiry is not None and (not isinstance(expiry, (int, float)) or (expiry != 0 and expiry <= time.time())):
            raise FacebookProviderError()
    proof = hmac.new(settings.FACEBOOK_APP_SECRET.encode(), token.encode(), hashlib.sha256).hexdigest()
    profile = _get("me", params={"fields": "id,name,email", "appsecret_proof": proof}, headers={"Authorization": f"Bearer {token}"})
    if str(profile.get("id")) != facebook_id:
        raise FacebookProviderError()
    email = profile.get("email")
    email = email.strip().lower() if isinstance(email, str) else ""
    try:
        validate_email(email)
        if len(email) > 254:
            email = ""
    except ValidationError:
        email = ""
    name = profile.get("name")
    return {"facebook_id": facebook_id, "email": email, "name": name[:150] if isinstance(name, str) else ""}
