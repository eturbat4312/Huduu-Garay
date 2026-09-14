from rest_framework import generics, status, permissions, serializers
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import RetrieveAPIView, RetrieveUpdateAPIView
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from datetime import timedelta
from PIL import Image, UnidentifiedImageError
from io import BytesIO
from django.core.files.base import ContentFile
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from core.utils.email_notifications import send_notification_email
from core.services.qpay import QPayAPIError, QPayClient, QPayConfigurationError
from decimal import Decimal
from google.oauth2 import id_token
import uuid
from django.db import IntegrityError, transaction
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
)

User = get_user_model()
PAYMENT_HOLD_MINUTES = 15
ALLOWED_LISTING_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

# ---------------------- AUTH ----------------------


class SignupView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]


class GoogleLogin(APIView):
    def post(self, request):
        token = request.data.get("access_token")  # really it's an id_token

        try:
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request())
            email = idinfo.get("email")
            if not email:
                return Response({"error": "Email not found in token"}, status=400)

            base_username = email.split("@")[0]
            username = base_username

            # username давхцахгүй болгож шалгана
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            # хэрэглэгч авах эсвэл үүсгэх
            user, created = User.objects.get_or_create(
                email=email, defaults={"username": username}
            )

            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                }
            )

        except IntegrityError as e:
            return Response({"error": "Username already exists"}, status=400)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


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

    def get_serializer_context(self):
        return {"request": self.request}


# ---------------------- AMENITY ----------------------


class AmenityListView(generics.ListAPIView):
    queryset = Amenity.objects.all()
    serializer_class = AmenitySerializer


# ---------------------- LISTING ----------------------


class ListingListCreateView(generics.ListCreateAPIView):
    queryset = Listing.objects.all().prefetch_related("images", "category", "amenities")
    serializer_class = ListingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_context(self):
        return {"request": self.request}

    def get_queryset(self):
        queryset = Listing.objects.all()

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
            message=f"🎉 Таны '{listing.title}' зар амжилттай нийтлэгдлээ!",
            type="listing_published",
            related_listing=listing,
        )


class ListingRetrieveView(RetrieveAPIView):
    queryset = Listing.objects.all()
    serializer_class = ListingSerializer

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

    def get_queryset(self):
        _release_expired_booking_holds()
        queryset = Availability.objects.all()
        listing_id = self.request.query_params.get("listing")
        if listing_id:
            queryset = queryset.filter(listing__id=listing_id)
        return queryset


class AvailabilityBulkCreateView(APIView):
    def post(self, request, format=None):
        serializer = AvailabilityBulkSerializer(data=request.data)
        if serializer.is_valid():
            created = serializer.save()
            return Response(
                {"message": f"{len(created)} availability entries created."}, status=201
            )
        return Response(serializer.errors, status=400)


class AvailabilityDeleteView(generics.DestroyAPIView):
    queryset = Availability.objects.all()
    lookup_field = "id"


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
                        f"{check_in.strftime('%Y-%m-%d')} – {check_out.strftime('%Y-%m-%d')} "
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
                        f"{check_in.strftime('%Y-%m-%d')} – {check_out.strftime('%Y-%m-%d')} "
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
                            "check_in": check_in.strftime("%Y-%m-%d"),
                            "check_out": check_out.strftime("%Y-%m-%d"),
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
                            "check_in": check_in.strftime("%Y-%m-%d"),
                            "check_out": check_out.strftime("%Y-%m-%d"),
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
    hold_rows = list(
        BookingHold.objects.select_for_update().filter(
            booking=booking, listing=booking.listing
        )
    )
    if not hold_rows:
        return 0

    for hold in hold_rows:
        Availability.objects.get_or_create(listing=booking.listing, date=hold.date)

    BookingHold.objects.filter(id__in=[hold.id for hold in hold_rows]).delete()

    booking.status = "expired"
    booking.save(update_fields=["status"])

    Payment.objects.filter(booking=booking, status=Payment.STATUS_PENDING).update(
        status=Payment.STATUS_EXPIRED,
        updated_at=now or timezone.now(),
        raw_response={
            "expired_reason": "payment_hold_expired",
            "expired_at": (now or timezone.now()).isoformat(),
        },
    )
    return len(hold_rows)


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


def _payment_check_is_paid(check_response):
    if not isinstance(check_response, dict):
        return False
    count = check_response.get("count")
    if count is not None:
        try:
            return int(count) > 0
        except (TypeError, ValueError):
            return False
    rows = (
        check_response.get("rows")
        or check_response.get("items")
        or check_response.get("payments")
        or []
    )
    return bool(rows)


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
    check_in = booking.check_in.strftime("%Y-%m-%d")
    check_out = booking.check_out.strftime("%Y-%m-%d")

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
        f"Host: {details['host_name']} ({listing.host.username}), утас: {details['host_phone']}. "
        f"Guest: {booking.full_name} ({booking.guest.username}), утас: {booking.phone_number}. "
        f"Огноо: {check_in} – {check_out}, {details['total_nights']} хонох, "
        f"{booking.guest_count} зочин. Байршил: {listing.location_city}, "
        f"{listing.location_district}, {listing.location_khoroo}. "
        f"Үндсэн үнэ: ₮{details['total_price']:,}, service fee: ₮{details['service_fee']:,}, "
        f"нийт төлсөн: ₮{details['guest_total']:,}, host авах: ₮{details['host_payout']:,}. "
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

    if payment.status == Payment.STATUS_PAID and booking.status == "confirmed":
        return payment, None

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
                    description=f"Танайд Хоной захиалга #{booking.id}",
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

    def get_queryset(self):
        return Payment.objects.filter(booking__guest=self.request.user).select_related(
            "booking", "booking__listing", "booking__guest", "booking__listing__host"
        )


