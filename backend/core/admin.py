from django.contrib import admin
from .models import Category, Listing, ListingImage, Availability, Booking, Amenity
from django.contrib.auth import get_user_model


User = get_user_model()
admin.site.register(User)
# admin.site.register(Category)
admin.site.register(Listing)
admin.site.register(ListingImage)
admin.site.register(Availability)
admin.site.register(Booking)
admin.site.register(Amenity)

class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "icon", "preview_image")

    def preview_image(self, obj):
        if obj.image:
            return f'<img src="{obj.image.url}" width="50" />'
        return "No image"
    preview_image.allow_tags = True
    preview_image.short_description = "Image"

admin.site.register(Category, CategoryAdmin)

