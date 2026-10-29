from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0061_payment_cancellation_lifecycle"),
    ]

    operations = [
        migrations.CreateModel(
            name="AppleAccount",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("apple_subject", models.CharField(max_length=255, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=models.deletion.CASCADE,
                        related_name="apple_account",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
