from django.urls import path
from django.conf.urls.static import static
from django.conf import settings
from .views import (
    CategoryListCreateView,
    ListingListCreateView,
    ListingImageUploadView,
    AvailabilityListCreateView,
    AvailabilityBulkCreateView,
    AvailabilityDeleteView,
    SignupView,
    MeView,
    BookingCreateView,
    ListingRetrieveView,
    AmenityListView,
    FavoriteCreateView,
    FavoriteDeleteView,
    FavoriteListView,
    MyBookingView,
    HostBookingListView,
    HostBookingCancelView,
    NotificationListView,
    NotificationUnreadCountView,

)

urlpatterns = [
    path("categories/", CategoryListCreateView.as_view(), name="category-list-create"),
    path("listings/", ListingListCreateView.as_view(), name="listing-list-create"),
    path(
        "listing-images/", ListingImageUploadView.as_view(), name="listing-image-upload"
    ),
    path(
        "availability/",
        AvailabilityListCreateView.as_view(),
        name="availability-list-create",
    ),
    path(
        "availability/bulk/",
        AvailabilityBulkCreateView.as_view(),
        name="availability-bulk-create",
    ),
    path(
        "availability/<int:id>/",
        AvailabilityDeleteView.as_view(),
        name="availability-delete",
    ),
    path("signup/", SignupView.as_view(), name="signup"),
    path("me/", MeView.as_view(), name="me"),
    path("bookings/", BookingCreateView.as_view(), name="booking-create"),
    path("listings/<int:pk>/", ListingRetrieveView.as_view(), name="listing-detail"),
    path("amenities/", AmenityListView.as_view()),
    path("favorites/", FavoriteCreateView.as_view()),
    path("favorites/<int:id>/", FavoriteDeleteView.as_view()),
    path("my-favorites/", FavoriteListView.as_view()),
    path("bookings/my/", MyBookingView.as_view(), name="my-bookings"),
    path("host-bookings/", HostBookingListView.as_view(), name="host-bookings"),
    path("bookings/<int:booking_id>/host-cancel/", HostBookingCancelView.as_view()),
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/unread-count/', NotificationUnreadCountView.as_view(), name='notification-unread-count'),
]+ static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
