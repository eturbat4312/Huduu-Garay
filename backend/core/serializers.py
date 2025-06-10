from rest_framework import serializers
from datetime import timedelta
from django.contrib.auth import get_user_model
from .models import (
    Category,
    Listing,
    ListingImage,
    Availability,
    Booking,
    Amenity,
    Favorite,
    Notification,
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
    class Meta:
        model = User
        fields = ("id", "username", "email", "is_host", "is_guest")
        read_only_fields = ("id", "email", "is_guest")


# -------------------- CATEGORY --------------------


class CategorySerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "description", "icon", "image"]

    def get_image(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        elif obj.image:
            return obj.image.url
        return None


# -------------------- AMENITY --------------------


class AmenitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Amenity
        fields = "__all__"


# -------------------- LISTING IMAGE --------------------


class ListingImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListingImage
        fields = "__all__"


# -------------------- LISTING --------------------


class ListingSerializer(serializers.ModelSerializer):
    images = ListingImageSerializer(many=True, read_only=True)
    amenities = AmenitySerializer(many=True, read_only=True)
    category = CategorySerializer(read_only=True)
    host_username = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()
    favorite_id = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()  # 🟢 ШИНЭЭР НЭМНЭ

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
            "location_text",
            "price_per_night",
            "max_guests",
            "beds",
            "host_username",  # 🟢 Host info
            "category",
            "category_id",  # 🟢 POST/PUT үед
            "amenities",
            "amenity_ids",  # 🟢 POST/PUT үед
            "images",
            "is_favorited",
            "favorite_id",
            "thumbnail",
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
    # listing = serializers.SerializerMethodField(read_only=True)
    listing = ListingSerializer(read_only=True)
    listing_id = serializers.PrimaryKeyRelatedField(
        queryset=Listing.objects.all(), write_only=True, source="listing"
    )
    total_price = serializers.SerializerMethodField(read_only=True)
    status = serializers.CharField(read_only=True)

    # 📝 Write-only талбарууд
    full_name = serializers.CharField()
    phone_number = serializers.CharField()
    notes = serializers.CharField(required=False, allow_blank=True)

    # ✅ Read-only талбарууд
    guest_name = serializers.SerializerMethodField()
    guest_phone = serializers.SerializerMethodField()
    is_cancelled_by_host = serializers.BooleanField(read_only=True)
    # guest_count = serializers.IntegerField()
    guest_count = serializers.IntegerField()

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
            "guest_count",
        ]

    def get_listing(self, obj):
        request = self.context.get("request")
        thumbnail = None
        if obj.listing.images.exists():
            image_url = obj.listing.images.first().image.url
            thumbnail = request.build_absolute_uri(image_url) if request else image_url

        return {
            "id": obj.listing.id,
            "title": obj.listing.title,
            "location": obj.listing.location_text,
            "thumbnail": thumbnail,
        }

    def get_total_price(self, obj):
        nights = (obj.check_out - obj.check_in).days
        return (
            nights * obj.listing.price_per_night if obj.listing.price_per_night else 0
        )

    def get_guest_name(self, obj):
        return obj.full_name

    def get_guest_phone(self, obj):
        return obj.phone_number


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "message", "is_read", "created_at"]
