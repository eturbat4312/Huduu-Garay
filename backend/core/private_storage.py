"""Нууц файлын (иргэний үнэмлэх, selfie, санхүүгийн баримт) хадгалалт.

Эдгээр файл MEDIA_ROOT-оос тусдаа PRIVATE_MEDIA_ROOT-д хадгалагдана. Nginx
энэ хавтсыг serve хийдэггүй. Файлын `.url` нь staff-д зориулсан, хугацаатай
гарын үсэгтэй admin холбоос буцаана. Тиймээс admin form болон template-ууд
өөрчлөлтгүйгээр аюулгүй холбоос гаргана.
"""

import os
import uuid

from django.conf import settings
from django.core import signing
from django.core.files.storage import FileSystemStorage
from django.urls import reverse
from django.utils import timezone
from django.utils.deconstruct import deconstructible

PRIVATE_MEDIA_SIGNING_SALT = "core.private-media"
PRIVATE_MEDIA_URL_MAX_AGE = 60 * 60  # 1 цаг

ALLOWED_PRIVATE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".gif", ".pdf"}


@deconstructible
class PrivateMediaStorage(FileSystemStorage):
    """PRIVATE_MEDIA_ROOT-д бичдэг, public URL гаргадаггүй storage."""

    @property
    def base_location(self):
        return self._value_or_setting(self._location, settings.PRIVATE_MEDIA_ROOT)

    @property
    def location(self):
        return os.path.abspath(self.base_location)

    @property
    def base_url(self):
        return None

    def url(self, name):
        token = signing.dumps(name, salt=PRIVATE_MEDIA_SIGNING_SALT)
        return reverse("private-media", args=[token])


private_storage = PrivateMediaStorage()


def load_private_media_token(token):
    """Token-оос файлын нэрийг гаргана. Буруу/хугацаа дууссан бол signing.BadSignature."""
    return signing.loads(
        token, salt=PRIVATE_MEDIA_SIGNING_SALT, max_age=PRIVATE_MEDIA_URL_MAX_AGE
    )


def _random_private_name(prefix, filename):
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_PRIVATE_EXTENSIONS:
        ext = ""
    now = timezone.now()
    return f"{prefix}/{now:%Y/%m}/{uuid.uuid4().hex}{ext}"


def id_card_upload_to(instance, filename):
    return _random_private_name("id_cards", filename)


def selfie_upload_to(instance, filename):
    return _random_private_name("selfies", filename)


def host_payout_proof_upload_to(instance, filename):
    return _random_private_name("financial_proofs/host_payouts", filename)


def guest_refund_proof_upload_to(instance, filename):
    return _random_private_name("financial_proofs/guest_refunds", filename)
