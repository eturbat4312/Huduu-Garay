from rest_framework import generics, status, permissions, serializers
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import RetrieveAPIView, RetrieveUpdateAPIView
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from datetime import timedelta
from PIL import Image, UnidentifiedImageError
from io import BytesIO
from django.core.files.base import ContentFile
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
from core.utils.email_notifications import send_notification_email
from core.services.qpay import QPayAPIError, QPayClient, QPayConfigurationError
from core.services.cancellations import (
    GUEST_CANCELLATION_POLICY_VERSION,
    HOST_CANCELLATION_POLICY_VERSION,
    guest_cancellation_blocked_reason,
    host_cancellation_blocked_reason,
)
from core.services.booking_times import local_now, stay_has_ended
from core.services.settlements import ensure_host_payout, sync_cancellation_settlements
from decimal import Decimal
from google.oauth2 import id_token
import logging
import uuid
from django.db import IntegrityError, transaction
from django.db.models import Q
# Claude: password reset imports
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.conf import settings

# from dj_rest_auth.jwt_auth import get_refresh_view


# from dj_rest_auth.registration.views import SocialLoginView

# from core.adapters import GoogleOneTapAdapter
# from allauth.socialaccount.providers.oauth2.client import OAuth2Client
# from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from rest_framework_simplejwt.tokens import RefreshToken


from .models import (
    Category,
    Listing,
    Availability,
    ListingImage,
    Amenity,
    Favorite,
    Booking,
    BookingHold,
    Payment,
    Notification,
    Review,
    HostApplication,
    SupportRequest,
)
from .serializers import (
    CategorySerializer,
    ListingSerializer,
    ListingImageSerializer,
    AvailabilitySerializer,
    AvailabilityBulkSerializer,
    SignupSerializer,
    BookingSerializer,
    PendingBookingCreateSerializer,
    PaymentCreateSerializer,
    PaymentSerializer,
    UserSerializer,
    AmenitySerializer,
    FavoriteSerializer,
    NotificationSerializer,
    ReviewSerializer,
    HostApplicationSerializer,
    SupportRequestSerializer,
    AnalyticsEventSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)
PAYMENT_HOLD_MINUTES = 15
ALLOWED_LISTING_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}


class AnalyticsEventThrottle(AnonRateThrottle):
    rate = "120/min"


class PaymentCheckThrottle(UserRateThrottle):
    rate = "30/min"


class QPayCallbackThrottle(AnonRateThrottle):
    rate = "120/min"


class AnalyticsEventCreateView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnalyticsEventThrottle]

    def post(self, request):
        serializer = AnalyticsEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"recorded": True},
            status=status.HTTP_201_CREATED if serializer.created else status.HTTP_200_OK,
        )

# ---------------------- AUTH ----------------------


class SignupView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]


