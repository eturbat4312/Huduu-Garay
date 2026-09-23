import time
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import PushDelivery
from core.services.push_notifications import (
    check_push_receipts,
    send_pending_push_deliveries,
)


class Command(BaseCommand):
    help = "Илгээгдээгүй Expo push-үүдийг илгээж, хүргэлтийн receipt шалгана."

    def add_arguments(self, parser):
        parser.add_argument("--watch", action="store_true")
        parser.add_argument("--interval", type=int, default=60)

    def handle(self, *args, **options):
        interval = max(10, options["interval"])
        while True:
            stale_before = timezone.now() - timedelta(minutes=5)
            PushDelivery.objects.filter(
                status=PushDelivery.STATUS_SENDING,
                last_attempt_at__lt=stale_before,
            ).update(status=PushDelivery.STATUS_PENDING)

            accepted = send_pending_push_deliveries(limit=100)
            checked = check_push_receipts(limit=1000)
            if accepted or checked:
                self.stdout.write(
                    f"Push: Expo хүлээн авсан {accepted}, receipt шалгасан {checked}."
                )

            if not options["watch"]:
                return
            time.sleep(interval)
