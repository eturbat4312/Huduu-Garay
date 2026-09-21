from decimal import Decimal, ROUND_HALF_UP
import uuid

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower, Trim
from django.conf import settings
from django.contrib.auth import get_user_model

# from .utils.notifications import send_notification_email
from core.utils.email_notifications import send_notification_email


# -------------------- USER --------------------


class CustomUser(AbstractUser):
    is_host = models.BooleanField(default=False)
    is_guest = models.BooleanField(default=True)

    HOST_APPLICATION_CHOICES = [
        ("none", "Бүртгүүлээгүй"),
        ("pending", "Хүлээгдэж байна"),
        ("approved", "Зөвшөөрсөн"),
        ("rejected", "Татгалзсан"),
    ]
    host_application_status = models.CharField(
        max_length=20, choices=HOST_APPLICATION_CHOICES, default="none"
    )

    # 👇 Эдгээр нь бүх хэрэглэгчид хамаарах профайл мэдээлэл
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    full_name = models.CharField(max_length=255, blank=True, null=True)

    class Meta(AbstractUser.Meta):
        constraints = [
            models.UniqueConstraint(
                Lower(Trim("email")),
                condition=~models.Q(email=""),
                name="unique_user_email_case_insensitive",
            ),
        ]
        verbose_name = "Хэрэглэгч"
        verbose_name_plural = "Хэрэглэгчид"

    def __str__(self):
        return self.username


# -------------------- CATEGORY --------------------


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    icon = models.CharField(max_length=100, blank=True, null=True)
    image = models.ImageField(upload_to="category_images/", blank=True, null=True)

    class Meta:
        verbose_name = "Ангилал"
        verbose_name_plural = "Ангиллууд"

    def __str__(self):
        return self.name


# -------------------- AMENITY --------------------


class Amenity(models.Model):
    TYPE_AMENITY = "amenity"
    TYPE_ACTIVITY = "activity"
    TYPE_CHOICES = [
        (TYPE_AMENITY, "Тохижилт, үйлчилгээ"),
        (TYPE_ACTIVITY, "Үйл ажиллагаа"),
    ]

    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=50, blank=True, null=True)
    translation_key = models.CharField(max_length=100, blank=True)
    amenity_type = models.CharField(
        "Төрөл",
        max_length=20,
        choices=TYPE_CHOICES,
        default=TYPE_AMENITY,
        db_index=True,
    )
    is_common = models.BooleanField("Бүх ангилалд нийтлэг", default=False, db_index=True)
    categories = models.ManyToManyField(
        Category,
        blank=True,
        related_name="amenity_options",
        verbose_name="Хамаарах ангилал",
    )
    is_active = models.BooleanField("Идэвхтэй", default=True, db_index=True)
    sort_order = models.PositiveIntegerField("Эрэмбэ", default=0)

    class Meta:
        ordering = ["-amenity_type", "sort_order", "name"]
        verbose_name = "Тохижилт, үйл ажиллагаа"
        verbose_name_plural = "Тохижилт, үйл ажиллагаанууд"

    def __str__(self):
        return self.name


# -------------------- LISTING --------------------


class Listing(models.Model):
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="listings"
    )
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True)
    title = models.CharField(max_length=200)
    description = models.TextField()

    price_per_night = models.DecimalField(max_digits=10, decimal_places=2)
    max_guests = models.PositiveIntegerField(default=1)
    beds = models.PositiveIntegerField(default=1)

    amenities = models.ManyToManyField(Amenity, blank=True)

    location_city = models.CharField(max_length=100, default="")           # Хот/Аймаг — public
    location_district = models.CharField(max_length=100, default="")       # Дүүрэг/Сум — public
    location_khoroo = models.CharField(max_length=100, blank=True, default="")  # Хороо/Баг — public
    location_extra = models.CharField(max_length=200, blank=True, default="")   # Хороолол/Нэмэлт — public
    location_building = models.CharField(max_length=100, blank=True, default="")  # Байр/барилга — private
    location_apartment = models.CharField(max_length=50, blank=True, default="")  # Тоот — private
    location_lat = models.FloatField(blank=True, null=True)
    location_lng = models.FloatField(blank=True, null=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Зар"
        verbose_name_plural = "Зарууд"

    def __str__(self):
        return f"{self.title} ({self.host.username})"


# -------------------- LISTING IMAGE --------------------


class ListingImage(models.Model):
    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="images"
    )
    image = models.ImageField(upload_to="listing_images/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Зарын зураг"
        verbose_name_plural = "Зарын зургууд"

    def __str__(self):
        return f"{self.listing.title} зарын зураг"


# -------------------- FAVORITE --------------------


class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites"
    )
    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="favorited_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "listing")
        verbose_name = "Хадгалсан зар"
        verbose_name_plural = "Хадгалсан зарууд"

    def __str__(self):
        return f"{self.user.username} ❤️ {self.listing.title}"


