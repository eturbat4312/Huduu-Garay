from django.core.mail import send_mail
from django.conf import settings


def send_notification_email(user, notif_type, context):
    subject = ""
    message = ""

    if notif_type == "booking_created":
        subject = f"📬 Шинэ захиалга #{context['booking_id']} ирлээ — {context['listing_title']}"
        message = (
            f"Сайн байна уу!\n\n"
            f"Таны '{context['listing_title']}' байранд шинэ захиалга ирлээ.\n\n"
            f"{'─' * 40}\n"
            f"🆔 Захиалгын дугаар: #{context['booking_id']}\n"
            f"📅 Огноо: {context['check_in']} → {context['check_out']}\n"
            f"🌙 Хоног: {context['total_nights']}\n"
            f"👥 Зочны тоо: {context['guest_count']}\n"
            f"{'─' * 40}\n"
            f"👤 Зочны нэр: {context['full_name']}\n"
            f"📱 Зочны утас: {context['phone_number']}\n"
            f"{'─' * 40}\n"
            f"💵 Нийт дүн: ₮{context['total_price']:,}\n"
            f"🧾 Платформын шимтгэл (10%): ₮{context['host_fee']:,}\n"
            f"💳 Таны авах мөнгө: ₮{context['host_payout']:,}\n"
            f"{'─' * 40}\n\n"
            f"Захиалгыг системд нэвтрэн харна уу."
        )
    elif notif_type == "guest_booking_cancelled":
        subject = f"Зочин захиалга #{context['booking_id']}-г цуцаллаа"
        message = (
            f"Зар: {context['listing_title']}\n"
            f"Огноо: {context['check_in']} - {context['check_out']}\n"
            f"Зочин: {context['full_name']}\n"
            f"Утас: {context['phone_number']}\n"
            f"Цуцалсан цаг: {context['cancelled_at']}\n"
            f"Шалтгаан: {context['reason']}\n"
            f"Нөхцөлийн хувилбар: {context['policy_version']}\n\n"
            "Захиалгын огноо дахин нээгдсэн. Төлбөрийн буцаалт болон түрээслүүлэгчид "
            "олгох дүнг ажилтан гараар хянан шийдвэрлэнэ. Мөнгө автоматаар шилжээгүй."
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
    # Claude: guest receives this when their booking is confirmed — full details + map link
    elif notif_type == "booking_confirmed":
        lat = context.get("location_lat")
        lng = context.get("location_lng")
        city = context.get("location_city", "")
        district = context.get("location_district", "")
        khoroo = context.get("location_khoroo", "")
        extra = context.get("location_extra", "")
        building = context.get("location_building", "")
        apartment = context.get("location_apartment", "")
        full_addr = ", ".join(filter(None, [city, district, khoroo, extra, building, apartment]))

        if lat and lng:
            maps_link = f"https://maps.google.com/?q={lat},{lng}"
        else:
            import urllib.parse
            maps_link = f"https://maps.google.com/?q={urllib.parse.quote(full_addr)}"

        subject = f"✅ Захиалга #{context['booking_id']} баталгаажлаа — {context['listing_title']}"
        message = (
            f"Сайн байна уу {context['full_name']}!\n\n"
            f"Таны захиалга амжилттай баталгаажлаа.\n\n"
            f"{'─' * 40}\n"
            f"🆔 Захиалгын дугаар: #{context['booking_id']}\n"
            f"🏠 Байр: {context['listing_title']}\n"
            f"📍 Хаяг: {full_addr}\n"
            f"🗺  Газрын зураг: {maps_link}\n"
            f"📅 Огноо: {context['check_in']} → {context['check_out']}\n"
            f"🌙 Хоног: {context['total_nights']}\n"
            f"👥 Зочны тоо: {context['guest_count']}\n"
            f"{'─' * 40}\n"
            f"🧑‍💼 Байрны эзэн: {context['host_name']}\n"
            f"📱 Эзний утас: {context['host_phone']}\n"
            f"{'─' * 40}\n"
            f"💵 Байрны үнэ: ₮{context['total_price']:,}\n"
            f"🧾 Үйлчилгээний шимтгэл (10%): ₮{context['guest_fee']:,}\n"
            f"💳 Нийт төлөх дүн: ₮{context['guest_total']:,}\n"
            f"{'─' * 40}\n\n"
            f"Системд нэвтрэн захиалгын дэлгэрэнгүйг харна уу.\n"
            f"Асуулт байвал эзэнтэй шууд холбоо барина уу."
        )

    elif notif_type == "admin_booking_confirmed":
        subject = f"Шинэ төлбөртэй захиалга #{context['booking_id']} баталгаажлаа"
        message = (
            f"Шинэ төлбөртэй захиалга баталгаажлаа.\n\n"
            f"{'─' * 40}\n"
            f"Захиалгын дугаар: #{context['booking_id']}\n"
            f"Payment ID: #{context['payment_id']}\n"
            f"Invoice: {context['invoice_id']}\n"
            f"Зар: {context['listing_title']} (#{context['listing_id']})\n"
            f"Огноо: {context['check_in']} → {context['check_out']}\n"
            f"Хоног: {context['total_nights']}\n"
            f"Зочны тоо: {context['guest_count']}\n"
            f"{'─' * 40}\n"
            f"Guest: {context['guest_full_name']} ({context['guest_username']})\n"
            f"Guest утас: {context['guest_phone']}\n"
            f"Host: {context['host_name']} ({context['host_username']})\n"
            f"Host утас: {context['host_phone']}\n"
            f"{'─' * 40}\n"
            f"Байршил: {context['location']}\n"
            f"Байрны үнэ: ₮{context['total_price']:,}\n"
            f"Service fee: ₮{context['service_fee']:,}\n"
            f"Нийт төлсөн: ₮{context['guest_total']:,}\n"
            f"Host авах: ₮{context['host_payout']:,}\n"
            f"{'─' * 40}\n\n"
            f"Admin dashboard дээр захиалгын дэлгэрэнгүйг шалгана уу."
        )

    elif notif_type == "review":
        subject = "⭐ Шинэ сэтгэгдэл ирлээ"
        message = f"{context['guest_name']} таны '{context['listing_title']}' зар дээр сэтгэгдэл үлдээсэн байна."

    elif notif_type == "host_application_created":
        subject = "📝 Таны түрээслүүлэгч болох хүсэлт амжилттай илгээгдлээ"
        message = (
            f"Сайн байна уу {context['full_name']}!\n\n"
            f"Таны түрээслүүлэгч болох хүсэлт амжилттай илгээгдлээ. Бид тун удахгүй хянаж хариу өгөх болно."
        )

    elif notif_type == "admin_host_application_created":
        subject = f"Шинэ түрээслүүлэгч болох хүсэлт #{context['application_id']} ирлээ"
        message = (
            f"Шинэ түрээслүүлэгч болох хүсэлт ирлээ.\n\n"
            f"{'─' * 40}\n"
            f"Хүсэлтийн дугаар: #{context['application_id']}\n"
            f"Нэр: {context['full_name']}\n"
            f"Хэрэглэгчийн нэр: {context['username']}\n"
            f"Цахим шуудан: {context.get('email') or 'Байхгүй'}\n"
            f"Утас: {context['phone_number']}\n"
            f"Банк: {context['bank_name']}\n"
            f"Данс: {context['account_number']}\n"
            f"Илгээсэн огноо: {context['submitted_at']}\n"
            f"Нөхцөлийн хувилбар: {context['host_terms_version']}\n"
            f"Зөвшөөрсөн шимтгэл: {context['host_commission_rate']}%\n"
            f"{'─' * 40}\n\n"
            f"Admin хэсэгт нэвтэрч хүсэлтийг шалгана уу."
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

    # Claude: password reset email
    elif notif_type == "password_reset":
        subject = "🔐 Нууц үг сэргээх хүсэлт"
        message = (
            f"Сайн байна уу {context['username']}!\n\n"
            f"Таны бүртгэлд нууц үг сэргээх хүсэлт ирлээ.\n\n"
            f"Доорх холбоосоор орж нууц үгээ шинэчлэнэ үү:\n"
            f"{context['reset_link']}\n\n"
            f"Энэ холбоос 24 цагийн дотор хүчинтэй байна.\n\n"
            f"Хэрэв та хүсэлт илгээгээгүй бол энэ имэйлийг үл тоомсорлоно уу."
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
