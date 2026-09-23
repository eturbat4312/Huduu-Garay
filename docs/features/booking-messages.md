# Booking contact and messages

Contact requires the current user to be the booking guest or listing host, a confirmed booking with no guest/host cancellation, and a `paid` payment covering `total_price + service_fee`. Legacy confirmed bookings without a matching paid payment remain locked. Do not backfill paid records without actual payment evidence.

Web and mobile booking detail pages expose a booking-specific text conversation and a phone action. The API enforces the same rule on reading, sending and marking messages read. Guest contact fields and booking free text are redacted from the host's booking response while contact is locked. Listing contact visibility also requires payment.

Messages are limited to 2,000 characters, fetched in batches of 100 using an `after` message ID, and refreshed every five seconds while chat is open. Sends use a client UUID to avoid duplicates after network retries. Incoming fetched messages are acknowledged explicitly. New messages create notifications and queue mobile pushes through the existing push delivery worker; pushes contain no conversation text.

Django admin → **Захиалгын мессежүүд** supports searching and filtering. Staff need `core.view_bookingmessage`; superusers already have access. The booking admin includes a link to that booking's messages. Messages are read-only, including for superusers. Admin review does not mark the recipient's messages as read. Cancelling a booking locks participant contact; administrators can still review its history.

## Release

Apply migration `0057_alter_notification_type_bookingmessage` before serving the updated backend, then release web/mobile clients. Keep the existing `process_push_notifications` worker running. No new service or package is required. Older mobile builds will not show the new chat buttons until updated.

Validation includes API authorization, unpaid/underpaid/refunded/cancelled bookings, unrelated users, cross-booking isolation, retry deduplication, input validation, read acknowledgements, contact redaction, and read-only admin permissions. Manually smoke-test two paid participants on devices, keyboard handling, calling, and delivery through the configured Expo push worker before production release.