# -------------------- AVAILABILITY --------------------


class Availability(models.Model):
    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="availabilities"
    )
    date = models.DateField()

    class Meta:
        verbose_name = "Боломжит огноо"
        verbose_name_plural = "Боломжит огноонууд"
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "date"],
                name="unique_availability_listing_date",
            )
        ]

    def __str__(self):
        return f"{self.listing.title} - {self.date}"


# -------------------- BOOKING --------------------


class Booking(models.Model):

    STATUS_CHOICES = [
        ("pending_payment", "Төлбөр хүлээж байна"),
        ("confirmed", "Баталгаажсан"),
        ("cancelled", "Цуцлагдсан"),
        ("expired", "Хугацаа дууссан"),
        ("payment_failed", "Төлбөр амжилтгүй"),
    ]
    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="bookings"
    )
    guest = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings"
    )
    check_in = models.DateField()
    check_out = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    full_name = models.CharField(max_length=100, default="Guest")
    phone_number = models.CharField(max_length=20, default="00000000")
    notes = models.TextField(default="", blank=True)
    is_cancelled_by_host = models.BooleanField(default=False)
    host_cancelled_at = models.DateTimeField(
        "Түрээслүүлэгч цуцалсан огноо", null=True, blank=True, db_index=True
    )
    host_cancellation_reason = models.TextField(
        "Түрээслүүлэгчийн цуцлах шалтгаан", blank=True
    )
    host_cancellation_policy_version = models.CharField(
        "Түрээслүүлэгч цуцлахдаа зөвшөөрсөн нөхцөлийн хувилбар",
        max_length=20,
        blank=True,
    )
    guest_cancelled_at = models.DateTimeField(
        "Зочин цуцалсан огноо", null=True, blank=True, db_index=True
    )
    guest_cancellation_reason = models.TextField("Зочны цуцлах шалтгаан", blank=True)
    guest_cancellation_policy_version = models.CharField(
        "Цуцлахдаа зөвшөөрсөн нөхцөлийн хувилбар", max_length=20, blank=True
    )
    guest_count = models.PositiveIntegerField(default=1)
    total_price = models.PositiveIntegerField(default=0)
    service_fee = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="confirmed", db_index=True
    )
    payment_intent_key = models.CharField(
        max_length=120, blank=True, null=True, db_index=True
    )
    hold_expires_at = models.DateTimeField(blank=True, null=True, db_index=True)

    class Meta:
        verbose_name = "Захиалга"
        verbose_name_plural = "Захиалгууд"
        constraints = [
            models.UniqueConstraint(
                fields=["guest", "payment_intent_key"],
                name="unique_booking_guest_payment_intent_key",
            )
        ]

    def __str__(self):
        return (
            f"{self.listing.title} · зочин {self.guest.username} "
            f"({self.check_in} - {self.check_out})"
        )


class BookingHold(models.Model):
    booking = models.ForeignKey(
        Booking, on_delete=models.CASCADE, related_name="held_dates"
    )
    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="booking_holds"
    )
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Огнооны түр хадгалалт"
        verbose_name_plural = "Огнооны түр хадгалалтууд"
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "date"],
                name="unique_booking_hold_listing_date",
            )
        ]

    def __str__(self):
        return f"{self.listing.title} · захиалга #{self.booking_id} · {self.date}"


User = get_user_model()
HOST_TERMS_VERSION = "2026-09-19"


