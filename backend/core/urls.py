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
    NotificationMarkAsReadView,
    HostBookingDetailView,
    MyListingsView,
    HostBookingCalendarView,
    ListingUpdateView,
    AvailabilityDeleteByListingView,
    ListingImageDeleteView,
    ListingDeleteView,
    ReviewCreateListView,
    HostApplicationCreateView,
    HostApplicationMeView,
    BookingRetrieveView,
    GoogleLogin,
)

# from core.adapters import GoogleOneTapLoginView
# from core.views import GoogleOneTapLoginView

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
    path("bookings/<int:pk>/", BookingRetrieveView.as_view(), name="booking-detail"),
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("host-bookings/<int:pk>/", HostBookingDetailView.as_view()),  # ✅ нэмсэн
    path(
        "notifications/unread-count/",
        NotificationUnreadCountView.as_view(),
        name="notification-unread-count",
    ),
    path("notifications/mark-read/", NotificationMarkAsReadView.as_view()),
    path("my-listings/", MyListingsView.as_view(), name="my-listings"),
    path("host-booking-calendar/", HostBookingCalendarView.as_view()),
    path("listings/<int:pk>/edit/", ListingUpdateView.as_view(), name="listing-update"),
    path(
        "availability/delete-by-listing/",
        AvailabilityDeleteByListingView.as_view(),
        name="availability-delete-by-listing",
    ),
    path("listing-images/<int:image_id>/delete/", ListingImageDeleteView.as_view()),
    path(
        "listings/<int:listing_id>/delete/",
        ListingDeleteView.as_view(),
        name="listing-delete",
    ),
    path("reviews/", ReviewCreateListView.as_view(), name="review-list-create"),
    path(
        "listings/<int:listing_id>/reviews/",
        ReviewCreateListView.as_view(),
        name="review-listing",
    ),
    path("host/apply/", HostApplicationCreateView.as_view(), name="host-apply"),
    path("host/application/me/", HostApplicationMeView.as_view()),
    path("google/", GoogleLogin.as_view(), name="google_login"),
    # path("auth/google/", GoogleOneTapLoginView.as_view(), name="google-login"),
    # path("auth/google/", GoogleOneTapLoginView.as_view(), name="google-login"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
