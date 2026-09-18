from rest_framework import serializers
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import (
    Category,
    Listing,
    ListingImage,
    Availability,
    Booking,
    Payment,
    Amenity,
    Favorite,
    Notification,
    Review,
    HostApplication,
)

User = get_user_model()

# -------------------- AUTH --------------------


class SignupSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username", "email", "password"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    host_application_status = serializers.SerializerMethodField()
    # avatar = serializers.SerializerMethodField()
    avatar = serializers.ImageField(required=False, allow_null=True)
    host_phone_number = serializers.CharField(
        source="hostapplication.phone_number", required=False, allow_blank=True
    )
    bank_name = serializers.CharField(write_only=True, required=False)
    account_number = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = get_user_model()
        fields = [
            "id",
            "username",
            "email",
            "is_host",
            "host_application_status",
            "avatar",
            "phone",
            "address",
            "bio",
            "full_name",
            "host_phone_number",  # 🆕
            "bank_name",
            "account_number",
        ]

    def get_host_application_status(self, user):
        try:
            if not user or not user.id:
                return "none"
            if user.is_host:
                return "approved"
            app = HostApplication.objects.filter(user=user).latest("submitted_at")
            return app.status
        except Exception as e:
            print("❌ Host status fetch error:", e)
            return "none"

    def get_avatar(self, user):
        request = self.context.get("request")
        if user.avatar and hasattr(user.avatar, "url"):
            return request.build_absolute_uri(user.avatar.url)
        return None

    def update(self, instance, validated_data):
        hostapp_data = validated_data.pop("hostapplication", {})

        # 🟢 User model талбаруудыг шинэчлэх
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # 🟢 HostApplication update хийх
        # if instance.is_host and hostapp_data:
        #     HostApplication.objects.update_or_create(
        #         user=instance,
        #         defaults={
        #             "phone_number": hostapp_data.get("phone_number", ""),
        #         },
        #     )

        return instance


# -------------------- CATEGORY --------------------


class CategorySerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    translation_key = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "description", "icon", "image", "translation_key"]

    def get_image(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        elif obj.image:
            return obj.image.url
        return None

    def get_translation_key(self, obj):
        return f"category_{obj.name.lower().replace(' ', '_')}"


# -------------------- AMENITY --------------------


class AmenitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Amenity
        fields = "__all__"


# -------------------- LISTING IMAGE --------------------


class ListingImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ListingImage
        fields = ["id", "image", "uploaded_at"]

    def get_image(self, obj):
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


# -------------------- LISTING --------------------


class ListingSerializer(serializers.ModelSerializer):
    images = ListingImageSerializer(many=True, read_only=True)
    amenities = AmenitySerializer(many=True, read_only=True)
    category = CategorySerializer(read_only=True)
    host_username = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()
    favorite_id = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()  # 🟢 ШИНЭЭР НЭМНЭ
    host = UserSerializer(read_only=True)  # 👈 заавал энэ байх хэрэгтэй
    average_rating = serializers.SerializerMethodField()

    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source="category", write_only=True
    )
    amenity_ids = serializers.PrimaryKeyRelatedField(
        queryset=Amenity.objects.all(), many=True, write_only=True, required=False
    )

    class Meta:
        model = Listing
        fields = [
            "id",
            "title",
            "description",
            "location_city",
            "location_district",
            "location_khoroo",
            "location_extra",
            "location_building",
            "location_apartment",
            "price_per_night",
            "max_guests",
            "beds",
            "host_username",
            "category",
            "category_id",
            "amenities",
            "amenity_ids",
            "images",
            "is_favorited",
            "favorite_id",
            "thumbnail",
            "host",
            "average_rating",
            "location_lat",
            "location_lng",
        ]
        read_only_fields = ("host",)

    def get_host_username(self, obj):
        return obj.host.username if obj.host else None

    def get_is_favorited(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return Favorite.objects.filter(user=request.user, listing=obj).exists()
        return False

    def get_favorite_id(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            fav = Favorite.objects.filter(user=request.user, listing=obj).first()
            return fav.id if fav else None
        return None

    def get_thumbnail(self, obj):
        if obj.images.exists():
            image = obj.images.first().image
            request = self.context.get("request")
            return request.build_absolute_uri(image.url) if request else image.url
        return None

    def create(self, validated_data):
        amenity_ids = validated_data.pop("amenity_ids", [])
        listing = Listing.objects.create(**validated_data)
        listing.amenities.set(amenity_ids)
        return listing

    def update(self, instance, validated_data):
        amenity_ids = validated_data.pop("amenity_ids", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if amenity_ids is not None:
            instance.amenities.set(amenity_ids)
        return instance

    def get_average_rating(self, obj):
        # Claude: return None when no reviews, float with 1 decimal when reviews exist
        reviews = obj.reviews.all()
        if not reviews.exists():
            return None
        return round(sum([r.rating for r in reviews]) / reviews.count(), 1)


# -------------------- FAVORITE --------------------


class FavoriteSerializer(serializers.ModelSerializer):
    listing = ListingSerializer(read_only=True)
    listing_id = serializers.PrimaryKeyRelatedField(
        queryset=Listing.objects.all(), write_only=True, source="listing"
    )

    class Meta:
        model = Favorite
        fields = ["id", "listing", "listing_id"]


# -------------------- AVAILABILITY --------------------


class AvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Availability
        fields = "__all__"


class AvailabilityBulkSerializer(serializers.Serializer):
    listing = serializers.PrimaryKeyRelatedField(queryset=Listing.objects.all())
    dates = serializers.ListField(child=serializers.DateField(), allow_empty=False)

    def create(self, validated_data):
        listing = validated_data["listing"]
        dates = validated_data["dates"]
        created = []
        for date in dates:
            obj, created_flag = Availability.objects.get_or_create(
                listing=listing, date=date
            )
            if created_flag:
                created.append(obj)
        return created


# -------------------- BOOKING --------------------


class BookingSerializer(serializers.ModelSerializer):
    listing = serializers.SerializerMethodField(read_only=True)
    listing_id = serializers.PrimaryKeyRelatedField(
        queryset=Listing.objects.all(), write_only=True, source="listing"
    )
    status = serializers.CharField(read_only=True)
    total_price = serializers.SerializerMethodField(read_only=True)

    # 📝 Write-only талбарууд
    full_name = serializers.CharField()
    phone_number = serializers.CharField()
    notes = serializers.CharField(required=False, allow_blank=True)

    # ✅ Read-only талбарууд
    guest_name = serializers.SerializerMethodField()
    guest_phone = serializers.SerializerMethodField()
    is_cancelled_by_host = serializers.BooleanField(read_only=True)
    guest_count = serializers.IntegerField()
    is_unread = serializers.SerializerMethodField()
    host_name = serializers.SerializerMethodField()
    host_phone = serializers.SerializerMethodField()
    guest_cancellation = serializers.SerializerMethodField()
    host_cancellation = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id",
            "check_in",
            "check_out",
            "listing",
            "listing_id",
            "total_price",
            "status",
            "created_at",
            "notes",
            "full_name",
            "phone_number",
            "guest_name",
            "guest_phone",
            "is_cancelled_by_host",
            "host_cancelled_at",
            "host_cancellation_reason",
            "host_cancellation_policy_version",
            "host_cancellation",
            "guest_count",
            "is_unread",
            "host_name",
            "host_phone",
            "service_fee",
            "guest_cancelled_at",
            "guest_cancellation_reason",
            "guest_cancellation_policy_version",
            "guest_cancellation",
        ]
        read_only_fields = [
            "host_cancelled_at", "host_cancellation_reason",
            "host_cancellation_policy_version",
            "service_fee", "guest_cancelled_at", "guest_cancellation_reason",
            "guest_cancellation_policy_version",
        ]

    def get_guest_cancellation(self, obj):
        from .services.cancellations import (
            GUEST_CANCELLATION_POLICY, GUEST_CANCELLATION_POLICY_VERSION,
            guest_cancellation_blocked_reason,
        )

        request = self.context.get("request")
        is_guest = bool(request and request.user.pk == obj.guest_id)
        blocked_reason = guest_cancellation_blocked_reason(obj)
        return {
            "allowed": is_guest and not blocked_reason,
            "blocked_reason": blocked_reason,
            "policy_version": GUEST_CANCELLATION_POLICY_VERSION,
            "policy": GUEST_CANCELLATION_POLICY,
        }

    def get_host_cancellation(self, obj):
        from .services.cancellations import (
            HOST_CANCELLATION_POLICY, HOST_CANCELLATION_POLICY_VERSION,
            host_cancellation_blocked_reason,
        )

        request = self.context.get("request")
        is_host = bool(request and request.user.pk == obj.listing.host_id)
        blocked_reason = host_cancellation_blocked_reason(obj)
        return {
            "allowed": is_host and not blocked_reason,
            "blocked_reason": blocked_reason,
            "policy_version": HOST_CANCELLATION_POLICY_VERSION,
            "policy": HOST_CANCELLATION_POLICY,
        }

    def get_listing(self, obj):
        request = self.context.get("request")
        thumbnail = None
        if obj.listing.images.exists():
            image_url = obj.listing.images.first().image.url
            thumbnail = request.build_absolute_uri(image_url) if request else image_url

        return {
            "id": obj.listing.id,
            "title": obj.listing.title,
            "location_city": obj.listing.location_city,
            "location_district": obj.listing.location_district,
            "thumbnail": thumbnail,
            "price_per_night": obj.listing.price_per_night,
        }

    def get_guest_name(self, obj):
        return obj.full_name

    def get_guest_phone(self, obj):
        return obj.phone_number

    def get_total_price(self, obj):
        return obj.total_price

    def get_is_unread(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return Notification.objects.filter(
            user=request.user,
            is_read=False,
            type="booking",
            message__icontains=obj.listing.title,
            created_at__gte=obj.created_at,
        ).exists()

    def get_host_name(self, obj):
        host_app = getattr(obj.listing.host, "hostapplication", None)
        return host_app.full_name if host_app else None

    def get_host_phone(self, obj):
        host_app = getattr(obj.listing.host, "hostapplication", None)
        return host_app.phone_number if host_app else None


class PendingBookingCreateSerializer(serializers.Serializer):
    listing_id = serializers.PrimaryKeyRelatedField(
        queryset=Listing.objects.all(), source="listing"
    )
    check_in = serializers.DateField()
    check_out = serializers.DateField()
    full_name = serializers.CharField(max_length=100)
    phone_number = serializers.CharField(max_length=20)
    guest_count = serializers.IntegerField(min_value=1)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        listing = attrs["listing"]
        check_in = attrs["check_in"]
        check_out = attrs["check_out"]
        guest_count = attrs["guest_count"]

        if check_out < check_in:
            raise serializers.ValidationError(
                {"check_out": "Гарах өдөр орох өдрөөс өмнө байж болохгүй."}
            )

        if guest_count > listing.max_guests:
            raise serializers.ValidationError(
                {"guest_count": "Зочны тоо зөвшөөрөгдөх дээд хэмжээнээс их байна."}
            )

        return attrs


class PaymentCreateSerializer(serializers.Serializer):
    booking_id = serializers.PrimaryKeyRelatedField(
        queryset=Booking.objects.all(), source="booking"
    )


class PaymentSerializer(serializers.ModelSerializer):
    booking = BookingSerializer(read_only=True)
    booking_id = serializers.IntegerField(source="booking.id", read_only=True)
    booking_status = serializers.CharField(source="booking.status", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "booking",
            "booking_id",
            "booking_status",
            "provider",
            "invoice_id",
            "sender_invoice_no",
            "idempotency_key",
            "amount",
            "currency",
            "status",
            "raw_response",
            "paid_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class NotificationSerializer(serializers.ModelSerializer):
    booking_role = serializers.SerializerMethodField()
    related_booking = serializers.SerializerMethodField()
    related_listing = serializers.SerializerMethodField()
    # related_booking = serializers.IntegerField(
    #     source="related_booking.id", read_only=True
    # )
    # related_listing = serializers.IntegerField(
    #     source="related_listing.id", read_only=True
    # )

    class Meta:
        model = Notification
        fields = [
            "id",
            "message",
            "created_at",
            "is_read",
            "type",
            "related_booking",
            "related_listing",
            "booking_role",
        ]

    def get_booking_role(self, obj):
        booking = obj.related_booking
        if not booking:
            return None
        if obj.user_id == booking.guest_id:
            return "guest"
        if obj.user_id == booking.listing.host_id:
            return "host"
        if obj.user.is_staff:
            return "admin"
        return None

    def get_related_booking(self, obj):
        return obj.related_booking.id if obj.related_booking else None

    def get_related_listing(self, obj):
        return obj.related_listing.id if obj.related_listing else None


class BookingCalendarSerializer(serializers.ModelSerializer):
    listing_id = serializers.IntegerField(source="listing.id")
    listing_title = serializers.CharField(source="listing.title")
    date = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "date",
            "booking_id",
            "listing_id",
            "listing_title",
            "guest_name",
            "is_cancelled_by_host",
        ]

    def get_date(self, obj):
        # Бүх хоногуудыг буцаахгүй тул зөвхөн check_in-ийг буцаана (эсвэл өөр тохиргоо хийж болно)
        return obj.check_in.strftime("%Y-%m-%d")


class ReviewSerializer(serializers.ModelSerializer):
    guest_username = serializers.CharField(source="guest.username", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "listing",
            "guest",
            "guest_username",
            "rating",
            "comment",
            "created_at",
        ]
        extra_kwargs = {
            "guest": {"read_only": True},
            "listing": {"write_only": True},
        }
        read_only_fields = ["guest", "created_at"]


class HostApplicationSerializer(serializers.ModelSerializer):
    host_terms_accepted = serializers.BooleanField(write_only=True, required=True)

    class Meta:
        model = HostApplication
        fields = [
            "id",
            "full_name",
            "phone_number",
            "id_card_image",
            "selfie_with_id",
            "bank_name",
            "account_number",
            "host_terms_accepted",
            "host_terms_accepted_at",
            "host_terms_version",
            "host_commission_rate",
            "host_terms_accepted_ip",
            "host_terms_accepted_user_agent",
            # "bank_info",
            "status",
            "submitted_at",
        ]
        read_only_fields = [
            "status",
            "submitted_at",
            "host_terms_accepted_at",
            "host_terms_version",
            "host_commission_rate",
            "host_terms_accepted_ip",
            "host_terms_accepted_user_agent",
        ]

    def validate_host_terms_accepted(self, value):
        if not value:
            raise serializers.ValidationError(
                "Түрээслүүлэгчийн нөхцөлийг зөвшөөрнө үү."
            )
        return value

    def create(self, validated_data):
        validated_data.pop("host_terms_accepted", None)
        request = self.context.get("request")
        if request:
            forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
            accepted_ip = forwarded_for.split(",")[0].strip() or request.META.get(
                "REMOTE_ADDR"
            )
            validated_data["host_terms_accepted_ip"] = accepted_ip
            validated_data["host_terms_accepted_user_agent"] = request.META.get(
                "HTTP_USER_AGENT", ""
            )
        validated_data["host_terms_accepted_at"] = timezone.now()
        validated_data["host_terms_version"] = "2026-09-15"
        validated_data["host_commission_rate"] = "10.00"
        return super().create(validated_data)