class GoogleLogin(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get("id_token") or request.data.get("access_token")
        if not token:
            return Response(
                {"error": "Google нэвтрэх мэдээлэл дутуу байна."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_client_ids = set(settings.GOOGLE_CLIENT_IDS)
        if not allowed_client_ids:
            logger.error("Google login is enabled without GOOGLE_CLIENT_IDS")
            return Response(
                {"error": "Google нэвтрэх тохиргоо бүрэн хийгдээгүй байна."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request())
            audience = idinfo.get("aud")
            token_audiences = set(audience if isinstance(audience, list) else [audience])
            if not token_audiences.intersection(allowed_client_ids):
                return Response(
                    {"error": "Google нэвтрэх хүсэлт зөвшөөрөгдөөгүй байна."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            email = (idinfo.get("email") or "").strip().lower()
            email_verified = idinfo.get("email_verified") in {True, "true"}
            if not email or not email_verified:
                return Response(
                    {"error": "Google имэйл баталгаажаагүй байна."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            with transaction.atomic():
                matches = list(User.objects.filter(email__iexact=email)[:2])
                if len(matches) > 1:
                    return Response({"error": "Бүртгэлийн мэдээлэл давхардсан байна. Тусламжийн багтай холбогдоно уу."}, status=400)
                user = matches[0] if matches else None
                if user is None:
                    base_username = (email.split("@", 1)[0] or "google-user")[:150]
                    username = base_username
                    counter = 1
                    while User.objects.filter(username=username).exists():
                        suffix = str(counter)
                        username = f"{base_username[:150 - len(suffix)]}{suffix}"
                        counter += 1

                    user = User.objects.create_user(
                        username=username,
                        email=email,
                        password=None,
                        first_name=(idinfo.get("given_name") or "")[:150],
                        last_name=(idinfo.get("family_name") or "")[:150],
                    )

            if not user.is_active:
                return Response(
                    {"error": "Энэ хэрэглэгчийн эрх идэвхгүй байна."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                }
            )

        except (ValueError, IntegrityError):
            return Response(
                {"error": "Google нэвтрэх мэдээлэл хүчингүй байна."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception("Google token verification failed")
            return Response(
                {"error": "Google нэвтрэх үйлчилгээтэй холбогдож чадсангүй."},
                status=status.HTTP_502_BAD_GATEWAY,
            )


# class GoogleOneTapLoginView(SocialLoginView):
#     adapter_class = GoogleOneTapAdapter
#     callback_url = "http://localhost:3000"
#     client_class = OAuth2Client

#     def get_serializer(self, *args, **kwargs):
#         kwargs["data"] = {
#             "access_token": "",  # хоосон үлдээнэ
#             "code": None,
#             "id_token": self.request.data.get("access_token"),  # JWT
#         }
#         return super().get_serializer(*args, **kwargs)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


# ---------------------- CATEGORY ----------------------


class CategoryListCreateView(generics.ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get_serializer_context(self):
        return {"request": self.request}


# ---------------------- AMENITY ----------------------


class AmenityListView(generics.ListAPIView):
    serializer_class = AmenitySerializer

    def get_queryset(self):
        queryset = Amenity.objects.filter(is_active=True).prefetch_related("categories")
        category = self.request.query_params.get("category", "").strip()
        amenity_type = self.request.query_params.get("type", "").strip()
        common_only = self.request.query_params.get("common", "").lower()

        if category:
            category_filter = Q(categories__name__iexact=category)
            if category.isdigit():
                category_filter |= Q(categories__id=int(category))
            queryset = queryset.filter(Q(is_common=True) | category_filter).distinct()
        elif common_only in {"1", "true", "yes"}:
            queryset = queryset.filter(is_common=True)

        if amenity_type in {Amenity.TYPE_AMENITY, Amenity.TYPE_ACTIVITY}:
            queryset = queryset.filter(amenity_type=amenity_type)

        return queryset.order_by("-amenity_type", "sort_order", "name")


# ---------------------- LISTING ----------------------


class ListingListCreateView(generics.ListCreateAPIView):
    queryset = Listing.objects.all().prefetch_related("images", "category", "amenities")
    serializer_class = ListingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_context(self):
        return {"request": self.request}

    def get_queryset(self):
        queryset = Listing.objects.filter(
            is_active=True,
            status=Listing.STATUS_ACTIVE,
        ).prefetch_related("images", "category", "amenities")

        category = self.request.query_params.get("category")
        search = self.request.query_params.get("search")
        location = self.request.query_params.get("location")
        price_min = self.request.query_params.get("price_min")
        price_max = self.request.query_params.get("price_max")
        amenities = self.request.query_params.get("amenities")

        if category:
            queryset = queryset.filter(category__name__icontains=category)

        if search:
            queryset = queryset.filter(title__icontains=search)

        if location:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(location_city__icontains=location) | Q(location_district__icontains=location)
            )

        if price_min:
            queryset = queryset.filter(price_per_night__gte=price_min)

        if price_max:
            queryset = queryset.filter(price_per_night__lte=price_max)

        if amenities:
            names = [a.strip() for a in amenities.split(",") if a.strip()]
            for name in names:
                queryset = queryset.filter(amenities__name__iexact=name)

        return queryset

    def perform_create(self, serializer):
        if not self.request.user.is_host:
            raise serializers.ValidationError(
                {"detail": "Танд зар үүсгэх эрх байхгүй. Та эхлээд host бол. 🤷‍♂️"}
            )
        listing = serializer.save(host=self.request.user)
        Notification.objects.create(
            user=self.request.user,
            message=(
                f"Таны '{listing.title}' зар админы хяналтад амжилттай илгээгдлээ. "
                "Батлагдсаны дараа нийтэд харагдана."
            ),
            type="listing_review",
            related_listing=listing,
        )


class ListingRetrieveView(RetrieveAPIView):
    serializer_class = ListingSerializer

    def get_queryset(self):
        public_filter = Q(is_active=True, status=Listing.STATUS_ACTIVE)
        user = self.request.user
        if user.is_authenticated:
            if user.is_staff:
                return Listing.objects.all()
            return Listing.objects.filter(public_filter | Q(host=user))
        return Listing.objects.filter(public_filter)

    def get_serializer_context(self):
        return {"request": self.request}


# ---------------------- LISTING IMAGE ----------------------


class ListingImageUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, format=None):
        images = request.FILES.getlist("images")  # ✅ олон зураг дэмжих
        listing_id = request.data.get("listing")

        if not images or not listing_id:
            return Response(
                {"error": "Зураг болон listing ID шаардлагатай"}, status=400
            )

        try:
            from .models import Listing

            listing = Listing.objects.get(id=listing_id, host=request.user)

            processed_images = []

            for uploaded_image in images:
                if uploaded_image.content_type not in ALLOWED_LISTING_IMAGE_TYPES:
                    return Response(
                        {
                            "error": (
                                "Зөвхөн JPG, PNG, WebP эсвэл GIF зураг оруулна уу. "
                                "SVG файл дэмжигдэхгүй."
                            )
                        },
                        status=400,
                    )

                try:
                    image = Image.open(uploaded_image)
                    image.verify()
                    uploaded_image.seek(0)
                    image = Image.open(uploaded_image)
                except (UnidentifiedImageError, OSError):
                    return Response(
                        {
                            "error": (
                                "Зураг унших боломжгүй байна. JPG, PNG, WebP эсвэл GIF "
                                "форматтай зураг оруулна уу."
                            )
                        },
                        status=400,
                    )

                max_size = (1024, 768)
                image.thumbnail(max_size)

                buffer = BytesIO()
                image.convert("RGB").save(buffer, format="JPEG", quality=85)
                buffer.seek(0)

                final_image_file = ContentFile(buffer.read(), name="listing.jpg")
                processed_images.append(final_image_file)

            created_images = []
            for final_image_file in processed_images:
                new_image = ListingImage.objects.create(
                    listing=listing, image=final_image_file
                )
                created_images.append(new_image)

            serializer = ListingImageSerializer(
                created_images, many=True, context={"request": request}
            )
            return Response(serializer.data, status=201)

        except Listing.DoesNotExist:
            return Response(
                {"error": "Зар олдсонгүй эсвэл таны зар биш байна."}, status=404
            )
        except Exception as e:
            return Response(
                {"error": f"Зураг боловсруулахад алдаа гарлаа: {str(e)}"},
                status=400,
            )


class ListingImageDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, image_id):
        try:
            image = ListingImage.objects.get(id=image_id, listing__host=request.user)
            image.delete()
            return Response({"message": "Зураг амжилттай устгагдлаа"}, status=200)
        except ListingImage.DoesNotExist:
            return Response({"error": "Зураг олдсонгүй эсвэл таных биш"}, status=404)


# ---------------------- AVAILABILITY ----------------------


class AvailabilityListCreateView(generics.ListCreateAPIView):
    serializer_class = AvailabilitySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        _release_expired_booking_holds()
        public_filter = Q(
            listing__is_active=True,
            listing__status=Listing.STATUS_ACTIVE,
        )
        user = self.request.user
        if user.is_authenticated and user.is_staff:
            queryset = Availability.objects.all()
        elif user.is_authenticated:
            queryset = Availability.objects.filter(
                public_filter | Q(listing__host=user)
            )
        else:
            queryset = Availability.objects.filter(public_filter)
        listing_id = self.request.query_params.get("listing")
        if listing_id:
            queryset = queryset.filter(listing__id=listing_id)
        return queryset

    def perform_create(self, serializer):
        listing = serializer.validated_data["listing"]
        if not self.request.user.is_host or listing.host_id != self.request.user.id:
            raise PermissionDenied("Зөвхөн өөрийн зарын боломжит өдрийг нэмнэ.")
        serializer.save()


class AvailabilityBulkCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, format=None):
        serializer = AvailabilityBulkSerializer(data=request.data)
        if serializer.is_valid():
            listing = serializer.validated_data["listing"]
            if not request.user.is_host or listing.host_id != request.user.id:
                raise PermissionDenied("Зөвхөн өөрийн зарын боломжит өдрийг нэмнэ.")
            created = serializer.save()
            return Response(
                {"message": f"{len(created)} availability entries created."}, status=201
            )
        return Response(serializer.errors, status=400)


class AvailabilityDeleteView(generics.DestroyAPIView):
    queryset = Availability.objects.all()
    lookup_field = "id"
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(listing__host=self.request.user)


# ---------------------- BOOKING ----------------------


# views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from datetime import timedelta

from .models import Booking, Availability, Notification
from .serializers import BookingSerializer
from google.auth.transport import requests as google_requests


class BookingCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, format=None):
        if not settings.DEBUG:
            return Response(
                {
                    "error": "Захиалгыг зөвхөн төлбөрийн нэхэмжлэл үүсгэх шинэ үйлдлээр хийнэ үү."
                },
                status=status.HTTP_410_GONE,
            )
        serializer = BookingSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            listing = serializer.validated_data["listing"]
            check_in = serializer.validated_data["check_in"]
            check_out = serializer.validated_data["check_out"]
            guest = request.user

            if check_in == check_out:
                check_out += timedelta(days=1)

            full_name = serializer.validated_data["full_name"]
            phone_number = serializer.validated_data["phone_number"]
            notes = serializer.validated_data.get("notes", "")
            guest_count = serializer.validated_data["guest_count"]

            # Захиалгад багтах бүх өдөр
            date = check_in
            requested_dates = []
            while date < check_out:
                requested_dates.append(date)
                date += timedelta(days=1)

            available_dates = Availability.objects.filter(
                listing=listing, date__in=requested_dates
            ).values_list("date", flat=True)

            if set(requested_dates).issubset(set(available_dates)):
                # ✅ Үнийн тооцоо
                total_nights = len(requested_dates)
                base_price = listing.price_per_night or 0
                total_price = Decimal(total_nights * base_price)
                service_fee = (total_price * Decimal("0.10")).quantize(Decimal("1"))

                # ✅ Захиалгыг үүсгэх
                booking = Booking.objects.create(
                    listing=listing,
                    guest=guest,
                    check_in=check_in,
                    check_out=check_out,
                    full_name=full_name,
                    phone_number=phone_number,
                    notes=notes,
                    guest_count=guest_count,
                    total_price=total_price,
                    service_fee=service_fee,
                )

                # ✅ Хуваарь устгах
                Availability.objects.filter(
                    listing=listing, date__in=requested_dates
                ).delete()

                # Guest: нийт үнэ + 10% шимтгэл төлнө
                guest_fee = service_fee
                guest_total = int(total_price + guest_fee)
                # Host: нийт үнээс 10% шимтгэл хасагдана
                host_fee = (total_price * Decimal("0.10")).quantize(Decimal("1"))
                host_payout = int(total_price - host_fee)

                host_app = getattr(listing.host, "hostapplication", None)
                host_name = host_app.full_name if host_app else listing.host.username
                host_phone = host_app.phone_number if host_app else getattr(listing.host, "phone", "") or "—"

                # Host-д notification
                Notification.objects.create(
                    user=listing.host,
                    message=(
                        f"Шинэ захиалга #{booking.id} — {full_name} таны '{listing.title}' байранд "
                        f"{check_in.strftime('%Y-%m-%d')} 14:00 – {check_out.strftime('%Y-%m-%d')} 12:00 "
                        f"({total_nights} хонох), {guest_count} зочин. Таны авах мөнгө: ₮{host_payout:,}"
                    ),
                    type="booking_created",
                    related_booking=booking,
                )

                # Guest-д notification
                Notification.objects.create(
                    user=guest,
                    message=(
                        f"Захиалга #{booking.id} баталгаажлаа — '{listing.title}', "
                        f"{check_in.strftime('%Y-%m-%d')} 14:00 – {check_out.strftime('%Y-%m-%d')} 12:00 "
                        f"({total_nights} хонох). Нийт төлөх дүн: ₮{guest_total:,}"
                    ),
                    type="booking_confirmed",
                    related_booking=booking,
                )

                # Host-д email
                try:
                    send_notification_email(
                        user=listing.host,
                        notif_type="booking_created",
                        context={
                            "booking_id": booking.id,
                            "listing_title": listing.title,
                            "guest_name": guest.username,
                            "full_name": full_name,
                            "phone_number": phone_number,
                            "check_in": check_in.strftime("%Y-%m-%d 14:00"),
                            "check_out": check_out.strftime("%Y-%m-%d 12:00"),
                            "total_nights": total_nights,
                            "guest_count": guest_count,
                            "total_price": int(total_price),
                            "host_fee": int(host_fee),
                            "host_payout": host_payout,
                        },
                    )
                except Exception as e:
                    print(f"❌ Host email илгээхэд алдаа гарлаа: {e}")

                # ✅ Guest-д email — бүрэн мэдээлэлтэй
                try:
                    send_notification_email(
                        user=guest,
                        notif_type="booking_confirmed",
                        context={
                            "booking_id": booking.id,
                            "listing_title": listing.title,
                            "location_city": listing.location_city,
                            "location_district": listing.location_district,
                            "location_khoroo": listing.location_khoroo,
                            "location_extra": listing.location_extra,
                            "location_building": listing.location_building,
                            "location_apartment": listing.location_apartment,
                            "location_lat": listing.location_lat,
                            "location_lng": listing.location_lng,
                            "check_in": check_in.strftime("%Y-%m-%d 14:00"),
                            "check_out": check_out.strftime("%Y-%m-%d 12:00"),
                            "total_nights": total_nights,
                            "guest_count": guest_count,
                            "full_name": full_name,
                            "phone_number": phone_number,
                            "host_name": host_name,
                            "host_phone": host_phone or "—",
                            "total_price": int(total_price),
                            "guest_fee": int(guest_fee),
                            "guest_total": guest_total,
                        },
                    )
                except Exception as e:
                    print(f"❌ Guest email илгээхэд алдаа гарлаа: {e}")

                return Response(
                    BookingSerializer(booking, context={"request": request}).data,
                    status=status.HTTP_201_CREATED,
                )

            return Response(
                {"error": "Сонгосон огнооны зарим нь боломжгүй байна."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def _get_requested_dates(check_in, check_out):
    if check_in == check_out:
        check_out += timedelta(days=1)

    date = check_in
    requested_dates = []
    while date < check_out:
        requested_dates.append(date)
        date += timedelta(days=1)
    return requested_dates, check_out


def _calculate_booking_amounts(listing, total_nights):
    total_price = Decimal(total_nights * (listing.price_per_night or 0))
    service_fee = (total_price * Decimal("0.10")).quantize(Decimal("1"))
    return int(total_price), int(service_fee)


def _availability_is_available(listing, requested_dates, lock=False):
    queryset = Availability.objects
    if lock:
        queryset = queryset.select_for_update()
    available_dates = queryset.filter(listing=listing, date__in=requested_dates).values_list(
        "date", flat=True
    )
    return set(requested_dates).issubset(set(available_dates))


def _hold_availability_for_booking(booking, requested_dates):
    available_rows = list(
        Availability.objects.select_for_update().filter(
            listing=booking.listing, date__in=requested_dates
        )
    )
    available_dates = {row.date for row in available_rows}
    if not set(requested_dates).issubset(available_dates):
        return False

    holds = [
        BookingHold(booking=booking, listing=booking.listing, date=target_date)
        for target_date in requested_dates
    ]
    BookingHold.objects.bulk_create(holds)
    Availability.objects.filter(
        listing=booking.listing, date__in=requested_dates
    ).delete()
    return True


def _booking_has_hold(booking, requested_dates, lock=False):
    queryset = BookingHold.objects
    if lock:
        queryset = queryset.select_for_update()
    held_dates = queryset.filter(
        booking=booking, listing=booking.listing, date__in=requested_dates
    ).values_list("date", flat=True)
    return set(requested_dates).issubset(set(held_dates))


def _release_booking_hold(booking, now=None):
    expired_at = now or timezone.now()
    hold_rows = list(
        BookingHold.objects.select_for_update().filter(
            booking=booking, listing=booking.listing
        )
    )

    for hold in hold_rows:
        Availability.objects.get_or_create(listing=booking.listing, date=hold.date)

    if hold_rows:
        BookingHold.objects.filter(id__in=[hold.id for hold in hold_rows]).delete()

    booking.status = "expired"
    booking.save(update_fields=["status"])

    pending_payments = list(
        Payment.objects.select_for_update().filter(
            booking=booking,
            status=Payment.STATUS_PENDING,
        )
    )
    for payment in pending_payments:
        payment.status = Payment.STATUS_EXPIRED
        payment.raw_response = {
            **(payment.raw_response or {}),
            "expired_reason": "payment_hold_expired",
            "expired_at": expired_at.isoformat(),
        }
        payment.save(update_fields=["status", "raw_response", "updated_at"])

        if (
            settings.QPAY_ENABLED
            and payment.provider == Payment.PROVIDER_QPAY
            and payment.invoice_id
            and not payment.invoice_id.startswith("mock-")
        ):
            transaction.on_commit(
                lambda payment_id=payment.id, invoice_id=payment.invoice_id: (
                    _cancel_expired_qpay_invoice(payment_id, invoice_id)
                )
            )
    return len(hold_rows)


def _cancel_expired_qpay_invoice(payment_id, invoice_id):
    cancelled = False
    error_code = ""
    try:
        QPayClient().cancel_invoice(invoice_id=invoice_id)
        cancelled = True
    except QPayConfigurationError:
        error_code = "configuration_error"
        logger.warning("QPay invoice cancellation is not configured for payment %s", payment_id)
    except QPayAPIError:
        error_code = "provider_error"
        logger.exception("QPay invoice cancellation failed for payment %s", payment_id)

    payment = Payment.objects.filter(
        id=payment_id,
        status=Payment.STATUS_EXPIRED,
    ).first()
    if payment is None:
        return
    payment.raw_response = {
        **(payment.raw_response or {}),
        "qpay_invoice_cancelled": cancelled,
        "qpay_invoice_cancel_error": error_code,
    }
    payment.save(update_fields=["raw_response", "updated_at"])


def _release_expired_booking_holds(now=None):
    now = now or timezone.now()
    expired_bookings = (
        Booking.objects.select_for_update()
        .filter(status="pending_payment", hold_expires_at__isnull=False)
        .filter(hold_expires_at__lte=now)
        .select_related("listing")
    )
    released = 0
    with transaction.atomic():
        for booking in expired_bookings:
            released += _release_booking_hold(booking, now=now)
    return released


def _booking_hold_is_expired(booking, now=None):
    return (
        booking.status == "pending_payment"
        and booking.hold_expires_at is not None
        and booking.hold_expires_at <= (now or timezone.now())
    )


def _payment_check_is_paid(check_response, *, expected_amount, expected_currency="MNT"):
    if not isinstance(check_response, dict):
        return False
    rows = (
        check_response.get("rows")
        or check_response.get("items")
        or check_response.get("payments")
        or []
    )
    for row in rows:
        if not isinstance(row, dict):
            continue
        if str(row.get("payment_status") or "").upper() != "PAID":
            continue
        if str(row.get("payment_currency") or "").upper() != expected_currency.upper():
            continue
        try:
            paid_amount = Decimal(str(row.get("payment_amount")))
        except (TypeError, ValueError, ArithmeticError):
            continue
        if paid_amount == Decimal(str(expected_amount)):
            return True
    return False


def _get_booking_party_details(booking, requested_dates):
    listing = booking.listing
    total_nights = len(requested_dates)
    total_price = int(booking.total_price or 0)
    service_fee = int(booking.service_fee or 0)
    guest_total = total_price + service_fee
    host_fee = int((Decimal(total_price) * Decimal("0.10")).quantize(Decimal("1")))
    host_payout = total_price - host_fee
    host_app = getattr(listing.host, "hostapplication", None)

    return {
        "listing": listing,
        "total_nights": total_nights,
        "total_price": total_price,
        "service_fee": service_fee,
        "guest_total": guest_total,
        "host_fee": host_fee,
        "host_payout": host_payout,
        "host_name": host_app.full_name if host_app else listing.host.username,
        "host_phone": host_app.phone_number
        if host_app
        else getattr(listing.host, "phone", "") or "—",
    }


def _create_notification_once(user, notif_type, related_booking, message):
    if Notification.objects.filter(
        user=user, type=notif_type, related_booking=related_booking
    ).exists():
        return

    Notification.objects.create(
        user=user,
        type=notif_type,
        related_booking=related_booking,
        message=message,
    )


def _notify_confirmed_booking(booking, payment, requested_dates):
    details = _get_booking_party_details(booking, requested_dates)
    listing = details["listing"]
    check_in = booking.check_in.strftime("%Y-%m-%d 14:00")
    check_out = booking.check_out.strftime("%Y-%m-%d 12:00")

    _create_notification_once(
        user=listing.host,
        notif_type="booking_created",
        related_booking=booking,
        message=(
            f"Шинэ захиалга #{booking.id} — {booking.full_name} таны '{listing.title}' "
            f"байранд {check_in} – {check_out} ({details['total_nights']} хонох), "
            f"{booking.guest_count} зочин. Таны авах мөнгө: ₮{details['host_payout']:,}"
        ),
    )

    _create_notification_once(
        user=booking.guest,
        notif_type="booking_confirmed",
        related_booking=booking,
        message=(
            f"Захиалга #{booking.id} баталгаажлаа — '{listing.title}', "
            f"{check_in} – {check_out} ({details['total_nights']} хонох). "
            f"Нийт төлсөн дүн: ₮{details['guest_total']:,}"
        ),
    )

    admin_message = (
        f"Шинэ төлбөртэй захиалга #{booking.id} баталгаажлаа. "
        f"Зар: '{listing.title}' #{listing.id}. "
        f"Түрээслүүлэгч: {details['host_name']} ({listing.host.username}), утас: {details['host_phone']}. "
        f"Зочин: {booking.full_name} ({booking.guest.username}), утас: {booking.phone_number}. "
        f"Огноо: {check_in} – {check_out}, {details['total_nights']} хонох, "
        f"{booking.guest_count} зочин. Байршил: {listing.location_city}, "
        f"{listing.location_district}, {listing.location_khoroo}. "
        f"Үндсэн үнэ: ₮{details['total_price']:,}, зочны үйлчилгээний шимтгэл: ₮{details['service_fee']:,}, "
        f"нийт төлсөн: ₮{details['guest_total']:,}, түрээслүүлэгчид олгох: ₮{details['host_payout']:,}. "
        f"Payment #{payment.id}, invoice: {payment.invoice_id or payment.sender_invoice_no}."
    )
    admin_users = User.objects.filter(is_staff=True, is_active=True)
    for admin_user in admin_users:
        _create_notification_once(
            user=admin_user,
            notif_type="admin_booking",
            related_booking=booking,
            message=admin_message,
        )

    email_context = {
        "booking_id": booking.id,
        "payment_id": payment.id,
        "invoice_id": payment.invoice_id or payment.sender_invoice_no,
        "listing_id": listing.id,
        "listing_title": listing.title,
        "location_city": listing.location_city,
        "location_district": listing.location_district,
        "location_khoroo": listing.location_khoroo,
        "location_extra": listing.location_extra,
        "location_building": listing.location_building,
        "location_apartment": listing.location_apartment,
        "location_lat": listing.location_lat,
        "location_lng": listing.location_lng,
        "location": ", ".join(
            filter(
                None,
                [
                    listing.location_city,
                    listing.location_district,
                    listing.location_khoroo,
                    listing.location_extra,
                    listing.location_building,
                    listing.location_apartment,
                ],
            )
        ),
        "check_in": check_in,
        "check_out": check_out,
        "total_nights": details["total_nights"],
        "guest_count": booking.guest_count,
        "full_name": booking.full_name,
        "guest_full_name": booking.full_name,
        "guest_username": booking.guest.username,
        "guest_phone": booking.phone_number,
        "phone_number": booking.phone_number,
        "host_name": details["host_name"],
        "host_username": listing.host.username,
        "host_phone": details["host_phone"],
        "total_price": details["total_price"],
        "guest_fee": details["service_fee"],
        "service_fee": details["service_fee"],
        "guest_total": details["guest_total"],
        "host_fee": details["host_fee"],
        "host_payout": details["host_payout"],
    }

    try:
        send_notification_email(
            user=listing.host,
            notif_type="booking_created",
            context=email_context,
        )
    except Exception as e:
        print(f"❌ Host email илгээхэд алдаа гарлаа: {e}")

    try:
        send_notification_email(
            user=booking.guest,
            notif_type="booking_confirmed",
            context=email_context,
        )
    except Exception as e:
        print(f"❌ Guest email илгээхэд алдаа гарлаа: {e}")

    for admin_user in admin_users:
        if not admin_user.email:
            continue
        try:
            send_notification_email(
                user=admin_user,
                notif_type="admin_booking_confirmed",
                context=email_context,
            )
        except Exception as e:
            print(f"❌ Admin email илгээхэд алдаа гарлаа: {e}")


def _confirm_paid_payment(payment, raw_response, request=None):
    booking = Booking.objects.select_for_update().get(id=payment.booking_id)

    if payment.status == Payment.STATUS_PAID:
        return payment, None

    if booking.status == "cancelled" or booking.is_cancelled_by_host:
        return payment, "Цуцлагдсан захиалгын төлбөрийг дахин баталгаажуулах боломжгүй."

    if payment.status != Payment.STATUS_PENDING:
        return payment, "Зөвхөн pending төлбөрийг баталгаажуулна."

    if _booking_hold_is_expired(booking):
        _release_booking_hold(booking)
        payment.status = Payment.STATUS_EXPIRED
        payment.raw_response = {
            **payment.raw_response,
            "qpay_check": raw_response,
            "confirm_error": "hold_expired",
        }
        payment.save(update_fields=["status", "raw_response", "updated_at"])
        return payment, "Төлбөрийн хугацаа дууссан байна."

    requested_dates, _ = _get_requested_dates(booking.check_in, booking.check_out)
    if not _booking_has_hold(booking, requested_dates, lock=True):
        payment.status = Payment.STATUS_FAILED
        payment.raw_response = {
            **payment.raw_response,
            "qpay_check": raw_response,
            "confirm_error": "hold_missing",
        }
        payment.save(update_fields=["status", "raw_response", "updated_at"])
        booking.status = "payment_failed"
        booking.save(update_fields=["status"])
        return payment, "Сонгосон огноо өөр захиалгад орсон байна."

    payment.status = Payment.STATUS_PAID
    payment.paid_at = timezone.now()
    payment.raw_response = {
        **payment.raw_response,
        "qpay_check": raw_response,
    }
    payment.save(update_fields=["status", "paid_at", "raw_response", "updated_at"])

    booking.status = "confirmed"
    booking.save(update_fields=["status"])
    ensure_host_payout(booking)
    payment.booking = booking
    BookingHold.objects.filter(
        booking=booking, listing=booking.listing, date__in=requested_dates
    ).delete()
    _notify_confirmed_booking(booking, payment, requested_dates)
    return payment, None


class BookingPaymentIntentCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, format=None):
        _release_expired_booking_holds()
        serializer = PendingBookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        idempotency_key = request.headers.get("X-Idempotency-Key") or None
        if idempotency_key:
            existing = Booking.objects.filter(
                guest=request.user, payment_intent_key=idempotency_key
            ).first()
            if existing:
                return Response(
                    {
                        "booking": BookingSerializer(
                            existing, context={"request": request}
                        ).data,
                        "service_fee": existing.service_fee,
                        "payment_required_amount": existing.total_price
                        + existing.service_fee,
                    },
                    status=status.HTTP_200_OK,
                )

        listing = serializer.validated_data["listing"]
        check_in = serializer.validated_data["check_in"]
        check_out = serializer.validated_data["check_out"]
        requested_dates, check_out = _get_requested_dates(check_in, check_out)

        total_price, service_fee = _calculate_booking_amounts(
            listing, len(requested_dates)
        )

        try:
            with transaction.atomic():
                booking = Booking.objects.create(
                    listing=listing,
                    guest=request.user,
                    check_in=check_in,
                    check_out=check_out,
                    full_name=serializer.validated_data["full_name"],
                    phone_number=serializer.validated_data["phone_number"],
                    notes=serializer.validated_data.get("notes", ""),
                    guest_count=serializer.validated_data["guest_count"],
                    total_price=total_price,
                    service_fee=service_fee,
                    status="pending_payment",
                    payment_intent_key=idempotency_key,
                    hold_expires_at=timezone.now()
                    + timedelta(minutes=PAYMENT_HOLD_MINUTES),
                )

                if not _hold_availability_for_booking(booking, requested_dates):
                    raise ValidationError(
                        {"error": "Сонгосон огнооны зарим нь боломжгүй байна."}
                    )
        except IntegrityError:
            if not idempotency_key:
                raise
            booking = Booking.objects.get(
                guest=request.user, payment_intent_key=idempotency_key
            )
            return Response(
                {
                    "booking": BookingSerializer(
                        booking, context={"request": request}
                    ).data,
                    "service_fee": booking.service_fee,
                    "payment_required_amount": booking.total_price
                    + booking.service_fee,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "booking": BookingSerializer(booking, context={"request": request}).data,
                "service_fee": booking.service_fee,
                "payment_required_amount": booking.total_price + booking.service_fee,
            },
            status=status.HTTP_201_CREATED,
        )


class PaymentCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, format=None):
        _release_expired_booking_holds()
        serializer = PaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        booking = serializer.validated_data["booking"]
        if booking.guest_id != request.user.id:
            return Response({"error": "Захиалга олдсонгүй."}, status=404)

        if _booking_hold_is_expired(booking):
            with transaction.atomic():
                booking = (
                    Booking.objects.select_for_update()
                    .select_related("listing")
                    .get(id=booking.id)
                )
                if _booking_hold_is_expired(booking):
                    _release_booking_hold(booking)
            return Response(
                {"error": "Төлбөрийн хугацаа дууссан байна."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if booking.status != "pending_payment":
            return Response(
                {"error": "Зөвхөн төлбөр хүлээгдэж буй захиалгад invoice үүсгэнэ."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        idempotency_key = request.headers.get("X-Idempotency-Key") or None
        if idempotency_key:
            existing = Payment.objects.filter(
                booking=booking, idempotency_key=idempotency_key
            ).first()
            if existing:
                return Response(
                    PaymentSerializer(existing, context={"request": request}).data,
                    status=status.HTTP_200_OK,
                )

        existing_pending = Payment.objects.filter(
            booking=booking, status=Payment.STATUS_PENDING
        ).first()
        if existing_pending:
            return Response(
                PaymentSerializer(existing_pending, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )

        sender_invoice_no = f"booking-{booking.id}-{uuid.uuid4().hex[:12]}"
        amount = booking.total_price + booking.service_fee
        invoice_id = f"mock-{sender_invoice_no}"
        raw_response = {
            "provider": Payment.PROVIDER_QPAY,
            "mode": "mock",
            "message": "QPay adapter will replace this mock invoice in Phase 3.",
        }

        if settings.QPAY_ENABLED:
            try:
                invoice_response = QPayClient().create_invoice(
                    sender_invoice_no=sender_invoice_no,
                    amount=amount,
                    description=f"Танайд Хоноё захиалга #{booking.id}",
                )
            except QPayConfigurationError as exc:
                return Response(
                    {"error": str(exc)},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            except QPayAPIError:
                return Response(
                    {"error": "QPay invoice үүсгэхэд алдаа гарлаа."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            invoice_id = invoice_response["invoice_id"]
            raw_response = invoice_response

        try:
            payment = Payment.objects.create(
                booking=booking,
                provider=Payment.PROVIDER_QPAY,
                sender_invoice_no=sender_invoice_no,
                invoice_id=invoice_id,
                idempotency_key=idempotency_key,
                amount=amount,
                raw_response=raw_response,
            )
        except IntegrityError:
            if not idempotency_key:
                raise
            payment = Payment.objects.get(
                booking=booking, idempotency_key=idempotency_key
            )
            return Response(
                PaymentSerializer(payment, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )

        return Response(
            PaymentSerializer(payment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class PaymentRetrieveView(RetrieveAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def retrieve(self, request, *args, **kwargs):
        _release_expired_booking_holds()
        return super().retrieve(request, *args, **kwargs)

    def get_queryset(self):
        return Payment.objects.filter(booking__guest=self.request.user).select_related(
            "booking", "booking__listing", "booking__guest", "booking__listing__host"
        )


class PaymentCheckView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [PaymentCheckThrottle]

    def post(self, request, payment_id, format=None):
        _release_expired_booking_holds()

        try:
            payment = (
                Payment.objects.select_related("booking", "booking__listing")
                .get(id=payment_id, booking__guest=request.user)
            )
        except Payment.DoesNotExist:
            return Response({"error": "Төлбөр олдсонгүй."}, status=404)

        if payment.status == Payment.STATUS_PAID:
            return Response(
                PaymentSerializer(payment, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )

        if payment.status != Payment.STATUS_PENDING:
            return Response(
                {"error": "Зөвхөн pending төлбөрийг шалгана."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not settings.QPAY_ENABLED:
            return Response(
                PaymentSerializer(payment, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )

        try:
            check_response = QPayClient().check_payment(invoice_id=payment.invoice_id)
        except (QPayConfigurationError, QPayAPIError):
            return Response(
                {"error": "QPay төлбөр шалгахад алдаа гарлаа."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if not _payment_check_is_paid(
            check_response,
            expected_amount=payment.amount,
            expected_currency=payment.currency,
        ):
            payment.raw_response = {
                **payment.raw_response,
                "last_qpay_check": check_response,
            }
            payment.save(update_fields=["raw_response", "updated_at"])
            return Response(
                PaymentSerializer(payment, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )

        with transaction.atomic():
            payment = (
                Payment.objects.select_for_update()
                .select_related("booking", "booking__listing")
                .get(id=payment_id, booking__guest=request.user)
            )
            payment, error_message = _confirm_paid_payment(
                payment,
                {
                    "manual_check": True,
                    "payment_check": check_response,
                },
                request=request,
            )
            if error_message:
                return Response({"error": error_message}, status=status.HTTP_409_CONFLICT)

        return Response(
            PaymentSerializer(payment, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class PaymentMockConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, payment_id, format=None):
        if not settings.DEBUG:
            return Response({"error": "Not found."}, status=404)

        _release_expired_booking_holds()
        with transaction.atomic():
            try:
                payment = (
                    Payment.objects.select_for_update()
                    .select_related("booking", "booking__listing")
                    .get(id=payment_id, booking__guest=request.user)
                )
            except Payment.DoesNotExist:
                return Response({"error": "Төлбөр олдсонгүй."}, status=404)

            booking = Booking.objects.select_for_update().get(id=payment.booking_id)

            if payment.status == Payment.STATUS_PAID and booking.status == "confirmed":
                return Response(
                    PaymentSerializer(payment, context={"request": request}).data,
                    status=status.HTTP_200_OK,
                )

            if payment.status != Payment.STATUS_PENDING:
                return Response(
                    {"error": "Зөвхөн pending төлбөрийг баталгаажуулна."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment, error_message = _confirm_paid_payment(
                payment,
                {
                    "mock_confirmed": True,
                    "confirmed_at": timezone.now().isoformat(),
                },
                request=request,
            )
            if error_message:
                return Response(
                    {"error": error_message},
                    status=status.HTTP_409_CONFLICT,
                )

        return Response(
            PaymentSerializer(payment, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class QPayCallbackView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [QPayCallbackThrottle]

    def post(self, request, format=None):
        sender_invoice_no = (
            request.data.get("sender_invoice_no")
            or request.query_params.get("sender_invoice_no")
        )
        callback_reference = (
            request.data.get("invoice_id")
            or request.data.get("object_id")
            or request.data.get("payment_id")
            or request.query_params.get("invoice_id")
            or request.query_params.get("object_id")
            or request.query_params.get("payment_id")
        )
        if not sender_invoice_no and not callback_reference:
            return Response({"error": "Төлбөрийн лавлах дугаар дутуу байна."}, status=400)

        _release_expired_booking_holds()

        payment_query = Payment.objects.select_related(
            "booking", "booking__listing"
        ).filter(provider=Payment.PROVIDER_QPAY)
        if sender_invoice_no:
            payment = payment_query.filter(sender_invoice_no=sender_invoice_no).first()
        else:
            payment = payment_query.filter(invoice_id=callback_reference).first()

        if payment is None:
            return Response({"error": "Төлбөр олдсонгүй."}, status=404)

        if payment.status == Payment.STATUS_PAID:
            return Response(
                PaymentSerializer(payment, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )

        try:
            check_response = QPayClient().check_payment(invoice_id=payment.invoice_id)
        except (QPayConfigurationError, QPayAPIError):
            return Response(
                {"error": "QPay төлбөр шалгахад алдаа гарлаа."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if not _payment_check_is_paid(
            check_response,
            expected_amount=payment.amount,
            expected_currency=payment.currency,
        ):
            return Response({"status": "pending"}, status=status.HTTP_202_ACCEPTED)

        with transaction.atomic():
            try:
                payment = (
                    Payment.objects.select_for_update()
                    .select_related("booking", "booking__listing")
                    .get(pk=payment.pk)
                )
            except Payment.DoesNotExist:
                return Response({"error": "Төлбөр олдсонгүй."}, status=404)

            payment, error_message = _confirm_paid_payment(
                payment,
                {
                    "callback": request.data,
                    "payment_check": check_response,
                },
                request=request,
            )
            if error_message:
                return Response({"error": error_message}, status=status.HTTP_409_CONFLICT)

        return Response(
            PaymentSerializer(payment, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class BookingRetrieveView(RetrieveAPIView):
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Booking.objects.filter(guest=self.request.user)


# ---------------------- FAVORITE ----------------------


class FavoriteCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = FavoriteSerializer(data=request.data)
        if serializer.is_valid():
            listing = serializer.validated_data["listing"]
            favorite, created = Favorite.objects.get_or_create(
                user=request.user, listing=listing
            )
            return Response(FavoriteSerializer(favorite).data, status=201)
        return Response(serializer.errors, status=400)


class FavoriteDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FavoriteSerializer
    queryset = Favorite.objects.all()
    lookup_field = "id"

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)


class FavoriteListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FavoriteSerializer

    def get_queryset(self):
        return Favorite.objects.filter(
            user=self.request.user,
            listing__is_active=True,
            listing__status=Listing.STATUS_ACTIVE,
        )


class MyBookingView(generics.ListAPIView):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Booking.objects.filter(guest=self.request.user)
            .select_related("listing")
            .prefetch_related("listing__images")
        )


class HostBookingListView(ListAPIView):
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return (
            Booking.objects.filter(listing__host=user)
            .select_related("listing")
            .order_by("-created_at")
        )  # 🟢 Шинэ захиалга дээрээ гарна

    def get_serializer_context(self):
        return {"request": self.request}


class GuestBookingCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, booking_id):
        with transaction.atomic():
            try:
                booking = Booking.objects.select_for_update().get(
                    id=booking_id, guest=request.user
                )
            except Booking.DoesNotExist:
                return Response({"error": "Захиалга олдсонгүй."}, status=404)

            # A retry must never reopen dates that another guest has since booked.
            if booking.guest_cancelled_at:
                return Response(BookingSerializer(booking, context={"request": request}).data)

            blocked_reason = guest_cancellation_blocked_reason(booking)
            if blocked_reason:
                return Response({"error": blocked_reason}, status=400)
            if request.data.get("policy_accepted") is not True:
                return Response({"error": "Буцаалтын нөхцөлтэй танилцсанаа тэмдэглэнэ үү."}, status=400)
            if request.data.get("policy_version") != GUEST_CANCELLATION_POLICY_VERSION:
                return Response({"error": "Нөхцөл шинэчлэгдсэн байна. Хуудсаа шинэчилж дахин уншина уу."}, status=409)
            reason = request.data.get("reason", "")
            if not isinstance(reason, str) or len(reason) > 1000:
                return Response({"error": "Шалтгааныг 1000 хүртэлх тэмдэгтээр бичнэ үү."}, status=400)

            booking.status = "cancelled"
            booking.guest_cancelled_at = timezone.now()
            booking.guest_cancellation_reason = reason.strip()
            booking.guest_cancellation_policy_version = GUEST_CANCELLATION_POLICY_VERSION
            booking.save(update_fields=[
                "status", "guest_cancelled_at", "guest_cancellation_reason",
                "guest_cancellation_policy_version",
            ])
            sync_cancellation_settlements(booking)
            dates, _ = _get_requested_dates(booking.check_in, booking.check_out)
            for target_date in dates:
                Availability.objects.get_or_create(listing=booking.listing, date=target_date)
            BookingHold.objects.filter(booking=booking).delete()

            summary = (
                f"Зочин захиалга #{booking.id}-г цуцаллаа. {booking.listing.title}, "
                f"{booking.check_in} - {booking.check_out}. "
                "Төлбөрийн буцаалт болон олголтыг ажилтан гараар хянан шийдвэрлэнэ."
            )
            recipients = {booking.guest_id: booking.guest, booking.listing.host_id: booking.listing.host}
            recipients.update({user.pk: user for user in User.objects.filter(is_staff=True, is_active=True)})
            context = {
                "booking_id": booking.id,
                "listing_title": booking.listing.title,
                "check_in": f"{booking.check_in} 14:00",
                "check_out": f"{booking.check_out} 12:00",
                "full_name": booking.full_name,
                "phone_number": booking.phone_number,
                "cancelled_at": booking.guest_cancelled_at.isoformat(),
                "reason": booking.guest_cancellation_reason or "Бичээгүй",
                "policy_version": booking.guest_cancellation_policy_version,
            }
            for user in recipients.values():
                Notification.objects.create(
                    user=user, type="booking_cancelled", message=summary,
                    related_booking=booking,
                )

            def email_after_commit():
                for user in recipients.values():
                    if not user.email:
                        continue
                    try:
                        send_notification_email(user, "guest_booking_cancelled", context)
                    except Exception:
                        import logging
                        logging.getLogger(__name__).exception("Cancellation email failed for booking %s", booking.id)

            transaction.on_commit(email_after_commit)

        return Response(BookingSerializer(booking, context={"request": request}).data)


class HostBookingCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, booking_id):
        with transaction.atomic():
            try:
                booking = Booking.objects.select_for_update().get(
                    id=booking_id, listing__host=request.user
                )
            except Booking.DoesNotExist:
                return Response({"error": "Захиалга олдсонгүй."}, status=404)

            # Давтан хүсэлт нь мэдэгдэл дахин үүсгэх эсвэл огноо дахин нээхгүй.
            if booking.is_cancelled_by_host or booking.host_cancelled_at:
                return Response(
                    BookingSerializer(booking, context={"request": request}).data
                )

            blocked_reason = host_cancellation_blocked_reason(booking)
            if blocked_reason:
                return Response({"error": blocked_reason}, status=400)
            if request.data.get("policy_accepted") is not True:
                return Response(
                    {"error": "Цуцлалтын нөхцөлтэй танилцсанаа тэмдэглэнэ үү."},
                    status=400,
                )
            if request.data.get("policy_version") != HOST_CANCELLATION_POLICY_VERSION:
                return Response(
                    {"error": "Нөхцөл шинэчлэгдсэн байна. Хуудсаа шинэчилж дахин уншина уу."},
                    status=409,
                )
            reason = request.data.get("reason")
            if not isinstance(reason, str) or not reason.strip():
                return Response({"error": "Цуцлах шалтгаанаа бичнэ үү."}, status=400)
            if len(reason) > 1000:
                return Response(
                    {"error": "Шалтгааныг 1000 хүртэлх тэмдэгтээр бичнэ үү."},
                    status=400,
                )

            booking.is_cancelled_by_host = True
            booking.status = "cancelled"
            booking.host_cancelled_at = timezone.now()
            booking.host_cancellation_reason = reason.strip()
            booking.host_cancellation_policy_version = HOST_CANCELLATION_POLICY_VERSION
            booking.save(update_fields=[
                "is_cancelled_by_host", "status", "host_cancelled_at",
                "host_cancellation_reason", "host_cancellation_policy_version",
            ])
            sync_cancellation_settlements(booking)

            dates, _ = _get_requested_dates(booking.check_in, booking.check_out)
            for target_date in dates:
                Availability.objects.get_or_create(
                    listing=booking.listing, date=target_date
                )
            BookingHold.objects.filter(booking=booking).delete()

            summary = (
                f"Түрээслүүлэгч захиалга #{booking.id}-г цуцаллаа. "
                f"{booking.listing.title}, {booking.check_in} - {booking.check_out}. "
                "Зочинд 100% буцаалт олгоно. Буцаан олголтыг ажилтан гараар хянан шийдвэрлэнэ."
            )
            recipients = {
                booking.guest_id: booking.guest,
                booking.listing.host_id: booking.listing.host,
            }
            recipients.update({
                user.pk: user
                for user in User.objects.filter(is_staff=True, is_active=True)
            })
            context = {
                "booking_id": booking.id,
                "listing_title": booking.listing.title,
                "check_in": f"{booking.check_in} 14:00",
                "check_out": f"{booking.check_out} 12:00",
                "full_name": booking.full_name,
                "phone_number": booking.phone_number,
                "cancelled_at": booking.host_cancelled_at.isoformat(),
                "reason": booking.host_cancellation_reason,
                "policy_version": booking.host_cancellation_policy_version,
            }
            for user in recipients.values():
                Notification.objects.create(
                    user=user,
                    type="booking_cancelled",
                    message=summary,
                    related_booking=booking,
                )

            def email_after_commit():
                for user in recipients.values():
                    if not user.email:
                        continue
                    try:
                        send_notification_email(
                            user, "host_booking_cancelled", context
                        )
                    except Exception:
                        import logging
                        logging.getLogger(__name__).exception(
                            "Host cancellation email failed for booking %s",
                            booking.id,
                        )

            transaction.on_commit(email_after_commit)

        return Response(
            BookingSerializer(booking, context={"request": request}).data
        )


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).select_related(
            "user", "related_booking__listing"
        ).order_by(
            "-created_at", "-id"
        )


# 🔹 Уншаагүй notification-ийн тоог авах view
class NotificationUnreadCountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        total = Notification.objects.filter(user=user, is_read=False).count()
        booking = Notification.objects.filter(
            user=user,
            is_read=False,
            type__in=[
                "booking_created",
                "booking_confirmed",
                "booking_cancelled",
                "admin_booking",
            ],
        ).count()
        return Response(
            {
                "total_unread": total,
                "booking_unread": booking,
            }
        )


class NotificationMarkAsReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, format=None):
        type_filter = request.data.get("type")
        qs = Notification.objects.filter(user=request.user, is_read=False)
        if type_filter:
            qs = qs.filter(type=type_filter)
        qs.update(is_read=True)
        return Response({"message": "Marked as read."})


class NotificationMarkOneAsReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id, format=None):
        try:
            notification = Notification.objects.get(
                id=notification_id,
                user=request.user,
            )
        except Notification.DoesNotExist:
            return Response({"error": "Мэдэгдэл олдсонгүй."}, status=404)

        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read"])
        return Response({"message": "Marked as read."})


class SupportRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = SupportRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SupportRequest.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        with transaction.atomic():
            support_request = serializer.save(user=self.request.user)
            admin_users = list(User.objects.filter(is_staff=True, is_active=True))
            admin_message = (
                f"Шинэ тусламжийн хүсэлт #{support_request.id} ирлээ. "
                f"{support_request.user.username}: {support_request.subject}"
            )
            for admin_user in admin_users:
                Notification.objects.create(
                    user=admin_user,
                    message=admin_message,
                    type="admin_support",
                    related_support_request=support_request,
                )

            context = {
                "request_id": support_request.id,
                "category": support_request.get_category_display(),
                "subject": support_request.subject,
                "message": support_request.message,
                "username": support_request.user.username,
                "full_name": support_request.user.full_name,
                "email": support_request.user.email,
                "phone": support_request.user.phone,
                "created_at": support_request.created_at.strftime("%Y-%m-%d %H:%M"),
            }

            def email_admins_after_commit():
                for admin_user in admin_users:
                    if not admin_user.email:
                        continue
                    try:
                        send_notification_email(
                            admin_user,
                            notif_type="admin_support_request_created",
                            context=context,
                        )
                    except Exception:
                        import logging

                        logging.getLogger(__name__).exception(
                            "Support request email failed for request %s",
                            support_request.id,
                        )

            transaction.on_commit(email_admins_after_commit)


class HostBookingDetailView(RetrieveAPIView):
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # зөвхөн тухайн хэрэглэгчийн хост захиалгуудыг зөвшөөрнө
        return Booking.objects.filter(listing__host=self.request.user)


class MyListingsView(generics.ListAPIView):
    serializer_class = ListingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Listing.objects.filter(host=self.request.user).prefetch_related(
            "images", "amenities", "category"
        )


class HostBookingCalendarView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        bookings = Booking.objects.filter(
            listing__host=user, status="confirmed", is_cancelled_by_host=False
        )

        data = []
        for booking in bookings:
            # check_in -> check_out хоорондох өдрүүдийг бүгдийг авна
            current = booking.check_in
            while current < booking.check_out:
                data.append(
                    {
                        "date": current,
                        "booking_id": booking.id,
                        "listing_id": booking.listing.id,
                        "listing_title": booking.listing.title,
                        "guest_name": booking.guest.username,
                        "is_cancelled_by_host": booking.is_cancelled_by_host,
                    }
                )
                current += timedelta(days=1)

        return Response(data)


class ListingUpdateView(RetrieveUpdateAPIView):
    queryset = Listing.objects.all()
    serializer_class = ListingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Зөвхөн өөрийн заруудыг засах эрхтэй
        return Listing.objects.filter(host=self.request.user)

    def get_serializer_context(self):
        return {"request": self.request}


class AvailabilityDeleteByListingView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        listing_id = request.data.get("listing")
        if not listing_id:
            return Response({"error": "listing ID шаардлагатай"}, status=400)
        try:
            listing = Listing.objects.get(id=listing_id, host=request.user)
        except Listing.DoesNotExist:
            return Response(
                {"error": "Зар олдсонгүй эсвэл таных биш байна."},
                status=status.HTTP_404_NOT_FOUND,
            )
        deleted, _ = Availability.objects.filter(listing=listing).delete()
        return Response({"message": f"{deleted} огноо устгагдлаа."}, status=200)


class ListingDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, listing_id):
        try:
            listing = Listing.objects.get(id=listing_id, host=request.user)
        except Listing.DoesNotExist:
            return Response(
                {"error": "Зар олдсонгүй эсвэл таных биш."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Захиалга байгаа эсэхийг шалгах
        has_active_bookings = Booking.objects.filter(
            listing=listing, status="confirmed", is_cancelled_by_host=False
        ).exists()

        if has_active_bookings:
            return Response(
                {
                    "error": "Таны зар дээр захиалга хийгдсэн тул устгах боломжгүй байна. Эхлээд захиалгаа цуцална уу."
                },
                status=status.HTTP_409_CONFLICT,
            )

        if Booking.objects.filter(listing=listing).exists():
            listing.is_active = False
            listing.save(update_fields=["is_active"])
            return Response(
                {
                    "message": "Зар хэрэглэгчдээс нуугдлаа. Захиалга, төлбөрийн түүхийг хадгалахын тулд бүр мөсөн устгаагүй."
                },
                status=status.HTTP_200_OK,
            )

        listing.delete()
        return Response(
            {"message": "Зар амжилттай устгагдлаа."}, status=status.HTTP_200_OK
        )


def _review_eligibility(listing, user):
    if listing.host_id == user.id:
        return None, "Түрээслүүлэгч өөрийн байранд сэтгэгдэл бичих боломжгүй.", "listing_owner"

    now = timezone.now()
    today = local_now(now).date()
    confirmed_bookings = Booking.objects.filter(
        listing=listing,
        guest=user,
        status="confirmed",
        is_cancelled_by_host=False,
        guest_cancelled_at__isnull=True,
    )
    completed_bookings = confirmed_bookings.filter(check_out__lte=today)
    completed_bookings = [
        booking for booking in completed_bookings if stay_has_ended(booking, now)
    ]
    completed_booking_ids = [booking.id for booking in completed_bookings]
    booking = (
        confirmed_bookings.filter(id__in=completed_booking_ids)
        .exclude(review__isnull=False)
        .order_by("-check_out", "-id")
        .first()
    )

    if booking:
        return booking, "", "eligible"
    if confirmed_bookings.filter(id__in=completed_booking_ids).exists():
        return None, "Та энэ захиалгад аль хэдийн сэтгэгдэл үлдээсэн байна.", "already_reviewed"
    if confirmed_bookings.exists():
        return None, "Сэтгэгдэл бичих эрх гарах өдрийн 12:00 цагаас хойш нээгдэнэ.", "stay_not_completed"
    return None, "Зөвхөн энэ байранд байрласан зочин сэтгэгдэл үлдээх боломжтой.", "no_completed_stay"


class ReviewEligibilityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, listing_id):
        listing = get_object_or_404(Listing, pk=listing_id)
        booking, reason, reason_code = _review_eligibility(listing, request.user)
        return Response(
            {
                "can_review": booking is not None,
                "reason": reason,
                "reason_code": reason_code,
                "booking_id": booking.id if booking else None,
            }
        )


class ReviewCreateListView(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        listing_id = self.kwargs.get("listing_id")
        return Review.objects.filter(listing__id=listing_id).order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        listing_id = self.kwargs.get("listing_id")
        listing = (
            get_object_or_404(Listing, pk=listing_id)
            if listing_id is not None
            else serializer.validated_data.get("listing")
        )
        if listing is None:
            raise ValidationError({"listing": "Байрны дугаар шаардлагатай."})

        booking, reason, _ = _review_eligibility(listing, user)
        if not booking:
            raise ValidationError(reason)

        try:
            with transaction.atomic():
                serializer.save(listing=listing, guest=user, booking=booking)
        except IntegrityError as exc:
            raise ValidationError("Та энэ захиалгад аль хэдийн сэтгэгдэл үлдээсэн байна.") from exc

        Notification.objects.create(
            user=listing.host,
            message=f"{user.username} таны '{listing.title}' зар дээр сэтгэгдэл үлдээлээ.",
            type="review",
            related_listing=listing,
        )
        try:
            send_notification_email(
                user=listing.host,
                notif_type="review",
                context={
                    "guest_name": user.username,
                    "listing_title": listing.title,
                },
            )
        except Exception as e:
            print(f"❌ Сэтгэгдлийн имэйл илгээхэд алдаа гарлаа: {e}")


class HostApplicationCreateView(generics.CreateAPIView):
    queryset = HostApplication.objects.all()
    serializer_class = HostApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def perform_create(self, serializer):
        user = self.request.user
        if HostApplication.objects.filter(user=user).exists():
            raise ValidationError(
                "Та аль хэдийн түрээслүүлэгч болох хүсэлт илгээсэн байна."
            )
        serializer.save(user=user)


class HostApplicationMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            app = HostApplication.objects.get(user=request.user)
            serializer = HostApplicationSerializer(app)
            return Response(serializer.data)
        except HostApplication.DoesNotExist:
            return Response({"detail": "HostApplication not found."}, status=404)

    def patch(self, request):
        try:
            app = HostApplication.objects.get(user=request.user)
        except HostApplication.DoesNotExist:
            return Response({"detail": "HostApplication not found."}, status=404)

        serializer = HostApplicationSerializer(app, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class PasswordResetRequestThrottle(AnonRateThrottle):
    scope = "password_reset_request"
    rate = "10/hour"


class PasswordResetConfirmThrottle(AnonRateThrottle):
    scope = "password_reset_confirm"
    rate = "30/hour"


class PasswordResetRequestView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetRequestThrottle]

    def post(self, request):
        email = request.data.get("email")
        if not isinstance(email, str):
            return Response({"error": "Зөв имэйл хаяг оруулна уу."}, status=400)
        try:
            email = serializers.EmailField().run_validation(email).lower()
        except serializers.ValidationError:
            return Response({"error": "Зөв имэйл хаяг оруулна уу."}, status=400)

        client = request.data.get("client", "web")
        locale = request.data.get("locale", "mn")
        if client not in ("web", "mobile") or locale not in ("mn", "en", "fr"):
            return Response({"error": "Хүсэлтийн төрөл эсвэл хэл буруу байна."}, status=400)

        # Never select an arbitrary account if legacy data contains duplicates.
        users = list(User.objects.filter(email__iexact=email)[:2])
        if len(users) != 1:
            if users:
                logger.error("Password recovery blocked: duplicate email accounts require review")
            return Response({"detail": "ok"})
        user = users[0]
        if not user.is_active:
            return Response({"detail": "ok"})

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        web_link = f"{settings.FRONTEND_URL.rstrip('/')}/{locale}/reset-password?uid={uid}&token={token}"
        reset_link = (
            f"tanaidhonoy://reset-password?uid={uid}&token={token}"
            if client == "mobile" else web_link
        )
        try:
            send_notification_email(
                user=user,
                notif_type="password_reset",
                context={"reset_link": reset_link, "web_link": web_link, "username": user.username},
            )
        except Exception:
            logger.error("Password recovery email delivery failed")
            return Response(
                {"error": "Имэйл илгээхэд алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу."},
                status=503,
            )
        return Response({"detail": "ok"})


class PasswordResetConfirmView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetConfirmThrottle]

    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        new_password = request.data.get("new_password")
        if not all(isinstance(value, str) and value for value in (uid, token, new_password)):
            return Response({"error": "Бүх талбарыг зөв бөглөнө үү."}, status=400)
        if len(new_password) > 128:
            return Response({"error": "Нууц үг 128-аас ихгүй тэмдэгт байх ёстой."}, status=400)

        with transaction.atomic():
            try:
                pk = force_str(urlsafe_base64_decode(uid))
                user = User.objects.select_for_update().get(pk=pk, is_active=True)
            except (User.DoesNotExist, ValueError, TypeError, OverflowError, UnicodeError):
                return Response({"error": "Холбоос буруу байна."}, status=400)

            if not default_token_generator.check_token(user, token):
                return Response({"error": "Холбоос хүчингүй болсон байна. Шинэ холбоос авна уу."}, status=400)
            try:
                validate_password(new_password, user=user)
            except DjangoValidationError as exc:
                return Response({"error": " ".join(exc.messages)}, status=400)

            user.set_password(new_password)
            user.save(update_fields=["password"])
        return Response({"detail": "Нууц үг амжилттай шинэчлэгдлээ."})
