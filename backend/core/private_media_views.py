import mimetypes

from django.contrib.admin.views.decorators import staff_member_required
from django.core import signing
from django.core.exceptions import SuspiciousFileOperation
from django.http import FileResponse, Http404
from django.views.decorators.http import require_GET

from .private_storage import load_private_media_token, private_storage

# Зөвхөн эдгээр төрлийг browser дотор нээнэ. Бусад нь (html, svg г.м.) заавал
# татагдана — admin-ы origin дээр XSS гарахаас сэргийлнэ.
INLINE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    "application/pdf",
}


@require_GET
@staff_member_required
def private_media_view(request, token):
    try:
        name = load_private_media_token(token)
    except signing.BadSignature:
        raise Http404("Холбоос хүчингүй эсвэл хугацаа нь дууссан байна.")

    try:
        if not name or not private_storage.exists(name):
            raise Http404("Файл олдсонгүй.")
        file_handle = private_storage.open(name, "rb")
    except SuspiciousFileOperation:
        raise Http404("Файл олдсонгүй.")

    content_type, _ = mimetypes.guess_type(name)
    inline = content_type in INLINE_CONTENT_TYPES
    response = FileResponse(
        file_handle,
        content_type=content_type if inline else "application/octet-stream",
        as_attachment=not inline,
        filename=name.rsplit("/", 1)[-1],
    )
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; sandbox"
    response["Referrer-Policy"] = "no-referrer"
    return response
