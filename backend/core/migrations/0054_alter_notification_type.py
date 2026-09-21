from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0053_facebook_login")]

    operations = [
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
