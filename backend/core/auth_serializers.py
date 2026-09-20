from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.utils import get_md5_hash_password


class PasswordAwareTokenRefreshSerializer(TokenRefreshSerializer):
    """Reject refresh tokens issued before a password change (including legacy tokens)."""

    def validate(self, attrs):
        refresh = self.token_class(attrs["refresh"])
        try:
            user = get_user_model().objects.get(
                **{api_settings.USER_ID_FIELD: refresh.get(api_settings.USER_ID_CLAIM)}
            )
        except get_user_model().DoesNotExist:
            raise AuthenticationFailed("Дахин нэвтэрнэ үү.")
        if not user.is_active or refresh.get(api_settings.REVOKE_TOKEN_CLAIM) != get_md5_hash_password(user.password):
            raise AuthenticationFailed("Нэвтрэх эрх хүчингүй болсон байна. Дахин нэвтэрнэ үү.")
        return super().validate(attrs)
