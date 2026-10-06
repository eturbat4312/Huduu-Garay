from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0060_listingimage_thumbnail"),
    ]

    operations = [
        migrations.AlterField(
            model_name="payment",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Хүлээгдэж байна"),
                    ("cancellation_pending", "Нэхэмжлэх хаагдаж байна"),
                    ("paid", "Төлөгдсөн"),
                    ("failed", "Амжилтгүй"),
                    ("cancelled", "Цуцлагдсан"),
                    ("expired", "Хугацаа дууссан"),
                    ("refunded", "Буцаагдсан"),
                ],
                db_index=True,
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="payment",
            name="cancellation_attempt_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="payment",
            name="cancellation_reason",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="payment",
            name="cancellation_requested_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="last_cancellation_error",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="next_cancellation_attempt_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
    ]