class Payment(models.Model):
    PROVIDER_QPAY = "qpay"
    QPAY_FEE_RATE = Decimal("1.00")
    PROVIDER_CHOICES = [
        (PROVIDER_QPAY, "QPay"),
    ]

    STATUS_PENDING = "pending"
    STATUS_PAID = "paid"
    STATUS_FAILED = "failed"
    STATUS_CANCELLED = "cancelled"
    STATUS_EXPIRED = "expired"
    STATUS_REFUNDED = "refunded"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Хүлээгдэж байна"),
        (STATUS_PAID, "Төлөгдсөн"),
        (STATUS_FAILED, "Амжилтгүй"),
        (STATUS_CANCELLED, "Цуцлагдсан"),
        (STATUS_EXPIRED, "Хугацаа дууссан"),
        (STATUS_REFUNDED, "Буцаагдсан"),
    ]

    booking = models.ForeignKey(
        Booking, on_delete=models.CASCADE, related_name="payments"
    )
    provider = models.CharField(
        max_length=30, choices=PROVIDER_CHOICES, default=PROVIDER_QPAY
    )
    invoice_id = models.CharField(max_length=120, blank=True, db_index=True)
    sender_invoice_no = models.CharField(max_length=120, unique=True)
    idempotency_key = models.CharField(
        max_length=120, blank=True, null=True, db_index=True
    )
    amount = models.PositiveIntegerField()
    currency = models.CharField(max_length=3, default="MNT")
    provider_fee_rate = models.DecimalField(
        "QPay шимтгэлийн хувь",
        max_digits=5,
        decimal_places=2,
        default=QPAY_FEE_RATE,
    )
    provider_fee_amount = models.PositiveBigIntegerField(
        "QPay шимтгэлийн дүн",
        default=0,
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True
    )
    raw_response = models.JSONField(default=dict, blank=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Төлбөрийн гүйлгээ"
        verbose_name_plural = "Төлбөрийн гүйлгээнүүд"
        constraints = [
            models.UniqueConstraint(
                fields=["booking", "idempotency_key"],
                name="unique_payment_booking_idempotency_key",
            ),
            models.CheckConstraint(
                condition=models.Q(provider_fee_rate__gte=0),
                name="payment_provider_fee_rate_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(provider_fee_amount__lte=models.F("amount")),
                name="payment_provider_fee_not_above_amount",
            ),
        ]
        indexes = [
            models.Index(fields=["provider", "invoice_id"]),
            models.Index(fields=["booking", "status"]),
        ]

    def __str__(self):
        return f"{self.provider} {self.sender_invoice_no} ({self.status})"

    @property
    def net_received_amount(self):
        return max(int(self.amount) - int(self.provider_fee_amount), 0)

    def calculate_provider_fee(self):
        if self.provider != self.PROVIDER_QPAY:
            return 0
        return int(
            (
                Decimal(self.amount)
                * Decimal(self.provider_fee_rate)
                / Decimal("100")
            ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )

    def save(self, *args, **kwargs):
        if (
            self.status in {self.STATUS_PAID, self.STATUS_REFUNDED}
            and not self.provider_fee_amount
        ):
            self.provider_fee_amount = self.calculate_provider_fee()
            if kwargs.get("update_fields") is not None:
                kwargs["update_fields"] = set(kwargs["update_fields"]) | {
                    "provider_fee_amount"
                }
        super().save(*args, **kwargs)


class HostPayout(models.Model):
    STATUS_PENDING = "pending"
    STATUS_REVIEW = "review"
    STATUS_HOLD = "hold"
    STATUS_PAID = "paid"
    STATUS_NOT_PAYABLE = "not_payable"
    STATUS_CHOICES = [
        (STATUS_PENDING, "72 цаг хүлээж байна"),
        (STATUS_REVIEW, "Шалгах шаардлагатай"),
        (STATUS_HOLD, "Саатуулсан"),
        (STATUS_PAID, "Шилжүүлсэн"),
        (STATUS_NOT_PAYABLE, "Олгохгүй"),
    ]

    booking = models.OneToOneField(
        Booking,
        on_delete=models.PROTECT,
        related_name="host_payout",
        verbose_name="Захиалга",
    )
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="host_payouts",
        verbose_name="Түрээслүүлэгч",
    )
    status = models.CharField(
        "Төлөв", max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True
    )
    gross_amount = models.PositiveBigIntegerField("Байрны үндсэн дүн")
    commission_rate = models.DecimalField(
        "Шимтгэлийн хувь", max_digits=5, decimal_places=2, default=10.00
    )
    commission_amount = models.PositiveBigIntegerField("Платформын шимтгэл")
    adjustment_amount = models.BigIntegerField("Тохируулгын дүн", default=0)
    net_amount = models.PositiveBigIntegerField("Шилжүүлэх цэвэр дүн")
    eligible_at = models.DateTimeField("Шилжүүлэх эрх нээгдэх цаг", db_index=True)
    bank_name = models.CharField("Банк", max_length=100, blank=True)
    account_number = models.CharField("Дансны дугаар", max_length=30, blank=True)
    account_holder_name = models.CharField("Данс эзэмшигч", max_length=255, blank=True)
    hold_reason = models.TextField("Саатуулсан шалтгаан", blank=True)
    notes = models.TextField("Дотоод тэмдэглэл", blank=True)
    paid_at = models.DateTimeField("Шилжүүлсэн огноо", null=True, blank=True, db_index=True)
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="completed_host_payouts",
        verbose_name="Шилжүүлсэн ажилтан",
    )
    transfer_reference = models.CharField("Гүйлгээний дугаар", max_length=160, blank=True)
    transfer_proof = models.FileField(
        "Шилжүүлгийн баримт", upload_to="financial_proofs/host_payouts/", blank=True
    )
    legacy_review_required = models.BooleanField(
        "Хуучин бүртгэлийг шалгах", default=False, db_index=True
    )
    created_at = models.DateTimeField("Үүссэн огноо", auto_now_add=True)
    updated_at = models.DateTimeField("Шинэчилсэн огноо", auto_now=True)

    class Meta:
        ordering = ["eligible_at", "id"]
        verbose_name = "Түрээслүүлэгчийн төлбөр"
        verbose_name_plural = "Түрээслүүлэгчийн төлбөрүүд"
        indexes = [
            models.Index(fields=["status", "eligible_at"]),
            models.Index(fields=["host", "status"]),
        ]

    def __str__(self):
        return f"Захиалга #{self.booking_id} - ₮{self.net_amount:,}"

    def recalculate(self):
        self.net_amount = max(
            int(self.gross_amount) - int(self.commission_amount) + int(self.adjustment_amount),
            0,
        )

    def clean(self):
        super().clean()
        expected_net = max(
            int(self.gross_amount) - int(self.commission_amount) + int(self.adjustment_amount),
            0,
        )
        if self.status != self.STATUS_NOT_PAYABLE and self.net_amount != expected_net:
            raise ValidationError({"net_amount": "Цэвэр дүн тооцоолсон дүнтэй таарахгүй байна."})
        if self.status == self.STATUS_HOLD and not self.hold_reason.strip():
            raise ValidationError({"hold_reason": "Саатуулсан шалтгааныг заавал бичнэ үү."})
        if self.status == self.STATUS_PAID:
            if self.net_amount <= 0:
                raise ValidationError({"status": "Тэг дүнтэй төлбөрийг шилжүүлсэн гэж тэмдэглэхгүй."})
            if not self.transfer_reference.strip():
                raise ValidationError({"transfer_reference": "Гүйлгээний дугаарыг заавал оруулна уу."})


