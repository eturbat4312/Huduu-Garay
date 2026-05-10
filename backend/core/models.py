from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model

# from .utils.notifications import send_notification_email
from core.utils.email_notifications import send_notification_email


# -------------------- USER --------------------


class CustomUser(AbstractUser):
    is_host = models.BooleanField(default=False)
    is_guest = models.BooleanField(default=True)

    HOST_APPLICATION_CHOICES = [
        ("none", "Бүртгүүлээгүй"),
        ("pending", "Хүлээгдэж байна"),
        ("approved", "Зөвшөөрсөн"),
        ("rejected", "Татгалзсан"),
    ]
    host_application_status = models.CharField(
        max_length=20, choices=HOST_APPLICATION_CHOICES, default="none"
    )

    # 👇 Эдгээр нь бүх хэрэглэгчид хамаарах профайл мэдээлэл
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    full_name = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return self.username


# -------------------- CATEGORY --------------------


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    icon = models.CharField(max_length=100, blank=True, null=True)
    image = models.ImageField(upload_to="category_images/", blank=True, null=True)

    def __str__(self):
        return self.name


# -------------------- AMENITY --------------------


class Amenity(models.Model):
    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=50, blank=True, null=True)
    # translation_key = models.CharField(max_length=100, blank=True)
    translation_key = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return self.name


# -------------------- LISTING --------------------


class Listing(models.Model):
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="listings"
    )
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True)
    title = models.CharField(max_length=200)
    description = models.TextField()

    price_per_night = models.DecimalField(max_digits=10, decimal_places=2)
    max_guests = models.PositiveIntegerField(default=1)
    beds = models.PositiveIntegerField(default=1)

    amenities = models.ManyToManyField(Amenity, blank=True)

    location_city = models.CharField(max_length=100, default="")           # Хот/Аймаг — public
    location_district = models.CharField(max_length=100, default="")       # Дүүрэг/Сум — public
    location_khoroo = models.CharField(max_length=100, blank=True, default="")  # Хороо/Баг — public
    location_extra = models.CharField(max_length=200, blank=True, default="")   # Хороолол/Нэмэлт — public
    location_building = models.CharField(max_length=100, blank=True, default="")  # Байр — public
    location_apartment = models.CharField(max_length=50, blank=True, default="")  # Тоот — private
    location_lat = models.FloatField(blank=True, null=True)
    location_lng = models.FloatField(blank=True, null=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.host.username})"


# -------------------- LISTING IMAGE --------------------


class ListingImage(models.Model):
    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="images"
    )
    image = models.ImageField(upload_to="listing_images/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.listing.title}"


# -------------------- FAVORITE --------------------


class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites"
    )
    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="favorited_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "listing")

    def __str__(self):
        return f"{self.user.username} ❤️ {self.listing.title}"


# -------------------- AVAILABILITY --------------------


class Availability(models.Model):
    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="availabilities"
    )
    date = models.DateField()

    def __str__(self):
        return f"{self.listing.title} - {self.date}"


# -------------------- BOOKING --------------------


class Booking(models.Model):

    STATUS_CHOICES = [
        ("confirmed", "Confirmed"),
        ("cancelled", "Cancelled"),
        ("pending", "Pending"),
    ]
    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="bookings"
    )
    guest = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings"
    )
    check_in = models.DateField()
    check_out = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    full_name = models.CharField(max_length=100, default="Guest")
    phone_number = models.CharField(max_length=20, default="00000000")
    notes = models.TextField(default="", blank=True)
    is_cancelled_by_host = models.BooleanField(default=False)
    guest_count = models.PositiveIntegerField(default=1)
    total_price = models.PositiveIntegerField(default=0)
    service_fee = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.listing.title} booked by {self.guest.username} ({self.check_in} → {self.check_out})"


User = get_user_model()


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ("booking", "Захиалга"),
        ("booking_cancelled", "Цуцлагдсан захиалга"),
        ("review", "Сэтгэгдэл"),
        ("comment", "Сэтгэгдэл"),
        ("payment", "Төлбөр"),
        ("rating", "Үнэлгээ"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="notifications"
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    type = models.CharField(
        max_length=20, choices=NOTIFICATION_TYPES, default="booking"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    related_booking = models.ForeignKey(  # ✅ энэ хэсгийг нэм
        "Booking",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    related_listing = models.ForeignKey(
        "Listing",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    def __str__(self):
        return f"[{self.type}] to {self.user.username}: {self.message[:30]}"


class Review(models.Model):
    listing = models.ForeignKey(
        "Listing", on_delete=models.CASCADE, related_name="reviews"
    )
    booking = models.ForeignKey(
        "Booking", on_delete=models.CASCADE, related_name="review"
    )
    guest = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField()  # 1 to 5
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (
            "listing",
            "booking",
            "guest",
        )  # нэг booking дээр нэг review л зөвшөөрнө

    def __str__(self):
        return f"{self.listing.title} - {self.rating}⭐ by {self.guest.username}"

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.rating < 1 or self.rating > 5:
            raise ValidationError("Rating must be between 1 and 5.")


class HostApplication(models.Model):
    STATUS_CHOICES = [
        ("pending", "Хүлээгдэж байна"),
        ("approved", "Зөвшөөрсөн"),
        ("rejected", "Татгалзсан"),
    ]

    BANK_CHOICES = [
        ("Хаан Банк", "Хаан Банк"),
        ("Голомт Банк", "Голомт Банк"),
        ("ХХБанк", "Худалдаа Хөгжлийн Банк"),
        ("Төрийн Банк", "Төрийн Банк"),
        ("Капитрон", "Капитрон"),
        ("ХАС Банк", "ХАС Банк"),
        ("Чингис Хаан Банк", "Чингис Хаан Банк"),
    ]

    bank_name = models.CharField(max_length=100, choices=BANK_CHOICES)
    account_number = models.CharField(max_length=30)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20)
    id_card_image = models.ImageField(upload_to="id_cards/")
    selfie_with_id = models.ImageField(upload_to="selfies/")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Host Request by {self.user.username}"

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        old_status = None

        if not is_new:
            old = HostApplication.objects.get(pk=self.pk)
            old_status = old.status

        # 🔄 CustomUser model-ийн талбарыг шинэчилж байна
        self.user.host_application_status = self.status
        self.user.is_host = self.status == "approved"
        self.user.save()

        super().save(*args, **kwargs)

        # 📬 Имэйл илгээх логик
        if is_new:
            send_notification_email(
                self.user,
                notif_type="host_application_created",
                context={"full_name": self.full_name},
            )
        elif old_status != self.status:
            if self.status == "approved":
                send_notification_email(
                    self.user,
                    notif_type="host_application_approved",
                    context={"full_name": self.full_name},
                )
            elif self.status == "rejected":
                send_notification_email(
                    self.user,
                    notif_type="host_application_rejected",
                    context={"full_name": self.full_name},
                )
