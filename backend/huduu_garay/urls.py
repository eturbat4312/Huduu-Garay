from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.admin.views.decorators import staff_member_required
from core.admin import booking_finance_detail_view, stats_view

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path(
        "admin/stats/bookings/<int:booking_id>/",
        staff_member_required(booking_finance_detail_view),
        name="admin-booking-finance-detail",
    ),
    path("admin/stats/", staff_member_required(stats_view), name="admin-stats"),
    path("admin/", staff_member_required(stats_view), name="admin-home"),
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),  # core app API-ууд
    # JWT
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Authentication бүгд API дор
    path("api/auth/", include("dj_rest_auth.urls")),
    path("api/auth/registration/", include("dj_rest_auth.registration.urls")),
    path("api/auth/social/", include("allauth.socialaccount.urls")),
    # UI redirects (Google/FB auth redirect-д л хэрэглэгдэнэ)
    path("accounts/", include("allauth.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


# urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
