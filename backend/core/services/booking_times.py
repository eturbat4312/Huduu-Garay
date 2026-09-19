from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone


PLATFORM_TIME_ZONE = ZoneInfo("Asia/Ulaanbaatar")
CHECK_IN_TIME = time(hour=14)
CHECK_OUT_TIME = time(hour=12)
PAYOUT_DELAY = timedelta(hours=72)


def local_now(now=None):
    return timezone.localtime(now or timezone.now(), PLATFORM_TIME_ZONE)


def check_in_at(check_in_date):
    return timezone.make_aware(
        datetime.combine(check_in_date, CHECK_IN_TIME),
        timezone=PLATFORM_TIME_ZONE,
    )


def check_out_at(check_out_date):
    return timezone.make_aware(
        datetime.combine(check_out_date, CHECK_OUT_TIME),
        timezone=PLATFORM_TIME_ZONE,
    )


def payout_eligible_at(check_out_date):
    return check_out_at(check_out_date) + PAYOUT_DELAY


def stay_has_ended(booking, now=None):
    return (now or timezone.now()) >= check_out_at(booking.check_out)


def stay_has_started(booking, now=None):
    return (now or timezone.now()) >= check_in_at(booking.check_in)
