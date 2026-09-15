from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0036_hostapplication_terms_acceptance"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="type",
            field=models.CharField(
                choices=[
                    ("booking_created", "Шинэ захиалга (хост)"),
                    ("booking_confirmed", "Захиалга баталгаажсан (зочин)"),
                    ("admin_booking", "Шинэ захиалга (админ)"),
                    ("booking_cancelled", "Захиалга цуцлагдсан"),
                    ("host_application", "Шинэ түрээслүүлэгч хүсэлт"),
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
                max_length=20,
            ),
        ),
    ]
