from rest_framework import generics, status, permissions, serializers
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import RetrieveAPIView
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from datetime import timedelta
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile

from .models import (
    Category,
    Listing,
    Availability,
    ListingImage,
    Amenity,
    Favorite,
    Booking,
    Notification,
)
from .serializers import (
    CategorySerializer,
    ListingSerializer,
    ListingImageSerializer,
    AvailabilitySerializer,
    AvailabilityBulkSerializer,
    SignupSerializer,
    BookingSerializer,
    UserSerializer,
    AmenitySerializer,
    FavoriteSerializer,
    NotificationSerializer,
)

User = get_user_model()

# ---------------------- AUTH ----------------------


class SignupView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
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
            queryset = queryset.filter(location_text__icontains=location)

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
        serializer.save(host=self.request.user)


class ListingRetrieveView(RetrieveAPIView):
    queryset = Listing.objects.all()
    serializer_class = ListingSerializer

    def get_serializer_context(self):
        return {"request": self.request}


# ---------------------- LISTING IMAGE ----------------------


class ListingImageUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, format=None):
        uploaded_image = request.FILES.get("image")
        listing_id = request.data.get("listing")

        if not uploaded_image or not listing_id:
            return Response(
                {"error": "Зураг болон listing ID шаардлагатай"}, status=400
            )

        try:
            image = Image.open(uploaded_image)
            max_size = (1024, 768)
            image.thumbnail(max_size)

            buffer = BytesIO()
            image.convert("RGB").save(buffer, format="JPEG", quality=85)
            buffer.seek(0)  # 🛠 ЭНЭ ЧУХАЛ — буцааж эхлэлд шилжүүлнэ

            final_image_file = ContentFile(buffer.read(), name="listing.jpg")

            # 🛠 listing_id-г шууд object болгоё
            from .models import Listing

            listing = Listing.objects.get(id=listing_id)

            new_image = ListingImage.objects.create(
                listing=listing, image=final_image_file
            )

            return Response(ListingImageSerializer(new_image).data, status=201)

        except Exception as e:
            return Response(
                {"error": f"Зураг боловсруулахад алдаа гарлаа: {str(e)}"},
                status=400,
            )


# ---------------------- AVAILABILITY ----------------------


class AvailabilityListCreateView(generics.ListCreateAPIView):
    serializer_class = AvailabilitySerializer

    def get_queryset(self):
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


class BookingCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, format=None):
        serializer = BookingSerializer(data=request.data)
        if serializer.is_valid():
            listing = serializer.validated_data["listing"]
            check_in = serializer.validated_data["check_in"]
            check_out = serializer.validated_data["check_out"]
            guest = request.user

            # ✅ Зөвхөн ганц өдөр сонгосон үед checkout-г +1 хоног болгоно
            if check_in == check_out:
                check_out += timedelta(days=1)

            full_name = serializer.validated_data["full_name"]
            phone_number = serializer.validated_data["phone_number"]
            notes = serializer.validated_data.get("notes", "")
            guest_count = serializer.validated_data["guest_count"]

            # Захиалгад багтах бүх өдөр (checkout оролцохгүй)
            date = check_in
            requested_dates = []
            while date < check_out:
                requested_dates.append(date)
                date += timedelta(days=1)

            available_dates = Availability.objects.filter(
                listing=listing, date__in=requested_dates
            ).values_list("date", flat=True)

            if set(requested_dates).issubset(set(available_dates)):
                booking = Booking.objects.create(
                    listing=listing,
                    guest=guest,
                    check_in=check_in,
                    check_out=check_out,
                    full_name=full_name,
                    phone_number=phone_number,
                    notes=notes,
                    guest_count=guest_count,
                )

                # ❗ зөвхөн орсон шөнүүдийг устгана (checkout өдөр биш)
                Availability.objects.filter(
                    listing=listing, date__in=requested_dates
                ).delete()

                # Хостод мэдэгдэл илгээх
                Notification.objects.create(
                    user=listing.host,
                    message=f"{guest.username} таны '{listing.title}' байранд захиалга хийлээ.",
                )

                return Response(
                    BookingSerializer(booking, context={"request": request}).data,
                    status=status.HTTP_201_CREATED,
                )

            return Response(
                {"error": "Сонгосон огнооны зарим нь боломжгүй байна."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"unread_count": count})