class PaymentCheckView(APIView):
    permission_classes = [IsAuthenticated]

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

        if not _payment_check_is_paid(check_response):
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

    def post(self, request, format=None):
        invoice_id = (
            request.data.get("invoice_id")
            or request.data.get("object_id")
            or request.data.get("payment_id")
        )
        if not invoice_id:
            return Response({"error": "invoice_id дутуу байна."}, status=400)

        _release_expired_booking_holds()

        try:
            check_response = QPayClient().check_payment(invoice_id=invoice_id)
        except (QPayConfigurationError, QPayAPIError):
            return Response(
                {"error": "QPay төлбөр шалгахад алдаа гарлаа."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if not _payment_check_is_paid(check_response):
            return Response({"status": "pending"}, status=status.HTTP_202_ACCEPTED)

        with transaction.atomic():
            try:
                payment = (
                    Payment.objects.select_for_update()
                    .select_related("booking", "booking__listing")
                    .get(invoice_id=invoice_id, provider=Payment.PROVIDER_QPAY)
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
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer


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
        return Favorite.objects.filter(user=self.request.user)


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


class HostBookingCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, booking_id):
        try:
            booking = Booking.objects.get(id=booking_id, listing__host=request.user)
        except Booking.DoesNotExist:
            return Response({"error": "Захиалга олдсонгүй."}, status=404)

        if booking.is_cancelled_by_host:
            return Response(
                {"error": "Захиалгыг аль хэдийн цуцалсан байна."}, status=400
            )

        # ✅ Цуцлалтыг бүртгэх
        booking.is_cancelled_by_host = True
        booking.save()

        # ✅ Захиалгад хамаарах бүх огноог буцааж нэмэх
        date = booking.check_in
        while date < booking.check_out:
            Availability.objects.get_or_create(
                listing=booking.listing,
                date=date,
            )
            date += timedelta(days=1)

        # ✅ Notification: захиалга цуцлагдсан тухай хэрэглэгчид мэдэгдэл
        Notification.objects.create(
            user=booking.guest,
            message=f"Таны захиалга ({booking.listing.title}) цуцлагдлаа.",
            type="booking_cancelled",
            related_booking=booking,
        )
        try:
            send_notification_email(
                user=booking.guest,
                notif_type="booking_cancelled",
                context={
                    "listing_title": booking.listing.title,
                    "check_in": booking.check_in.strftime("%Y-%m-%d"),
                    "check_out": booking.check_out.strftime("%Y-%m-%d"),
                    "full_name": booking.full_name,
                    "guest_count": booking.guest_count,
                    "phone_number": booking.phone_number,
                },
            )
        except Exception as e:
            print(f"❌ Цуцлалтын имэйл илгээхэд алдаа гарлаа: {e}")

        return Response(
            {"message": "Захиалгыг амжилттай цуцаллаа. Өдрүүд сэргээгдлээ."}, status=200
        )


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by(
            "-created_at"
        )


# 🔹 Уншаагүй notification-ийн тоог авах view
class NotificationUnreadCountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        total = Notification.objects.filter(user=user, is_read=False).count()
        booking = Notification.objects.filter(
            user=user, is_read=False, type="booking_created"
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
        bookings = Booking.objects.filter(listing__host=user)

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
        deleted, _ = Availability.objects.filter(listing__id=listing_id).delete()
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
            listing=listing, is_cancelled_by_host=False
        ).exists()

        if has_active_bookings:
            return Response(
                {
                    "error": "Таны зар дээр захиалга хийгдсэн тул устгах боломжгүй байна. Эхлээд захиалгаа цуцална уу."
                },
                status=status.HTTP_409_CONFLICT,
            )

        listing.delete()
        return Response(
            {"message": "Зар амжилттай устгагдлаа."}, status=status.HTTP_200_OK
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
        listing = serializer.validated_data["listing"]

        booking = (
            Booking.objects.filter(
                listing=listing, guest=user, check_out__lte=timezone.now()
            )
            .order_by("-check_out")
            .first()
        )

        if not booking:
            raise ValidationError("Та энэ байранд буусан байх ёстой.")

        if Review.objects.filter(listing=listing, guest=user).exists():
            raise ValidationError("Та аль хэдийн сэтгэгдэл үлдээсэн байна.")

        serializer.save(guest=user, booking=booking)

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


# Claude: password reset — request reset link
class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip()
        if not email:
            return Response({"error": "Email шаардлагатай."}, status=400)

        User = get_user_model()
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Security: always return 200 so attackers can't enumerate emails
            return Response({"detail": "ok"})

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
        reset_link = f"{frontend_url}/mn/reset-password?uid={uid}&token={token}"

        try:
            send_notification_email(
                user=user,
                notif_type="password_reset",
                context={"reset_link": reset_link, "username": user.username},
            )
        except Exception as e:
            print(f"❌ Password reset email error: {e}")

        return Response({"detail": "ok"})


# Claude: password reset — set new password
class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        new_password = request.data.get("new_password", "")

        if not uid or not token or not new_password:
            return Response({"error": "Бүх талбарыг бөглөнө үү."}, status=400)

        if len(new_password) < 8:
            return Response({"error": "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой."}, status=400)

        User = get_user_model()
        try:
            pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Холбоос буруу байна."}, status=400)

        if not default_token_generator.check_token(user, token):
            return Response({"error": "Холбоос хүчингүй болсон байна. Дахин хүсэлт илгээнэ үү."}, status=400)

        user.set_password(new_password)
        user.save()
        return Response({"detail": "Нууц үг амжилттай шинэчлэгдлээ."})