class GuestRefund(models.Model):
    METHOD_QPAY = "qpay"
    METHOD_BANK = "bank"
    METHOD_OTHER = "other"
    METHOD_CHOICES = [
        (METHOD_QPAY, "Анхны QPay төлбөрөөр"),
        (METHOD_BANK, "Банкны шилжүүлгээр"),
        (METHOD_OTHER, "Бусад аргаар"),
    ]

    REASON_GUEST_CANCELLED = "guest_cancelled"
    REASON_HOST_CANCELLED = "host_cancelled"
    REASON_ADMIN = "admin"
    REASON_CHOICES = [
        (REASON_GUEST_CANCELLED, "Зочин цуцалсан"),
        (REASON_HOST_CANCELLED, "Түрээслүүлэгч цуцалсан"),
        (REASON_ADMIN, "Админы шийдвэр"),
    ]

    STATUS_REVIEW = "review"
    STATUS_APPROVED = "approved"
    STATUS_PAID = "paid"
    STATUS_NOT_REQUIRED = "not_required"
    STATUS_CHOICES = [
        (STATUS_REVIEW, "Шалгах шаардлагатай"),
        (STATUS_APPROVED, "Шилжүүлэхээр баталсан"),
        (STATUS_PAID, "Буцаан шилжүүлсэн"),
        (STATUS_NOT_REQUIRED, "Буцаахгүй"),
    ]

    booking = models.OneToOneField(
        Booking,
        on_delete=models.PROTECT,
        related_name="guest_refund",
        verbose_name="Захиалга",
    )
    guest = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="guest_refunds",
        verbose_name="Зочин",
    )
    reason = models.CharField("Шалтгаан", max_length=30, choices=REASON_CHOICES)
    status = models.CharField(
        "Төлөв", max_length=20, choices=STATUS_CHOICES, default=STATUS_REVIEW, db_index=True
    )
    received_amount = models.PositiveBigIntegerField("Зочиноос хүлээн авсан дүн")
    suggested_amount = models.PositiveBigIntegerField("Санал болгосон буцаалтын дүн", default=0)
    approved_amount = models.PositiveBigIntegerField("Баталсан буцаалтын дүн", default=0)
    decision_notes = models.TextField("Шийдвэрийн тайлбар", blank=True)
    refund_method = models.CharField(
        "Буцаах арга", max_length=20, choices=METHOD_CHOICES, default=METHOD_QPAY
    )
    recipient_name = models.CharField("Хүлээн авагчийн нэр", max_length=255, blank=True)
    bank_name = models.CharField("Хүлээн авагчийн банк", max_length=100, blank=True)
    account_number = models.CharField("Хүлээн авагчийн данс", max_length=30, blank=True)
    approved_at = models.DateTimeField("Баталсан огноо", null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="approved_guest_refunds",
        verbose_name="Баталсан ажилтан",
    )
    refunded_at = models.DateTimeField("Буцаан шилжүүлсэн огноо", null=True, blank=True, db_index=True)
    refunded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="completed_guest_refunds",
        verbose_name="Буцаасан ажилтан",
    )
    transfer_reference = models.CharField("Гүйлгээний дугаар", max_length=160, blank=True)
    transfer_proof = models.FileField(
        "Шилжүүлгийн баримт", upload_to="financial_proofs/guest_refunds/", blank=True
    )
    legacy_review_required = models.BooleanField(
        "Хуучин бүртгэлийг шалгах", default=False, db_index=True
    )
    created_at = models.DateTimeField("Үүссэн огноо", auto_now_add=True)
    updated_at = models.DateTimeField("Шинэчилсэн огноо", auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Зочны буцаалт"
        verbose_name_plural = "Зочны буцаалтууд"
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self):
        return f"Захиалга #{self.booking_id} - ₮{self.approved_amount:,}"

    def clean(self):
        super().clean()
        if self.approved_amount > self.received_amount:
            raise ValidationError(
                {"approved_amount": "Буцаах дүн хүлээн авсан дүнгээс их байж болохгүй."}
            )
        if self.status in {self.STATUS_APPROVED, self.STATUS_PAID} and self.approved_amount <= 0:
            raise ValidationError({"approved_amount": "Баталсан буцаалтын дүнг оруулна уу."})
        if self.status == self.STATUS_PAID and not self.transfer_reference.strip():
            raise ValidationError({"transfer_reference": "Гүйлгээний дугаарыг заавал оруулна уу."})
        if self.status == self.STATUS_PAID and self.refund_method == self.METHOD_BANK:
            missing = []
            if not self.recipient_name.strip():
                missing.append("хүлээн авагчийн нэр")
            if not self.bank_name.strip():
                missing.append("банк")
            if not self.account_number.strip():
                missing.append("дансны дугаар")
            if missing:
                raise ValidationError(
                    {"refund_method": f"Банкны буцаалтад {', '.join(missing)} шаардлагатай."}
                )


