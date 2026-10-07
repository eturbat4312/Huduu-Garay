# Mobile deployment and web parity QA

Last audited: 2026-10-07
Audited source: `8a6ed3dcb5b6ef59f1cdfd3e25e522bedebdad28`

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
| App Store Connect metadata, pricing, privacy, and review submission | Pass |

## Public store release audit

### iOS App Store

- App Store Connect app ID: `6816730132`; bundle ID: `mn.tanaidhonoy.app`.
- EAS iOS build: `85580afb-a481-439a-ba5f-4d78702a1f33`.
- Store version: `1.0.0`; build number: `5`.
- The build is valid in TestFlight and was submitted to App Review on
  2026-10-07. Submission ID:
  `ec60afed-1ff5-43e3-b75e-7484ae123fb3`.
- Verified App Store Connect state after submission: **Waiting for Review**.
- Release mode: automatic after Apple approval.
- App price: free (`$0.00`).
- Availability on release: Mongolia and Switzerland.
- Three required iPhone screenshots at 1179 x 2556 were uploaded from
  `mobile/store-assets/ios/`.
- App Privacy was published with 17 collected data types. Product Interaction
  is declared for Analytics and not linked to identity; the remaining declared
  types are used for App Functionality and linked to identity. No declared data
  type is used for tracking.
- Content Rights is set to third-party/user content with the necessary rights.
- App Review credentials and contact information are configured in App Store
  Connect. The password is intentionally not stored in this repository.

### Android Google Play

- EAS production build: `474f4e66-1912-4d95-bc91-727b297fb06a`.
- Store version: `1.0.0`; version code: `7`.
- Source commit: `8a6ed3dcb5b6ef59f1cdfd3e25e522bedebdad28`.
- Verified EAS state: **FINISHED** with store distribution and an Android App
  Bundle (`.aab`).
- Artifact:
  `https://expo.dev/artifacts/eas/-7t8v7uWfPPfZ0WFL-8RkjPyDeykVRnsGmyg6qWuvwI.aab`.
- Google Play submission is deferred until the owner creates and verifies the
  Play Console developer account. No account type, fee, or submission has been
  chosen on the owner's behalf.

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

- The production AAB is built successfully, but it has not been uploaded to
  Google Play because the developer account is not ready.
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

- Apple signing, App Store Connect delivery, TestFlight processing, store
  metadata, privacy publication, and App Review submission are complete for
  version `1.0.0` build `5`.
- Public availability now depends on Apple review approval. App Store Connect
  states that review can take up to 48 hours.

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
