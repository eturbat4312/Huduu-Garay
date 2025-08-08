from django.core.mail import send_mail
from django.conf import settings


def send_notification_email(user, notif_type, context):
    subject = ""
    message = ""

    if notif_type == "booking_created":
        subject = "📬 Танд шинэ захиалга ирлээ!"
        message = (
            f"{context['guest_name']} таны зар дээр захиалга хийсэн байна.\n\n"
            f"📍 Зар: {context['listing_title']}\n"
            f"👤 Нэр: {context['full_name']}\n"
            f"📱 Утас: {context['phone_number']}\n"
            f"📅 Огноо: {context['check_in']} → {context['check_out']}\n"
            f"👥 Зочны тоо: {context['guest_count']}"
        )
    elif notif_type == "booking_cancelled":
        subject = "❗ Захиалга цуцлагдлаа"
        message = (
            f"Сайн байна уу {context.get('full_name', 'Хэрэглэгч')}!\n\n"
            f"Таны захиалга цуцлагдсан байна.\n\n"
            f"📍 Зар: {context['listing_title']}\n"
            f"📅 Огноо: {context['check_in']} → {context['check_out']}\n"
            f"👥 Зочны тоо: {context['guest_count']}\n"
            f"📱 Утас: {context.get('phone_number', 'Тодорхойгүй')}\n\n"
            f"Хэрэв энэ цуцлалт таны үйлдэл биш бол манай багтай холбоо барина уу."
        )
    elif notif_type == "review":
        subject = "⭐ Шинэ сэтгэгдэл ирлээ"
        message = f"{context['guest_name']} таны '{context['listing_title']}' зар дээр сэтгэгдэл үлдээсэн байна."

    elif notif_type == "host_application_created":
        subject = "📝 Таны хост хүсэлт амжилттай илгээгдлээ"
        message = (
            f"Сайн байна уу {context['full_name']}!\n\n"
            f"Таны хост эрхийн хүсэлт амжилттай илгээгдлээ. Бид тун удахгүй хянаж хариу өгөх болно."
        )

    elif notif_type == "host_application_approved":
        subject = "✅ Таны хост эрх батлагдлаа!"
        message = (
            f"Баяр хүргэе {context['full_name']}!\n\n"
            f"Таны хост эрх амжилттай батлагдлаа. Та одоо шинэ зар оруулах боломжтой боллоо."
        )

    elif notif_type == "host_application_rejected":
        subject = "❌ Хост эрхийн хүсэлт татгалзагдлаа"
        message = (
            f"Сайн байна уу {context['full_name']}!\n\n"
            f"Таны хост эрхийн хүсэлт харамсалтайгаар татгалзагдлаа. "
            f"Дахин оролдох эсвэл дэлгэрэнгүй мэдээлэл авахыг хүсвэл бидэнтэй холбоо барина уу."
        )

    else:
        subject = "📢 Шинэ мэдэгдэл"
        message = context.get("message", "Системээс шинэ мэдэгдэл ирлээ.")

    # Илгээх
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,
    )
