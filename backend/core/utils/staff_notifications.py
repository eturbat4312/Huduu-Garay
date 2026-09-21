import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction

from core.utils.email_notifications import send_notification_email


logger = logging.getLogger(__name__)


def notify_staff_activity(
    *,
    notification_type,
    subject,
    message,
    related_booking=None,
    related_listing=None,
):
    """Create an in-app notification and email every active staff user."""
    from core.models import Notification

    staff_users = list(
        get_user_model().objects.filter(is_staff=True, is_active=True)
    )
    if not staff_users:
        return

    for staff_user in staff_users:
        Notification.objects.create(
            user=staff_user,
            type=notification_type,
            message=message,
            related_booking=related_booking,
            related_listing=related_listing,
        )

    if not getattr(settings, "STAFF_ACTIVITY_EMAILS_ENABLED", True):
        return

    recipient_ids = [user.pk for user in staff_users if user.email]
    if not recipient_ids:
        return

    def send_after_commit():
        recipients = get_user_model().objects.filter(
            pk__in=recipient_ids, is_staff=True, is_active=True
        ).exclude(email="")
        for recipient in recipients:
            try:
                sent = send_notification_email(
                    recipient,
                    "staff_activity",
                    {"subject": subject, "message": message},
                )
                if sent != 1:
                    logger.error(
                        "Staff activity email was not sent to user %s: %s",
                        recipient.pk,
                        subject,
                    )
            except Exception:
                logger.exception(
                    "Staff activity email failed for user %s: %s",
                    recipient.pk,
                    subject,
                )

    transaction.on_commit(send_after_commit)
