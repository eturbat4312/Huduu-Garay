from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings

# -------------------- USER --------------------

class CustomUser(AbstractUser):
    is_host = models.BooleanField(default=False)
    is_guest = models.BooleanField(default=True)

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

    location_text = models.CharField(max_length=255)
    location_lat = models.FloatField(blank=True, null=True)
    location_lng = models.FloatField(blank=True, null=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.host.username})"

# -------------------- LISTING IMAGE --------------------

class ListingImage(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="images")
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
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="availabilities")
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
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="bookings")
    guest = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings")
    check_in = models.DateField()
    check_out = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    full_name = models.CharField(max_length=100, default="Guest")
    phone_number = models.CharField(max_length=20, default="00000000")
    notes = models.TextField(default="", blank=True)
    is_cancelled_by_host = models.BooleanField(default=False)
    guest_count = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.listing.title} booked by {self.guest.username} ({self.check_in} → {self.check_out})"