class FinancialAuditLog(models.Model):
    booking = models.ForeignKey(
        Booking,
        on_delete=models.PROTECT,
        related_name="financial_audit_logs",
        verbose_name="Захиалга",
    )
    host_payout = models.ForeignKey(
        HostPayout,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="audit_logs",
        verbose_name="Түрээслүүлэгчийн төлбөр",
    )
    guest_refund = models.ForeignKey(
        GuestRefund,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="audit_logs",
        verbose_name="Зочны буцаалт",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="financial_audit_actions",
        verbose_name="Үйлдэл хийсэн ажилтан",
    )
    event = models.CharField("Үйлдэл", max_length=80)
    previous_status = models.CharField("Өмнөх төлөв", max_length=30, blank=True)
    new_status = models.CharField("Шинэ төлөв", max_length=30, blank=True)
    amount = models.BigIntegerField("Дүн", default=0)
    message = models.TextField("Тайлбар", blank=True)
    metadata = models.JSONField("Нэмэлт мэдээлэл", default=dict, blank=True)
    created_at = models.DateTimeField("Үүссэн огноо", auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "Санхүүгийн хяналтын түүх"
        verbose_name_plural = "Санхүүгийн хяналтын түүх"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(host_payout__isnull=False, guest_refund__isnull=True)
                    | models.Q(host_payout__isnull=True, guest_refund__isnull=False)
                ),
                name="financial_audit_exactly_one_target",
            )
        ]

    def __str__(self):
        return f"Захиалга #{self.booking_id}: {self.event}"


