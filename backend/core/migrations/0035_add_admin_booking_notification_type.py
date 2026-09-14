from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0034_booking_hold_expires_at"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="type",
            field=models.CharField(
                max_length=20,
                choices=[
                    ("booking_created", "Шинэ захиалга (хост)"),
                    ("booking_confirmed", "Захиалга баталгаажсан (зочин)"),
                    ("admin_booking", "Шинэ захиалга (админ)"),
                    ("booking_cancelled", "Захиалга цуцлагдсан"),
                    ("host_approved", "Хост эрх батлагдсан"),
                    ("host_rejected", "Хост эрх татгалзагдсан"),
                    ("review", "Сэтгэгдэл"),
                    ("listing_published", "Зар нийтлэгдсэн"),
                    ("payment", "Төлбөр"),
                    ("booking", "Захиалга"),
                    ("comment", "Сэтгэгдэл"),
                    ("rating", "Үнэлгээ"),
                ],
                default="booking",
            ),
        ),
    ]
