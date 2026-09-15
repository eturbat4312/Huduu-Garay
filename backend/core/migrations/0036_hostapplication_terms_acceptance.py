from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0035_add_admin_booking_notification_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="hostapplication",
            name="host_terms_accepted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="hostapplication",
            name="host_terms_version",
            field=models.CharField(default="2026-09-15", max_length=20),
        ),
        migrations.AddField(
            model_name="hostapplication",
            name="host_commission_rate",
            field=models.DecimalField(decimal_places=2, default=10.0, max_digits=5),
        ),
        migrations.AddField(
            model_name="hostapplication",
            name="host_terms_accepted_ip",
            field=models.GenericIPAddressField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="hostapplication",
            name="host_terms_accepted_user_agent",
            field=models.TextField(blank=True),
        ),
    ]
