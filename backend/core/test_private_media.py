import os
import shutil
import tempfile
from io import BytesIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import signing
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from core.models import HostApplication
from core.private_storage import (
    PRIVATE_MEDIA_SIGNING_SALT,
    PRIVATE_MEDIA_URL_MAX_AGE,
    private_storage,
)

User = get_user_model()


def jpeg_bytes():
    buf = BytesIO()
    Image.new("RGB", (8, 8), color="red").save(buf, format="JPEG")
    return buf.getvalue()


class PrivateMediaTestCase(TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.public_root = os.path.join(self.tmp, "media")
        self.private_root = os.path.join(self.tmp, "private_media")
        os.makedirs(self.public_root)
        self.settings_override = override_settings(
            MEDIA_ROOT=self.public_root, PRIVATE_MEDIA_ROOT=self.private_root
        )
        self.settings_override.enable()

    def tearDown(self):
        self.settings_override.disable()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def make_application(self, user, id_card_name="id_cards/a.jpg"):
        app = HostApplication(
            user=user,
            full_name="Туршилт",
            phone_number="99000000",
            bank_name="Хаан Банк",
            account_number="1234",
            id_card_image=id_card_name,
            selfie_with_id="selfies/a.jpg",
        )
        HostApplication.objects.bulk_create([app])
        return HostApplication.objects.get(user=user)


class HostApplyUploadTests(PrivateMediaTestCase):
    def test_upload_goes_to_private_root_with_random_name(self):
        user = User.objects.create_user(username="applicant", password="pw12345!", email="a@x.mn")
        client = APIClient()
        client.force_authenticate(user)

        response = client.post(
            "/api/host/apply/",
            {
                "full_name": "Хэрэглэгч",
                "phone_number": "9900",
                "bank_name": "Хаан Банк",
                "account_number": "12345678",
                "id_card_image": SimpleUploadedFile("my-passport.jpg", jpeg_bytes(), "image/jpeg"),
                "selfie_with_id": SimpleUploadedFile("selfie.jpg", jpeg_bytes(), "image/jpeg"),
                "host_terms_accepted": "true",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn("id_card_image", response.data)
        self.assertNotIn("selfie_with_id", response.data)

        app = HostApplication.objects.get(user=user)
        self.assertTrue(app.id_card_image.name.startswith("id_cards/"))
        self.assertNotIn("my-passport", app.id_card_image.name)
        self.assertTrue(app.id_card_image.name.endswith(".jpg"))
        self.assertTrue(os.path.exists(os.path.join(self.private_root, app.id_card_image.name)))
        self.assertFalse(os.path.exists(os.path.join(self.public_root, "id_cards")))
        self.assertFalse(os.path.exists(os.path.join(self.public_root, "selfies")))

        me = client.get("/api/host/application/me/")
        self.assertEqual(me.status_code, 200)
        self.assertNotIn("id_card_image", me.data)
        self.assertNotIn("/media/", str(me.data))


class PrivateMediaViewTests(PrivateMediaTestCase):
    def setUp(self):
        super().setUp()
        self.staff = User.objects.create_user(
            username="staff", password="pw12345!", email="s@x.mn", is_staff=True
        )
        self.guest = User.objects.create_user(username="guest", password="pw12345!", email="g@x.mn")
        self.name = private_storage.save("id_cards/test.jpg", ContentFile(jpeg_bytes()))
        self.url = private_storage.url(self.name)

    def test_url_is_signed_admin_route(self):
        self.assertTrue(self.url.startswith("/admin/private-media/"))
        self.assertNotIn("/media/", self.url)
        self.assertNotIn("test.jpg", self.url.replace("/admin/private-media/", ""))

    def test_anonymous_is_redirected_to_admin_login(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])

    def test_non_staff_is_redirected(self):
        self.client.force_login(self.guest)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 302)

    def test_staff_gets_file_with_private_headers(self):
        self.client.force_login(self.staff)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/jpeg")
        self.assertEqual(b"".join(response.streaming_content), jpeg_bytes())
        self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertIn("inline", response["Content-Disposition"])

    def test_html_is_forced_download(self):
        name = private_storage.save(
            "financial_proofs/host_payouts/x.html", ContentFile(b"<script>alert(1)</script>")
        )
        self.client.force_login(self.staff)
        response = self.client.get(private_storage.url(name))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/octet-stream")
        self.assertIn("attachment", response["Content-Disposition"])

    def test_tampered_token_is_404(self):
        self.client.force_login(self.staff)
        response = self.client.get(self.url.rstrip("/") + "x/")
        self.assertEqual(response.status_code, 404)

    def test_expired_token_is_404(self):
        self.client.force_login(self.staff)
        with mock.patch(
            "django.core.signing.time.time",
            return_value=__import__("time").time() + PRIVATE_MEDIA_URL_MAX_AGE + 5,
        ):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 404)

    def test_path_traversal_token_is_404(self):
        secret = os.path.join(self.tmp, "secret.txt")
        with open(secret, "w") as fh:
            fh.write("secret")
        token = signing.dumps("../secret.txt", salt=PRIVATE_MEDIA_SIGNING_SALT)
        self.client.force_login(self.staff)
        response = self.client.get(f"/admin/private-media/{token}/")
        self.assertEqual(response.status_code, 404)

    def test_missing_file_is_404(self):
        token = signing.dumps("id_cards/nope.jpg", salt=PRIVATE_MEDIA_SIGNING_SALT)
        self.client.force_login(self.staff)
        response = self.client.get(f"/admin/private-media/{token}/")
        self.assertEqual(response.status_code, 404)

    def test_admin_change_page_links_to_private_route(self):
        user = User.objects.create_user(username="host1", password="pw12345!", email="h@x.mn")
        app = self.make_application(user, id_card_name=self.name)
        superuser = User.objects.create_superuser(
            username="root", password="pw12345!", email="r@x.mn"
        )
        self.client.force_login(superuser)
        response = self.client.get(f"/admin/core/hostapplication/{app.pk}/change/")
        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn("/admin/private-media/", body)
        self.assertNotIn(f"/media/{self.name}", body)


class MovePrivateMediaCommandTests(PrivateMediaTestCase):
    def test_moves_referenced_files_and_purges_orphans(self):
        user = User.objects.create_user(username="old", password="pw12345!", email="o@x.mn")
        self.make_application(user)
        for rel in ("id_cards/a.jpg", "selfies/a.jpg", "id_cards/orphan.jpg"):
            path = os.path.join(self.public_root, rel)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as fh:
                fh.write(jpeg_bytes())

        call_command("move_private_media", "--dry-run", stdout=BytesIOText())
        self.assertTrue(os.path.exists(os.path.join(self.public_root, "id_cards/a.jpg")))

        call_command("move_private_media", "--purge-orphans", stdout=BytesIOText())
        self.assertTrue(os.path.exists(os.path.join(self.private_root, "id_cards/a.jpg")))
        self.assertTrue(os.path.exists(os.path.join(self.private_root, "selfies/a.jpg")))
        self.assertFalse(os.path.exists(os.path.join(self.public_root, "id_cards/a.jpg")))
        self.assertFalse(os.path.exists(os.path.join(self.public_root, "id_cards/orphan.jpg")))

        app = HostApplication.objects.get(user=user)
        self.assertTrue(app.id_card_image.storage.exists(app.id_card_image.name))


class BytesIOText:
    def write(self, *_args, **_kwargs):
        pass

    def flush(self):
        pass
