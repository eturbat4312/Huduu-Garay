from datetime import date, timedelta
from uuid import uuid4
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from core.models import Booking, BookingMessage, Payment, Notification
from core.test_api import make_user, make_listing


class BookingMessageTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.host = make_user('chat_host', is_host=True)
        self.host.phone = '99112233'
        self.host.save()
        self.guest = make_user('chat_guest')
        self.other = make_user('chat_other')
        self.listing = make_listing(self.host)
        self.booking = Booking.objects.create(
            listing=self.listing, guest=self.guest, check_in=date.today(),
            check_out=date.today() + timedelta(days=2), total_price=100000,
            service_fee=10000, status='confirmed', phone_number='88112233',
            notes='Contact me at guest@example.com', full_name='guest@example.com',
        )
        self.url = f'/api/bookings/{self.booking.pk}/messages/'
        self.client = APIClient()
        self.client.force_authenticate(self.guest)

    def paid(self):
        return Payment.objects.create(booking=self.booking, amount=110000,
                                      status='paid', sender_invoice_no=str(uuid4()))

    def send(self, **kwargs):
        return self.client.post(self.url, {'body': 'Сайн байна уу?', 'client_id': str(uuid4()), **kwargs}, format='json')

    def test_unpaid_confirmed_is_locked_and_contact_redacted(self):
        self.assertEqual(self.send().status_code, 403)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        data = self.client.get(f'/api/bookings/{self.booking.pk}/').data
        self.assertFalse(data['can_contact'])
        self.assertIsNone(data['host_phone'])
        self.client.force_authenticate(self.host)
        data = self.client.get(f'/api/host-bookings/{self.booking.pk}/').data
        for field in ['phone_number', 'guest_phone', 'notes', 'full_name', 'guest_name']:
            self.assertEqual(data[field], '')

    def test_paid_participants_chat_retry_read_and_notification(self):
        self.paid()
        key = str(uuid4())
        response = self.send(client_id=key)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.send(client_id=key).status_code, 200)
        self.assertEqual(BookingMessage.objects.count(), 1)
        self.assertEqual(Notification.objects.filter(type='booking_message', user=self.host).count(), 1)
        self.client.force_authenticate(self.host)
        data = self.client.get(f'/api/host-bookings/{self.booking.pk}/').data
        self.assertTrue(data['can_contact'])
        self.assertEqual(data['unread_message_count'], 1)
        messages = self.client.get(self.url).data['messages']
        self.assertFalse(messages[0]['is_mine'])
        self.assertIsNone(BookingMessage.objects.get().read_at)
        self.assertEqual(self.client.post(self.url+'read/', {'through': response.data['id']}).status_code, 200)
        self.assertIsNotNone(BookingMessage.objects.get().read_at)
        self.assertTrue(Notification.objects.get(type='booking_message').is_read)
        self.assertEqual(self.send().status_code, 201)
        self.client.force_authenticate(self.guest)
        self.assertEqual(self.client.get(f'/api/bookings/{self.booking.pk}/').data['host_phone'], self.host.phone)

    def test_outsiders_and_anonymous_cannot_read_write_or_mark_read(self):
        self.paid()
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.send().status_code, 404)
        self.assertEqual(self.client.post(self.url+'read/', {'through': 999}).status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_status_payment_amount_and_cancellation_fail_closed(self):
        payment = self.paid()
        for status in ['pending_payment', 'cancelled', 'expired', 'payment_failed']:
            self.booking.status = status
            self.booking.save()
            self.assertEqual(self.send().status_code, 403)
        self.booking.status = 'confirmed'
        self.booking.save()
        for status in ['pending', 'failed', 'cancelled', 'expired', 'refunded']:
            payment.status = status
            payment.save()
            self.assertEqual(self.send().status_code, 403)
        payment.status = 'paid'
        payment.amount = 100000
        payment.save()
        self.assertEqual(self.send().status_code, 403)
        payment.amount = 110000
        payment.save()
        self.booking.guest_cancelled_at = timezone.now()
        self.booking.save()
        self.assertEqual(self.send().status_code, 403)
        self.booking.guest_cancelled_at = None
        self.booking.is_cancelled_by_host = True
        self.booking.save()
        self.assertEqual(self.send().status_code, 403)

    def test_validation_and_cursor(self):
        self.paid()
        for body in ['', '   ', 'x' * 2001]:
            self.assertEqual(self.send(body=body).status_code, 400)
        self.assertEqual(self.send(client_id='bad').status_code, 400)
        self.assertEqual(self.client.get(self.url+'?after=bad').status_code, 400)
        self.assertEqual(self.client.post(self.url+'read/', {}).status_code, 400)
        message = self.send()
        self.assertEqual(self.client.get(self.url+f'?after={message.data["id"]}').data['messages'], [])

    def test_other_paid_booking_does_not_unlock_pending_booking(self):
        self.paid()
        pending = Booking.objects.create(listing=self.listing, guest=self.guest,
            check_in=date.today(), check_out=date.today()+timedelta(days=1), status='pending_payment')
        data = self.client.get(f'/api/bookings/{pending.pk}/').data
        self.assertFalse(data['can_contact'])
        self.assertIsNone(data['host_phone'])
        self.assertIsNone(data['host_email'])

    def test_listing_does_not_expose_contact_for_unpaid_booking(self):
        data = self.client.get(f'/api/listings/{self.listing.pk}/').data
        self.assertNotIn('phone', data['host'])
        self.paid()
        data = self.client.get(f'/api/listings/{self.listing.pk}/').data
        self.assertEqual(data['host']['phone'], self.host.phone)

    def test_admin_can_review_but_not_mutate_messages(self):
        from django.contrib.auth.models import Permission
        self.paid()
        self.send()
        staff = make_user('chat_staff')
        staff.is_staff = True
        staff.save()
        self.client.force_authenticate(None)
        self.client.force_login(staff)
        url = '/admin/core/bookingmessage/'
        self.assertEqual(self.client.get(url).status_code, 403)
        staff.user_permissions.add(Permission.objects.get(codename='view_bookingmessage'))
        self.assertEqual(self.client.get(url).status_code, 200)
        message = BookingMessage.objects.get()
        detail = f'{url}{message.pk}/change/'
        self.assertContains(self.client.get(detail), message.body)
        self.assertEqual(self.client.post(detail, {'body': 'edited'}).status_code, 403)
        self.assertEqual(self.client.get(f'{url}{message.pk}/delete/').status_code, 403)
        self.assertEqual(self.client.get(url+'add/').status_code, 403)

    def test_pagination_marks_only_delivered_messages_read(self):
        self.paid()
        BookingMessage.objects.bulk_create([
            BookingMessage(booking=self.booking, sender=self.host, body=str(i), client_id=uuid4())
            for i in range(101)
        ])
        first = self.client.get(self.url).data
        self.assertEqual(len(first['messages']), 100)
        self.assertTrue(first['has_more'])
        through = first['messages'][-1]['id']
        self.client.post(self.url+'read/', {'through': through})
        self.assertEqual(self.booking.messages.filter(read_at__isnull=True).count(), 1)
        second = self.client.get(self.url+f'?after={through}').data
        self.assertEqual(len(second['messages']), 1)
        self.assertFalse(second['has_more'])
        self.booking.status = 'cancelled'
        self.booking.save()
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.client.post(self.url+'read/', {'through': through}).status_code, 403)
        self.assertEqual(self.booking.messages.count(), 101)
