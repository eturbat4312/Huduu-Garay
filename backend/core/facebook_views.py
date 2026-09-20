import hashlib
import re
import secrets
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.core.mail import send_mail
from django.utils.crypto import salted_hmac
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import FacebookAccount, FacebookAuthFlow
from core.services.facebook import configured, exchange_code, FacebookProviderError

User = get_user_model()


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def secret_value(data, key):
    value = data.get(key)
    return value if isinstance(value, str) and 32 <= len(value) <= 256 else None


def tokens(user):
    refresh = RefreshToken.for_user(user)
    return {"status": "authenticated", "access": str(refresh.access_token), "refresh": str(refresh)}


def consume(flow):
    flow.delete()


class FacebookThrottle(AnonRateThrottle):
    scope = "facebook_auth"
    rate = "30/hour"


class FacebookLinkThrottle(UserRateThrottle):
    scope = "facebook_link"
    rate = "20/hour"


class PublicFacebookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [FacebookThrottle]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        response["Referrer-Policy"] = "no-referrer"
        return response


class FacebookConfigView(PublicFacebookView):
    throttle_classes = []

    def get(self, request):
        return Response({"enabled": configured()})


class FacebookStartView(PublicFacebookView):
    def post(self, request):
        if not configured():
            return Response({"error": "Facebook нэвтрэлт хараахан идэвхжээгүй байна."}, status=503)
        challenge = request.data.get("challenge")
        client = request.data.get("client", "web")
        locale = request.data.get("locale", "mn")
        intent = request.data.get("intent", "login")
        if not isinstance(challenge, str) or not re.fullmatch(r"[a-f0-9]{64}", challenge):
            return Response({"error": "Нэвтрэх хүсэлт буруу байна."}, status=400)
        if client not in ("web", "mobile") or locale not in ("mn", "en", "fr") or intent not in ("login", "connect"):
            return Response({"error": "Нэвтрэх хүсэлт буруу байна."}, status=400)
        FacebookAuthFlow.objects.filter(expires_at__lt=timezone.now()).delete()
        state = secrets.token_urlsafe(32)
        FacebookAuthFlow.objects.create(
            state_hash=digest(state), challenge=challenge, client=client, locale=locale, intent=intent,
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        params = urlencode({
            "client_id": settings.FACEBOOK_APP_ID,
            "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
            "state": state, "scope": "public_profile,email", "response_type": "code",
        })
        return Response({"authorization_url": f"https://www.facebook.com/{settings.FACEBOOK_GRAPH_VERSION}/dialog/oauth?{params}"})


class FacebookCallbackView(PublicFacebookView):
    def get(self, request):
        state = secret_value(request.query_params, "state")
        if not configured() or not state:
            return HttpResponse("Facebook нэвтрэх хүсэлт хүчингүй. Нэвтрэх хуудаснаас дахин эхлүүлнэ үү.", status=400)
        with transaction.atomic():
            flow = FacebookAuthFlow.objects.select_for_update().filter(
                state_hash=digest(state), status="started", expires_at__gt=timezone.now(),
            ).first()
            if flow is None:
                return HttpResponse("Нэвтрэх хүсэлт дууссан эсвэл ашиглагдсан байна. Дахин эхлүүлнэ үү.", status=400)
            flow.status = "verifying"
            flow.save(update_fields=["status"])
        profile = {}
        error = ""
        code = request.query_params.get("code", "")
        if request.query_params.get("error") == "access_denied":
            error = "cancelled"
        elif not code or len(code) > 4096 or request.query_params.get("error"):
            error = "provider_error"
        else:
            try:
                profile = exchange_code(code)
            except FacebookProviderError:
                error = "provider_error"
        exchange = secrets.token_urlsafe(32)
        FacebookAuthFlow.objects.filter(pk=flow.pk, status="verifying").update(
            status="ready", exchange_hash=digest(exchange), error=error, **profile,
        )
        destination = (
            "tanaidhonoy://facebook-callback" if flow.client == "mobile"
            else f"{settings.FRONTEND_URL}/{flow.locale}/facebook/callback"
        )
        # Django only allows HTTP(S) by default; this fixed app scheme is never supplied by clients.
        response = HttpResponse(status=302)
        response["Location"] = f"{destination}?{urlencode({'code': exchange})}"
        return response


class FacebookExchangeView(PublicFacebookView):
    def post(self, request):
        code = secret_value(request.data, "code")
        verifier = secret_value(request.data, "verifier")
        if not code or not verifier:
            return Response({"error": "Нэвтрэх мэдээлэл дутуу байна."}, status=400)
        with transaction.atomic():
            flow = FacebookAuthFlow.objects.select_for_update().filter(
                exchange_hash=digest(code), status="ready", expires_at__gt=timezone.now(),
            ).first()
            if flow is None or not secrets.compare_digest(flow.challenge, digest(verifier)):
                return Response({"error": "Нэвтрэх хүсэлт хүчингүй. Дахин эхлүүлнэ үү."}, status=400)
            if flow.error:
                error = flow.error
                consume(flow)
                return Response({"status": error})
            account = FacebookAccount.objects.select_related("user").filter(facebook_id=flow.facebook_id).first()
            if account and flow.intent == "login":
                consume(flow)
                if not account.user.is_active:
                    return Response({"error": "Энэ хэрэглэгчийн эрх идэвхгүй байна."}, status=403)
                return Response(tokens(account.user))
            pending = secrets.token_urlsafe(32)
            flow.status = "pending"
            flow.pending_hash = digest(pending)
            flow.exchange_hash = ""
            flow.save(update_fields=["status", "pending_hash", "exchange_hash"])
            existing_email = bool(flow.email and User.objects.filter(email__iexact=flow.email).exists())
            return Response({
                "status": "account_required", "pending_token": pending,
                "email": flow.email, "name": flow.name,
                "can_register": bool(flow.email and not existing_email and not account and flow.intent == "login"),
                "expires_at": flow.expires_at.isoformat(),
            })


def pending_flow(request):
    pending = secret_value(request.data, "pending_token")
    if pending is None:
        return None
    return FacebookAuthFlow.objects.select_for_update().filter(
        pending_hash=digest(pending), status="pending", expires_at__gt=timezone.now(),
    ).first()


def email_code_digest(flow, code):
    return salted_hmac("facebook-registration-email", f"{flow.pk}:{code}", algorithm="sha256").hexdigest()


class FacebookSendCodeView(PublicFacebookView):
    def post(self, request):
        with transaction.atomic():
            flow = pending_flow(request)
            if flow is None or not flow.email or flow.intent != "login":
                return Response({"error": "Баталгаажуулах хүсэлт хүчингүй байна."}, status=400)
            if User.objects.filter(email__iexact=flow.email).exists() or FacebookAccount.objects.filter(facebook_id=flow.facebook_id).exists():
                return Response({"error": "Бүртгэл байна. Өмнөх аккаунтаараа нэвтэрч холбоно уу."}, status=409)
            if flow.email_attempts >= 5:
                return Response({"error": "Хэт олон оролдлого хийсэн байна. Facebook-ээр дахин эхлүүлнэ үү."}, status=400)
            if flow.email_sent_at and flow.email_sent_at > timezone.now() - timedelta(minutes=1):
                return Response({"error": "Код дахин авахын өмнө нэг минут хүлээнэ үү."}, status=429)
            code = f"{secrets.randbelow(1000000):06d}"
            try:
                sent = send_mail(
                    "Танайд Хоноё — имэйл баталгаажуулах код",
                    f"Facebook-ээр шинэ бүртгэл үүсгэх код: {code}\n\n"
                    "Код зөвхөн энэ бүртгэлийн хүсэлтэд хүчинтэй. Нэвтрэх хүсэлт эхэлснээс 10 минутын дотор ашиглана уу.\n"
                    "Та хүсэлт гаргаагүй бол энэ имэйлийг үл тоомсорлоно уу.",
                    settings.DEFAULT_FROM_EMAIL, [flow.email], fail_silently=False,
                )
                if sent != 1:
                    raise RuntimeError()
            except Exception:
                return Response({"error": "Имэйл илгээж чадсангүй. Түр хүлээгээд дахин оролдоно уу."}, status=503)
            flow.email_code_hash = email_code_digest(flow, code)
            flow.email_sent_at = timezone.now()
            flow.save(update_fields=["email_code_hash", "email_sent_at"])
            return Response({"status": "code_sent"})


class FacebookRegisterView(PublicFacebookView):
    def post(self, request):
        if request.data.get("confirm_new_account") is not True:
            return Response({"error": "Шинэ аккаунт үүсгэхээ баталгаажуулна уу."}, status=400)
        try:
            with transaction.atomic():
                flow = pending_flow(request)
                if flow is None:
                    return Response({"error": "Холбох хүсэлт дууссан байна. Facebook-ээр дахин эхлүүлнэ үү."}, status=400)
                if flow.intent != "login" or not flow.email:
                    return Response({"error": "Эхлээд имэйлээр бүртгүүлж эсвэл өмнөх аккаунтаараа нэвтэрч Facebook-ээ холбоно уу."}, status=400)
                if User.objects.filter(email__iexact=flow.email).exists() or FacebookAccount.objects.filter(facebook_id=flow.facebook_id).exists():
                    return Response({"error": "Бүртгэл байна. Өмнөх аккаунтаараа нэвтэрч Facebook-ээ холбоно уу."}, status=409)
                code = request.data.get("email_code")
                if flow.email_attempts >= 5:
                    return Response({"error": "Хэт олон оролдлого хийсэн байна. Facebook-ээр дахин эхлүүлнэ үү."}, status=400)
                flow.email_attempts += 1
                flow.save(update_fields=["email_attempts"])
                if not isinstance(code, str) or not re.fullmatch(r"[0-9]{6}", code) or not flow.email_code_hash or not secrets.compare_digest(flow.email_code_hash, email_code_digest(flow, code)):
                    return Response({"error": "Имэйлд ирсэн 6 оронтой кодоо зөв оруулна уу."}, status=400)
                user = User.objects.create_user(
                    username=f"fb_{secrets.token_hex(12)}", email=flow.email,
                    password=None, full_name=flow.name,
                )
                FacebookAccount.objects.create(user=user, facebook_id=flow.facebook_id)
                consume(flow)
                return Response(tokens(user), status=201)
        except IntegrityError:
            return Response({"error": "Бүртгэл байна. Өмнөх аккаунтаараа нэвтэрнэ үү."}, status=409)


class FacebookConnectView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [FacebookLinkThrottle]

    def post(self, request):
        if request.data.get("confirm_link") is not True:
            return Response({"error": "Facebook холбохоо баталгаажуулна уу."}, status=400)
        try:
            with transaction.atomic():
                flow = pending_flow(request)
                if flow is None:
                    return Response({"error": "Холбох хүсэлт дууссан байна. Facebook-ээр дахин эхлүүлнэ үү."}, status=400)
                user = User.objects.select_for_update().get(pk=request.user.pk)
                if not user.is_active:
                    return Response({"error": "Энэ хэрэглэгчийн эрх идэвхгүй байна."}, status=403)
                account = FacebookAccount.objects.filter(facebook_id=flow.facebook_id).first()
                if account and account.user_id != user.pk:
                    return Response({"error": "Энэ Facebook өөр аккаунттай холбоотой байна."}, status=409)
                if FacebookAccount.objects.filter(user=user).exclude(facebook_id=flow.facebook_id).exists():
                    return Response({"error": "Таны аккаунтад өөр Facebook холбогдсон байна."}, status=409)
                if account is None:
                    FacebookAccount.objects.create(user=user, facebook_id=flow.facebook_id)
                consume(flow)
                return Response({"status": "connected"})
        except IntegrityError:
            return Response({"error": "Facebook өөр аккаунттай холбогдсон байна."}, status=409)
