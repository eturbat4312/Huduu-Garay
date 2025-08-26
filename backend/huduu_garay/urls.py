from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),  # core app API-ууд
    # JWT
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # dj-rest-auth энд бүгдийг API доор хийе
    path("api/auth/", include("dj_rest_auth.urls")),
    path("api/auth/registration/", include("dj_rest_auth.registration.urls")),
    path(
        "api/auth/social/", include("allauth.socialaccount.urls")
    ),  # Social logins (Google)
    path(
        "accounts/", include("allauth.urls")
    ),  # UI redirects like /accounts/google/login/
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


# urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
