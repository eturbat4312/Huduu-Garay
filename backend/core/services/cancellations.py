from core.services.booking_times import stay_has_started


GUEST_CANCELLATION_POLICY_VERSION = "2026-09-19"
GUEST_CANCELLATION_POLICY = [
    "Байрлах өдрөөс 48 цаг ба түүнээс өмнө цуцалсан бол төлбөрөө бүрэн буцаан авах боломжтой.",
    "Байрлах хүртэл 48 цагаас бага хугацаа үлдсэн бол буцаах эсэх, буцаах дүнг Танайд Хоноё тухайн нөхцөл байдлыг хянан шийдвэрлэнэ.",
    "Буцаалтыг манай ажилтан хянаж, гараар шилжүүлнэ. Цуцлах үед мөнгө шууд буцаагдахгүй.",
    "Цуцалсан захиалгын огноо бусад зочинд нээгдэх бөгөөд цуцлалтыг буцаах боломжгүй.",
]

HOST_CANCELLATION_POLICY_VERSION = "2026-09-19"
HOST_CANCELLATION_POLICY = [
    "Түрээслүүлэгч захиалгыг цуцалсан тохиолдолд зочинд төлсөн нийт дүнгийн 100%-ийг буцаана.",
    "Тухайн захиалгаар түрээслүүлэгчид олгох төлбөр 0 байна.",
    "Буцаан олголтыг манай ажилтан хянаж, гараар шилжүүлнэ. Цуцлах үед мөнгө автоматаар буцаагдахгүй.",
    "Цуцалсан захиалгын огноо бусад зочинд нээгдэх бөгөөд цуцлалтыг буцаах боломжгүй.",
    "Олон удаа үндэслэлгүй цуцалбал зарыг түр нуух, эрэмбэ бууруулах, эсвэл түрээслүүлэгчийн эрхийг хязгаарлаж болно.",
]


def guest_cancellation_blocked_reason(booking, now=None):
    if booking.status != "confirmed" or booking.is_cancelled_by_host or booking.guest_cancelled_at:
        return "Зөвхөн баталгаажсан, цуцлагдаагүй захиалгыг цуцлах боломжтой."
    if stay_has_started(booking, now):
        return "Орох өдрийн 14:00 цаг өнгөрсөн захиалгын асуудлаар манай багтай холбоо барина уу."
    return ""


def host_cancellation_blocked_reason(booking, now=None):
    if booking.is_cancelled_by_host or booking.host_cancelled_at:
        return "Энэ захиалгыг түрээслүүлэгч аль хэдийн цуцалсан байна."
    if booking.guest_cancelled_at or booking.status == "cancelled":
        return "Энэ захиалга аль хэдийн цуцлагдсан байна."
    if booking.status != "confirmed":
        return "Зөвхөн баталгаажсан, цуцлагдаагүй захиалгыг цуцлах боломжтой."
    if stay_has_started(booking, now):
        return "Орох өдрийн 14:00 цаг өнгөрсөн захиалгын асуудлаар манай багтай холбоо барина уу."
    return ""
