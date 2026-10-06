# Mobile deployment and web parity QA

Last audited: 2026-10-06
Audited source: the git commit containing this file

## Automated checks

| Check | Result |
|---|---|
| `npm run lint` | Pass |
| `tsc --noEmit` | Pass |
| `expo install --check` | Pass using the local Expo dependency map |
| Android Metro production bundle | Pass |
| iOS Metro production bundle | Pass |
| Django regression suite | Pass: 266 tests |
| Production web `/mn` | HTTP 200 |
| Production public listing/category/amenity/availability/review APIs | HTTP 200 |
| Production protected APIs without a token | HTTP 401 as expected |

The most recent EAS build (`7f19b8e4-446b-40d7-9a3f-274cb77f67d2`) is an
Android preview APK created on 2026-09-26 from the current parity working tree.
It is the device-QA candidate for the scenarios below. It is not a production
store release: Android Maps and remote push still require the credentials
listed below.

## Deployment blockers

### Local Docker environment

- Resolved on 2026-09-27: four duplicate local-only account emails were changed
  to unique `.invalid` placeholders, preserving the local admin, listings,
  bookings, and host application test data.
- A pre-change PostgreSQL backup is stored at
  `backups/huduu_20260927_before_email_dedupe.dump`.
- Migration `0052_unique_user_email` and all migrations through `0061` are
  applied. The local backend is running and `/api/categories/` returns HTTP 200.

### Android

- Maps SDK for Android is not enabled in Google Cloud and there is no Android
  Maps API key. A standalone `react-native-maps` build needs this even though
  MapTiler provides the visible tile layer.
- Create/restrict the key to package `mn.tanaidhonoy.app` and the EAS signing
  SHA-1 `97:21:2A:A6:48:19:64:A3:6B:38:B6:6E:C9:A1:B1:8D:3B:A5:56:B9`.
- `EXPO_PUBLIC_MAPTILER_KEY` is now configured in the EAS `preview` and
  `production` environments.
- EAS has no FCM V1 service-account credential and the project has no
  `google-services.json`. Android remote push notifications cannot work in a
  standalone APK until Firebase/FCM is configured.

### iOS

- The Expo account has no Apple team attached. A paid Apple Developer team,
  registered test device, provisioning profile, and APNs key are required for
  a device preview/TestFlight build.

## Web/mobile feature parity

| Area | Static/API parity | Device E2E | Notes |
|---|---|---|---|
| Listing discovery, search, filters, map | Implemented | Blocked | Android map credential required |
| Listing detail, availability, favorites, reviews | Implemented | Pending | Public production APIs pass |
| Login, token refresh, logout | Implemented | Pending | Uses the same JWT endpoints and 401 recovery as web |
| Registration and email verification | Implemented | Pending | Uses `/auth/registration/` and a mobile confirmation deep link |
| Forgot/reset password | Implemented | Pending | Mobile reset deep link is implemented |
| Google login | Implemented | Pending | Must test release OAuth credentials on devices |
| Facebook login, registration and account linking | Implemented | Pending | Must test release signing and deep links on devices |
| Favorites | Implemented | Pending | Requires authenticated device test |
| Booking creation and QPay invoice/status polling | Implemented | Pending | 5-second polling reads our DB; app resume performs one provider check. Use a controlled low-value listing/test invoice |
| QPay cancellation/expiry date hold safety | Implemented | Pending | Dates remain held until provider cancellation succeeds; failed cancellation retries in `payment_worker` |
| Guest/host cancellation and refund state | Implemented | Pending | Requires two-role scenario |
| Booking chat, read state and contact reveal | Implemented | Pending | Contact is restricted to paid confirmed bookings |
| Notifications list/read/navigation | Implemented | Pending | Remote push blocked by FCM/APNs credentials |
| Create listing, images and availability | Implemented | Pending | Requires host account and moderation check |
| Edit/delete listing, images and availability | Implemented | Pending | Booked dates are protected in the calendar |
| Host bookings and combined calendar | Implemented | Pending | Booked dates open the corresponding host booking |
| Host payout profile | Implemented | Pending | Bank, account and host phone fields match web |
| General profile | Implemented | Pending | Avatar, address, username, email, phone and bio match web |
| Support requests | Implemented | Pending | Requires authenticated device test |
| Terms and privacy | Implemented | Pending | Both are available from the mobile profile menu |
| Languages | Intentional difference | N/A | Mobile is Mongolian-only; web supports mn/en/fr |

No code-level parity row remains partial. The app must still not be described
as fully equivalent to web until the pending scenarios pass on physical
Android and iOS devices.

## Release-candidate device checklist

Run these against the newly built preview binary, not Expo Go:

1. Fresh install, app-open/install analytics, permission prompts, light/dark UI.
2. Browse/search/filter listings; verify maps, markers, geocoding, and images.
3. Sign up, log out/in, refresh an expired token, and reset a password through
   the `tanaidhonoy://` deep link.
4. Google login and Facebook login/connect with release credentials.
5. Favorite/unfavorite, notification read state, and auth-return navigation.
6. Guest booking: dates -> QPay invoice -> payment confirmation -> booking
   detail -> chat/contact -> review -> guest cancellation.
7. Host flow: application documents -> admin approval -> create/edit listing ->
   admin moderation -> availability -> host booking -> chat/contact -> host
   cancellation.
8. Receive a background push for booking, message, support, and moderation;
   tap each notification and verify its destination.
9. Test offline/retry behavior, revoked refresh token, 401 recovery, duplicate
   submits, and upload failure recovery.