class SupportRequest(models.Model):
    CATEGORY_CHOICES = [
        ("booking", "Захиалга"),
        ("payment", "Төлбөр, буцаалт"),
        ("listing", "Зар, түрээслүүлэлт"),
        ("account", "Бүртгэл"),
        ("other", "Бусад"),
    ]
    STATUS_CHOICES = [
        ("new", "Хүлээн авсан"),
        ("in_progress", "Шалгаж байна"),
        ("answered", "Хариулсан"),
        ("closed", "Хаасан"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="support_requests",
        verbose_name="Хэрэглэгч",
    )
    category = models.CharField(
        "Төрөл", max_length=20, choices=CATEGORY_CHOICES, default="other"
    )
    subject = models.CharField("Гарчиг", max_length=160)
    message = models.TextField("Зурвас")
    status = models.CharField(
        "Төлөв", max_length=20, choices=STATUS_CHOICES, default="new", db_index=True
    )
    admin_reply = models.TextField("Админы хариу", blank=True)
    responded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="answered_support_requests",
        verbose_name="Хариулсан ажилтан",
    )
    responded_at = models.DateTimeField("Хариулсан огноо", null=True, blank=True)
    created_at = models.DateTimeField("Илгээсэн огноо", auto_now_add=True)
    updated_at = models.DateTimeField("Шинэчилсэн огноо", auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Тусламжийн хүсэлт"
        verbose_name_plural = "Тусламжийн хүсэлтүүд"

    def __str__(self):
        return f"#{self.pk} {self.subject} ({self.user.username})"


class PlatformAnalyticsEvent(models.Model):
    EVENT_WEB_PAGE_VIEW = "web_page_view"
    EVENT_APP_INSTALL = "app_install"
    EVENT_APP_OPEN = "app_open"
    EVENT_CHOICES = [
        (EVENT_WEB_PAGE_VIEW, "Вэб хуудас үзсэн"),
        (EVENT_APP_INSTALL, "Апп анх нээсэн"),
        (EVENT_APP_OPEN, "Апп нээсэн"),
    ]

    PLATFORM_WEB = "web"
    PLATFORM_IOS = "ios"
    PLATFORM_ANDROID = "android"
    PLATFORM_CHOICES = [
        (PLATFORM_WEB, "Вэб"),
        (PLATFORM_IOS, "iOS"),
        (PLATFORM_ANDROID, "Android"),
    ]

    event_id = models.UUIDField("Үйл явдлын дугаар", default=uuid.uuid4, unique=True)
    event_type = models.CharField(
        "Үйл явдлын төрөл", max_length=30, choices=EVENT_CHOICES, db_index=True
    )
    visitor_hash = models.CharField("Нууцалсан зочлогч", max_length=64, db_index=True)
    session_hash = models.CharField("Нууцалсан хандалт", max_length=64, blank=True)
    path = models.CharField("Хуудасны зам", max_length=300, blank=True)
    platform = models.CharField(
        "Орчин", max_length=20, choices=PLATFORM_CHOICES, db_index=True
    )
    app_version = models.CharField("Аппын хувилбар", max_length=40, blank=True)
    created_at = models.DateTimeField("Бүртгэсэн огноо", auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Хандалтын бүртгэл"
        verbose_name_plural = "Хандалтын бүртгэлүүд"
        constraints = [
            models.UniqueConstraint(
                fields=["event_type", "visitor_hash"],
                condition=models.Q(event_type="app_install"),
                name="unique_app_install_per_device",
            )
        ]
        indexes = [
            models.Index(fields=["event_type", "created_at"]),
            models.Index(fields=["platform", "created_at"]),
        ]

    def __str__(self):
        return f"{self.get_event_type_display()} · {self.get_platform_display()}"


class Notification(models.Model):
    NOTIFICATION_TYPES = [
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
        # legacy aliases
        ("booking", "Захиалга"),
        ("comment", "Сэтгэгдэл"),
        ("rating", "Үнэлгээ"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="notifications"
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    type = models.CharField(
        max_length=20, choices=NOTIFICATION_TYPES, default="booking"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    related_booking = models.ForeignKey(  # ✅ энэ хэсгийг нэм
        "Booking",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    related_listing = models.ForeignKey(
        "Listing",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    related_support_request = models.ForeignKey(
        "SupportRequest",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications",
    )

    class Meta:
        verbose_name = "Мэдэгдэл"
        verbose_name_plural = "Мэдэгдлүүд"

    def __str__(self):
        return f"[{self.get_type_display()}] {self.user.username}: {self.message[:30]}"


class Review(models.Model):
    listing = models.ForeignKey(
        "Listing", on_delete=models.CASCADE, related_name="reviews"
    )
    booking = models.ForeignKey(
        "Booking", on_delete=models.CASCADE, related_name="review"
    )
    guest = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField()  # 1 to 5
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (
            "listing",
            "booking",
            "guest",
        )  # нэг booking дээр нэг review л зөвшөөрнө
        verbose_name = "Үнэлгээ, сэтгэгдэл"
        verbose_name_plural = "Үнэлгээ, сэтгэгдлүүд"

    def __str__(self):
        return f"{self.listing.title} - {self.rating} од · {self.guest.username}"

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.rating < 1 or self.rating > 5:
            raise ValidationError("Үнэлгээ 1-5 хооронд байна.")


class HostApplication(models.Model):
    STATUS_CHOICES = [
        ("pending", "Хүлээгдэж байна"),
        ("approved", "Зөвшөөрсөн"),
        ("rejected", "Татгалзсан"),
    ]

    BANK_CHOICES = [
        ("Хаан Банк", "Хаан Банк"),
        ("Голомт Банк", "Голомт Банк"),
        ("ХХБанк", "Худалдаа Хөгжлийн Банк"),
        ("Төрийн Банк", "Төрийн Банк"),
        ("Капитрон", "Капитрон"),
        ("ХАС Банк", "ХАС Банк"),
        ("Чингис Хаан Банк", "Чингис Хаан Банк"),
    ]

    bank_name = models.CharField(max_length=100, choices=BANK_CHOICES)
    account_number = models.CharField(max_length=30)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20)
    id_card_image = models.ImageField(upload_to="id_cards/")
    selfie_with_id = models.ImageField(upload_to="selfies/")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    submitted_at = models.DateTimeField(auto_now_add=True)
    host_terms_accepted_at = models.DateTimeField(null=True, blank=True)
    host_terms_version = models.CharField(max_length=20, default=HOST_TERMS_VERSION)
    host_commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=10.00
    )
    host_terms_accepted_ip = models.GenericIPAddressField(null=True, blank=True)
    host_terms_accepted_user_agent = models.TextField(blank=True)

    class Meta:
        verbose_name = "Түрээслүүлэгч болох хүсэлт"
        verbose_name_plural = "Түрээслүүлэгч болох хүсэлтүүд"

    def __str__(self):
        return f"{self.user.username} хэрэглэгчийн түрээслүүлэгч болох хүсэлт"

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        old_status = None

        if not is_new:
            old = HostApplication.objects.get(pk=self.pk)
            old_status = old.status

        # 🔄 CustomUser model-ийн талбарыг шинэчилж байна
        self.user.host_application_status = self.status
        self.user.is_host = self.status == "approved"
        self.user.save()

        super().save(*args, **kwargs)

        # 📬 Имэйл + Notification үүсгэх логик
        if is_new:
            send_notification_email(
                self.user,
                notif_type="host_application_created",
                context={"full_name": self.full_name},
            )
            admin_users = get_user_model().objects.filter(is_staff=True, is_active=True)
            admin_message = (
                f"Шинэ түрээслүүлэгч болох хүсэлт ирлээ. "
                f"Хүсэлт #{self.id}. Нэр: {self.full_name}. "
                f"Хэрэглэгч: {self.user.username}. Утас: {self.phone_number}. "
                f"Банк: {self.bank_name}. Данс: {self.account_number}. "
                f"Нөхцөлийн хувилбар: {self.host_terms_version}. "
                f"Шимтгэл: {self.host_commission_rate}%."
            )
            admin_context = {
                "application_id": self.id,
                "full_name": self.full_name,
                "username": self.user.username,
                "email": self.user.email,
                "phone_number": self.phone_number,
                "bank_name": self.bank_name,
                "account_number": self.account_number,
                "submitted_at": self.submitted_at.strftime("%Y-%m-%d %H:%M"),
                "host_terms_version": self.host_terms_version,
                "host_commission_rate": self.host_commission_rate,
            }
            for admin_user in admin_users:
                Notification.objects.create(
                    user=admin_user,
                    message=admin_message,
                    type="host_application",
                )
                if admin_user.email:
                    send_notification_email(
                        admin_user,
                        notif_type="admin_host_application_created",
                        context=admin_context,
                    )
        elif old_status != self.status:
            if self.status == "approved":
                send_notification_email(
                    self.user,
                    notif_type="host_application_approved",
                    context={"full_name": self.full_name},
                )
                Notification.objects.create(
                    user=self.user,
                    message="🎉 Таны түрээслүүлэгч болох өргөдөл батлагдлаа! Та одоо зар нийтлэх боломжтой.",
                    type="host_approved",
                )
            elif self.status == "rejected":
                send_notification_email(
                    self.user,
                    notif_type="host_application_rejected",
                    context={"full_name": self.full_name},
                )
                Notification.objects.create(
                    user=self.user,
                    message="Таны түрээслүүлэгч болох өргөдөл татгалзагдлаа. Дэлгэрэнгүйг имэйлээс харна уу.",
                    type="host_rejected",
                )


class FacebookAccount(models.Model):
    """An app-scoped Facebook identity belongs to exactly one local account."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="facebook_account")
    facebook_id = models.CharField(max_length=128, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)


class FacebookAuthFlow(models.Model):
    """Short-lived OAuth handshake; never stores Facebook or application access tokens."""

    state_hash = models.CharField(max_length=64, primary_key=True)
    challenge = models.CharField(max_length=64)
    client = models.CharField(max_length=10)
    locale = models.CharField(max_length=2, default="mn")
    intent = models.CharField(max_length=10, default="login")
    status = models.CharField(max_length=16, default="started")
    exchange_hash = models.CharField(max_length=64, blank=True, db_index=True)
    pending_hash = models.CharField(max_length=64, blank=True, db_index=True)
    facebook_id = models.CharField(max_length=128, blank=True)
    email = models.EmailField(blank=True)
    email_code_hash = models.CharField(max_length=64, blank=True)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    email_attempts = models.PositiveSmallIntegerField(default=0)
    name = models.CharField(max_length=150, blank=True)
    error = models.CharField(max_length=32, blank=True)
    expires_at = models.DateTimeField(db_index=True)
