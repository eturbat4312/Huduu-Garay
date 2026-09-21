from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from core.models import Booking, Listing, Review
from core.utils.staff_notifications import notify_staff_activity


@receiver(post_save, sender=get_user_model())
def notify_staff_about_new_user(sender, instance, created, **kwargs):
    if not created:
        return
    notify_staff_activity(
        notification_type="admin_user",
        subject=f"Шинэ хэрэглэгч бүртгүүллээ: {instance.username}",
        message=(
            f"Шинэ хэрэглэгч #{instance.pk} бүртгүүллээ. "
            f"Хэрэглэгчийн нэр: {instance.username}. "
            f"Имэйл: {instance.email or 'Байхгүй'}."
        ),
    )


@receiver(post_save, sender=Listing)
def notify_staff_about_new_listing(sender, instance, created, **kwargs):
    if not created:
        return
    notify_staff_activity(
        notification_type="listing_published",
        subject=f"Шинэ зар нийтлэгдлээ: {instance.title}",
        message=(
            f"Шинэ зар #{instance.pk} нийтлэгдлээ. Зар: '{instance.title}'. "
            f"Түрээслүүлэгч: {instance.host.username} ({instance.host.email or 'имэйлгүй'}). "
            f"Байршил: {instance.location_city}, {instance.location_district}. "
            f"Нэг шөнийн үнэ: ₮{instance.price_per_night:,.0f}."
        ),
        related_listing=instance,
    )


@receiver(post_save, sender=Booking)
def notify_staff_about_new_booking(sender, instance, created, **kwargs):
    if not created:
        return
    is_pending = instance.status == "pending_payment"
    notify_staff_activity(
        notification_type="payment" if is_pending else "admin_booking",
        subject=(
            f"Шинэ захиалгын хүсэлт #{instance.pk} — төлбөр хүлээж байна"
            if is_pending
            else f"Шинэ захиалга #{instance.pk} үүслээ"
        ),
        message=(
            f"Захиалга #{instance.pk}. Зар: '{instance.listing.title}' #{instance.listing_id}. "
            f"Зочин: {instance.full_name} ({instance.guest.username}), "
            f"утас: {instance.phone_number}. Огноо: {instance.check_in} – {instance.check_out}. "
            f"Зочны тоо: {instance.guest_count}. Нийт төлөх: "
            f"₮{instance.total_price + instance.service_fee:,.0f}. "
            f"Төлөв: {instance.get_status_display()}."
        ),
        related_booking=instance,
    )


@receiver(post_save, sender=Review)
def notify_staff_about_new_review(sender, instance, created, **kwargs):
    if not created:
        return
    comment = instance.comment.strip() or "Сэтгэгдэлгүй"
    notify_staff_activity(
        notification_type="review",
        subject=f"Шинэ сэтгэгдэл: {instance.listing.title}",
        message=(
            f"{instance.guest.username} '{instance.listing.title}' зар дээр "
            f"{instance.rating}/5 үнэлгээ өглөө. Сэтгэгдэл: {comment}"
        ),
        related_listing=instance.listing,
    )
