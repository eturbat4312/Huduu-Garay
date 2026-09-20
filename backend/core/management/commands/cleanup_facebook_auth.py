from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import FacebookAuthFlow


class Command(BaseCommand):
    help = "Remove expired Facebook OAuth handshakes and pending email confirmations."

    def handle(self, *args, **options):
        count, _ = FacebookAuthFlow.objects.filter(expires_at__lte=timezone.now()).delete()
        self.stdout.write(f"Removed {count} expired Facebook auth handshakes.")
