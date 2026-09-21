import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0054_alter_notification_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="listing",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending_review", "Хяналт хүлээж байна"),
                    ("active", "Нийтлэгдсэн"),
                    ("changes_requested", "Засвар шаардлагатай"),
                    ("rejected", "Татгалзсан"),
                    ("suspended", "Түр хаасан"),
                ],
                db_index=True,
                default="active",
                max_length=24,
                verbose_name="Хяналтын төлөв",
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="listing",
            name="review_notes",
            field=models.TextField(blank=True, verbose_name="Админы тайлбар"),
        ),
        migrations.AddField(
            model_name="listing",
            name="reviewed_at",
            field=models.DateTimeField(
                blank=True, null=True, verbose_name="Хянасан огноо"
            ),
        ),
        migrations.AddField(
            model_name="listing",
            name="reviewed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="reviewed_listings",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Хянасан ажилтан",
            ),
        ),
        migrations.AlterField(
            model_name="listing",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending_review", "Хяналт хүлээж байна"),
                    ("active", "Нийтлэгдсэн"),
                    ("changes_requested", "Засвар шаардлагатай"),
                    ("rejected", "Татгалзсан"),
                    ("suspended", "Түр хаасан"),
                ],
                db_index=True,
                default="pending_review",
                max_length=24,
                verbose_name="Хяналтын төлөв",
            ),
        ),
        migrations.AlterField(
            model_name="notification",
            name="type",
            field=models.CharField(
                choices=[
                    ("booking_created", "Шинэ захиалга (түрээслүүлэгч)"),
                    ("booking_confirmed", "Захиалга баталгаажсан (зочин)"),
                    ("admin_booking", "Шинэ захиалга (ажилтан)"),
                    ("booking_cancelled", "Захиалга цуцлагдсан"),
                    ("host_application", "Шинэ түрээслүүлэгч хүсэлт"),
                    ("host_approved", "Түрээслүүлэгчийн эрх батлагдсан"),
                    ("host_rejected", "Түрээслүүлэгчийн хүсэлтээс татгалзсан"),
                    ("review", "Сэтгэгдэл"),
                    ("listing_published", "Зар нийтлэгдсэн"),
                    ("listing_review", "Зарын хяналтын төлөв"),
                    ("admin_listing_review", "Шалгах шинэ зар"),
                    ("payment", "Төлбөр"),
                    ("admin_support", "Шинэ тусламжийн хүсэлт (ажилтан)"),
                    ("support_reply", "Тусламжийн хүсэлтийн хариу"),
                    ("admin_user", "Шинэ хэрэглэгч (ажилтан)"),
                    ("booking", "Захиалга"),
                    ("comment", "Сэтгэгдэл"),
                    ("rating", "Үнэлгээ"),
                ],
                default="booking",
                max_length=20,
            ),
        ),
    ]
