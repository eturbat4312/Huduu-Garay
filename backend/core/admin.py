from django.contrib import admin
from django.db.models import Sum
from django.utils.html import format_html
from django.shortcuts import render
from django.utils import timezone
from datetime import timedelta
from .models import (
    Category,
    Listing,
    ListingImage,
    Availability,
    Booking,
    Amenity,
    HostApplication,
    Notification,
)
from django.contrib.auth import get_user_model

User = get_user_model()


# ── User ──────────────────────────────────────────────────────────────────────
@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("username", "email", "is_host", "host_application_status", "date_joined", "is_staff")
    list_filter = ("is_host", "host_application_status", "is_staff")
    search_fields = ("username", "email")
    ordering = ("-date_joined",)
    readonly_fields = ("date_joined", "last_login")


# ── Booking ───────────────────────────────────────────────────────────────────
@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "id", "guest_name_display", "listing_title", "check_in", "check_out",
        "guest_count", "total_price_display", "host_payout_display", "platform_fee_display",
        "is_cancelled_by_host", "created_at",
    )
    list_filter = ("is_cancelled_by_host", "check_in")
    search_fields = ("id", "full_name", "phone_number", "guest__username", "listing__title")
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)

    def guest_name_display(self, obj):
        return f"{obj.full_name} (@{obj.guest.username})"
    guest_name_display.short_description = "Зочин"

    def listing_title(self, obj):
        return obj.listing.title
    listing_title.short_description = "Зар"

    def total_price_display(self, obj):
        return f"₮{obj.total_price:,}"
    total_price_display.short_description = "Нийт үнэ"

    def host_payout_display(self, obj):
        payout = int(obj.total_price * 0.9)
        return f"₮{payout:,}"
    host_payout_display.short_description = "Host авах"

    def platform_fee_display(self, obj):
        fee = int(obj.total_price * 0.1) + obj.service_fee
        return f"₮{fee:,}"
    platform_fee_display.short_description = "Платформ орлого"


# ── Listing ───────────────────────────────────────────────────────────────────
@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "host_username", "location_display", "price_per_night", "is_active", "created_at")
    list_filter = ("is_active", "category")
    search_fields = ("title", "host__username", "location_city", "location_district")
    ordering = ("-created_at",)

    def host_username(self, obj):
        return obj.host.username
    host_username.short_description = "Host"

    def location_display(self, obj):
        return ", ".join(filter(None, [obj.location_city, obj.location_district]))
    location_display.short_description = "Байршил"


# ── HostApplication ───────────────────────────────────────────────────────────
@admin.register(HostApplication)
class HostApplicationAdmin(admin.ModelAdmin):
    list_display = ("user", "full_name", "phone_number", "bank_name", "status", "submitted_at")
    list_filter = ("status",)
    search_fields = ("user__username", "full_name", "phone_number")
    ordering = ("-submitted_at",)


# ── Category ──────────────────────────────────────────────────────────────────
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "icon", "preview_image")

    def preview_image(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="50" />', obj.image.url)
        return "—"
    preview_image.short_description = "Зураг"


# ── Amenity ───────────────────────────────────────────────────────────────────
@admin.register(Amenity)
class AmenityAdmin(admin.ModelAdmin):
    list_display = ("name", "translation_key")
    search_fields = ("name", "translation_key")


# ── Other models ──────────────────────────────────────────────────────────────
admin.site.register(ListingImage)
admin.site.register(Availability)
admin.site.register(Notification)


# ── Custom stats dashboard ────────────────────────────────────────────────────
def stats_view(request):
    now = timezone.now()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    bookings = Booking.objects.all()
    active = bookings.filter(is_cancelled_by_host=False)

    total_revenue = active.aggregate(s=Sum("total_price"))["s"] or 0
    total_guest_fees = active.aggregate(s=Sum("service_fee"))["s"] or 0
    total_host_fees = int(total_revenue * 0.10)
    platform_total = total_guest_fees + total_host_fees

    month_bookings = active.filter(created_at__gte=this_month_start)
    month_revenue = month_bookings.aggregate(s=Sum("total_price"))["s"] or 0
    month_guest_fees = month_bookings.aggregate(s=Sum("service_fee"))["s"] or 0
    month_host_fees = int(month_revenue * 0.10)
    month_platform = month_guest_fees + month_host_fees

    total_users = User.objects.count()
    total_hosts = User.objects.filter(is_host=True).count()
    new_users_month = User.objects.filter(date_joined__gte=this_month_start).count()
    pending_applications = HostApplication.objects.filter(status="pending").count()

    total_bookings = bookings.count()
    active_bookings = active.count()
    cancelled_bookings = bookings.filter(is_cancelled_by_host=True).count()
    month_booking_count = month_bookings.count()

    monthly_data = []
    for i in range(5, -1, -1):
        d = now - timedelta(days=30 * i)
        start = d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i == 0:
            end = now
        else:
            end = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        count = active.filter(created_at__gte=start, created_at__lt=end).count()
        revenue = active.filter(created_at__gte=start, created_at__lt=end).aggregate(s=Sum("total_price"))["s"] or 0
        monthly_data.append({
            "month": start.strftime("%Y/%m"),
            "count": count,
            "revenue": revenue,
            "platform": int(revenue * 0.20),
        })

    context = {
        **admin.site.each_context(request),
        "title": "Статистик тайлан",
        "total_revenue": total_revenue,
        "total_guest_fees": total_guest_fees,
        "total_host_fees": total_host_fees,
        "platform_total": platform_total,
        "month_revenue": month_revenue,
        "month_guest_fees": month_guest_fees,
        "month_host_fees": month_host_fees,
        "month_platform": month_platform,
        "total_users": total_users,
        "total_hosts": total_hosts,
        "total_guests": total_users - total_hosts,
        "new_users_month": new_users_month,
        "pending_applications": pending_applications,
        "total_bookings": total_bookings,
        "active_bookings": active_bookings,
        "cancelled_bookings": cancelled_bookings,
        "month_booking_count": month_booking_count,
        "monthly_data": monthly_data,
    }
    return render(request, "admin/stats.html", context)
