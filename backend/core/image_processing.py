from io import BytesIO
import uuid

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError


MAX_LISTING_IMAGE_BYTES = 20 * 1024 * 1024
MAX_LISTING_IMAGE_PIXELS = 50_000_000
MAX_LISTING_IMAGE_DIMENSION = 1920
LISTING_IMAGE_QUALITY = 85


class ListingImageProcessingError(ValueError):
    pass


def process_listing_image(uploaded_image) -> ContentFile:
    if uploaded_image.size > MAX_LISTING_IMAGE_BYTES:
        raise ListingImageProcessingError("Нэг зураг 20 MB-аас ихгүй байх ёстой.")

    try:
        with Image.open(uploaded_image) as candidate:
            candidate.verify()
        uploaded_image.seek(0)
        with Image.open(uploaded_image) as source:
            width, height = source.size
            if width * height > MAX_LISTING_IMAGE_PIXELS:
                raise ListingImageProcessingError(
                    "Зургийн нягтрал хэт их байна. 50 MP-ээс бага зураг сонгоно уу."
                )

            source.seek(0)
            image = ImageOps.exif_transpose(source)
            image.thumbnail(
                (MAX_LISTING_IMAGE_DIMENSION, MAX_LISTING_IMAGE_DIMENSION),
                Image.Resampling.LANCZOS,
                reducing_gap=3.0,
            )

            if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
                rgba = image.convert("RGBA")
                rgb = Image.new("RGB", rgba.size, "white")
                rgb.paste(rgba, mask=rgba.getchannel("A"))
                image = rgb
            else:
                image = image.convert("RGB")

            buffer = BytesIO()
            image.save(
                buffer,
                format="JPEG",
                quality=LISTING_IMAGE_QUALITY,
                optimize=True,
                progressive=True,
                subsampling="4:2:0",
                exif=b"",
            )
    except ListingImageProcessingError:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError) as error:
        raise ListingImageProcessingError(
            "Зураг унших боломжгүй байна. JPG, PNG, WebP эсвэл GIF "
            "форматтай зураг оруулна уу."
        ) from error

    buffer.seek(0)
    return ContentFile(
        buffer.read(),
        name=f"listing-{uuid.uuid4().hex}.jpg",
    )
