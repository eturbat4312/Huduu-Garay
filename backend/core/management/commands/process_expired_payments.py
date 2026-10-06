import time

from django.core.management.base import BaseCommand

from core.services.payment_expiry import process_due_payment_cancellations


class Command(BaseCommand):
    help = "Хугацаа дууссан төлбөрийн invoice-ийг хаасны дараа огнооны hold суллана."

    def add_arguments(self, parser):
        parser.add_argument("--watch", action="store_true")
        parser.add_argument("--interval", type=int, default=5)
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        interval = max(1, options["interval"])
        while True:
            expired_count, attempted_count = process_due_payment_cancellations(
                limit=max(1, options["limit"])
            )
            if expired_count or attempted_count:
                self.stdout.write(
                    f"Payment expiry: {expired_count} expired booking, "
                    f"{attempted_count} cancellation attempt."
                )
            if not options["watch"]:
                return
            time.sleep(interval)
