from unittest.mock import patch

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient

from core.admin import SupportRequestAdmin
from core.models import Notification, SupportRequest


User = get_user_model()


class SupportRequestApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="support-user",
            email="user@example.com",
            password="pass1234!",
        )
        self.other_user = User.objects.create_user(
            username="other-user",
            email="other@example.com",
            password="pass1234!",
        )
        self.staff = User.objects.create_user(
            username="support-staff",
            email="staff@example.com",
            password="pass1234!",
            is_staff=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @patch("core.views.send_notification_email")
    def test_create_notifies_staff_and_keeps_admin_fields_read_only(self, send_email):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/support-requests/",
                {
                    "category": "payment",
                    "subject": "Буцаалтын явц",
                    "message": "Миний буцаалтын явцыг шалгаж өгнө үү.",
                    "status": "closed",
                    "admin_reply": "Хэрэглэгчийн оруулж болохгүй хариу",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        support_request = SupportRequest.objects.get()
        self.assertEqual(support_request.user, self.user)
        self.assertEqual(support_request.status, "new")
        self.assertEqual(support_request.admin_reply, "")
        notification = Notification.objects.get(
            user=self.staff, type="admin_support"
        )
        self.assertEqual(notification.related_support_request, support_request)
        send_email.assert_called_once()

    def test_list_only_returns_current_users_requests(self):
        own = SupportRequest.objects.create(
            user=self.user,
            category="booking",
            subject="Миний хүсэлт",
            message="Миний хүсэлтийн дэлгэрэнгүй мэдээлэл.",
        )
        SupportRequest.objects.create(
            user=self.other_user,
            category="account",
            subject="Өөр хэрэглэгчийн хүсэлт",
            message="Энэ хүсэлт харагдах ёсгүй.",
        )

        response = self.client.get("/api/support-requests/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [own.id])

    def test_short_message_is_rejected(self):
        response = self.client.post(
            "/api/support-requests/",
            {
                "category": "other",
                "subject": "Тусламж",
                "message": "Богино",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("message", response.data)

    def test_authentication_is_required(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/support-requests/")
        self.assertEqual(response.status_code, 401)


class SupportRequestAdminTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="request-owner",
            email="owner@example.com",
            password="pass1234!",
        )
        self.staff = User.objects.create_superuser(
            username="answering-admin",
            email="admin@example.com",
            password="pass1234!",
        )
        self.support_request = SupportRequest.objects.create(
            user=self.user,
            category="booking",
            subject="Захиалгын асуулт",
            message="Захиалгын талаар дэлгэрэнгүй асуулт байна.",
        )

    @patch("core.admin.send_notification_email")
    def test_admin_reply_updates_status_and_notifies_user(self, send_email):
        request = RequestFactory().post("/admin/core/supportrequest/")
        request.user = self.staff
        model_admin = SupportRequestAdmin(SupportRequest, admin.site)
        self.support_request.admin_reply = "Таны хүсэлтийг шалгаж шийдвэрлэлээ."

        with self.captureOnCommitCallbacks(execute=True):
            model_admin.save_model(
                request,
                self.support_request,
                form=None,
                change=True,
            )

        self.support_request.refresh_from_db()
        self.assertEqual(self.support_request.status, "answered")
        self.assertEqual(self.support_request.responded_by, self.staff)
        self.assertIsNotNone(self.support_request.responded_at)
        notification = Notification.objects.get(
            user=self.user, type="support_reply"
        )
        self.assertEqual(
            notification.related_support_request,
            self.support_request,
        )
        send_email.assert_called_once()

    @patch("core.admin.send_notification_email")
    def test_unchanged_reply_does_not_notify_twice(self, send_email):
        self.support_request.admin_reply = "Өмнөх хариу"
        self.support_request.status = "answered"
        self.support_request.save()
        request = RequestFactory().post("/admin/core/supportrequest/")
        request.user = self.staff
        model_admin = SupportRequestAdmin(SupportRequest, admin.site)

        model_admin.save_model(
            request,
            self.support_request,
            form=None,
            change=True,
        )

        self.assertFalse(
            Notification.objects.filter(
                user=self.user, type="support_reply"
            ).exists()
        )
        send_email.assert_not_called()
