from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0031_add_payment_api_idempotency"),
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
