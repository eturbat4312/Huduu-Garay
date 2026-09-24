"""Хуучин нууц файлуудыг public MEDIA_ROOT-оос PRIVATE_MEDIA_ROOT руу зөөнө.

    python manage.py move_private_media --dry-run
    python manage.py move_private_media
    python manage.py move_private_media --purge-orphans   # DB-д холбоогүй үлдэгдлийг устгана

Файлын нэр (DB дахь утга) өөрчлөгдөхгүй, зөвхөн байршил солигдоно.
"""

import os
import shutil

from django.conf import settings
from django.core.management.base import BaseCommand

from core.models import GuestRefund, HostApplication, HostPayout

PRIVATE_PREFIXES = ("id_cards", "selfies", "financial_proofs")

FIELDS = (
    (HostApplication, "id_card_image"),
    (HostApplication, "selfie_with_id"),
    (HostPayout, "transfer_proof"),
    (GuestRefund, "transfer_proof"),
)


class Command(BaseCommand):
    help = "Иргэний үнэмлэх, selfie, санхүүгийн баримтыг public media-аас private storage руу зөөнө."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Юу хийхийг л харуулна.")
        parser.add_argument(
            "--purge-orphans",
            action="store_true",
            help="Зөөсний дараа public хавтсанд үлдсэн (DB-д холбоогүй) нууц файлыг устгана.",
        )

    def handle(self, *args, dry_run=False, purge_orphans=False, **options):
        public_root = os.path.abspath(settings.MEDIA_ROOT)
        private_root = os.path.abspath(settings.PRIVATE_MEDIA_ROOT)
        moved = missing = already = 0

        for model, field_name in FIELDS:
            names = (
                model.objects.exclude(**{field_name: ""})
                .exclude(**{f"{field_name}__isnull": True})
                .values_list(field_name, flat=True)
            )
            for name in names:
                src = self._safe_join(public_root, name)
                dst = self._safe_join(private_root, name)
                if src is None or dst is None:
                    self.stderr.write(f"Алгассан (буруу зам): {name}")
                    continue
                if os.path.exists(dst):
                    already += 1
                    continue
                if not os.path.exists(src):
                    missing += 1
                    self.stdout.write(f"Олдсонгүй: {name}")
                    continue
                self.stdout.write(f"{'[dry-run] ' if dry_run else ''}Зөөж байна: {name}")
                if not dry_run:
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    shutil.move(src, dst)
                moved += 1

        orphans = []
        for prefix in PRIVATE_PREFIXES:
            base = os.path.join(public_root, prefix)
            for dirpath, _dirs, files in os.walk(base):
                orphans.extend(os.path.join(dirpath, f) for f in files)

        if purge_orphans:
            for path in orphans:
                self.stdout.write(f"{'[dry-run] ' if dry_run else ''}Устгаж байна: {path}")
                if not dry_run:
                    os.remove(path)

        self.stdout.write(
            self.style.SUCCESS(
                f"Зөөсөн: {moved}, аль хэдийн private: {already}, олдоогүй: {missing}, "
                f"public-д үлдсэн нууц файл: {0 if purge_orphans and not dry_run else len(orphans)}"
            )
        )
        if orphans and not purge_orphans:
            self.stdout.write(
                self.style.WARNING(
                    "Public хавтсанд нууц файл үлдсэн байна. --purge-orphans ашиглаж устгана уу."
                )
            )

    @staticmethod
    def _safe_join(root, name):
        path = os.path.abspath(os.path.join(root, name))
        if os.path.commonpath([root, path]) != root:
            return None
        return path
