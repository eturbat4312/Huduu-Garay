from django.core.management.base import BaseCommand

from core.image_processing import process_listing_thumbnail
from core.models import ListingImage


class Command(BaseCommand):
    help = "Create lightweight home-page thumbnails for existing listing images."

    def handle(self, *args, **options):
        created = 0
        failed = 0
        queryset = ListingImage.objects.filter(thumbnail="").order_by("id")

        for listing_image in queryset.iterator():
            try:
                listing_image.image.open("rb")
                thumbnail = process_listing_thumbnail(listing_image.image.file)
                listing_image.thumbnail.save(thumbnail.name, thumbnail, save=True)
                created += 1
            except Exception as error:
                failed += 1
                self.stderr.write(
                    f"ListingImage #{listing_image.pk}: {error}"
                )
            finally:
                listing_image.image.close()

        self.stdout.write(
            self.style.SUCCESS(
                f"Created {created} thumbnail(s); {failed} failed."
            )
        )
