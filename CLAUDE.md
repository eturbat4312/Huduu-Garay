# huduu_garay — tanaid-honoy.mn

Монгол дахь байр/байшин түрээслэлийн платформ (Airbnb хэлбэр). Web (Next.js), Mobile (Expo/React Native) хоёулаа нэг Django backend ашигладаг.

## Технологийн Stack

| Давхарга | Технологи |
|---|---|
| Backend | Django 5 + DRF + SimpleJWT + PostgreSQL 15 |
| Web frontend | Next.js 15 (App Router, TypeScript, Tailwind CSS) |
| Mobile | Expo / React Native (expo-router), Монгол хэл дээр л (i18n алга) |
| Auth | JWT + Google OAuth + Facebook (authorization-code, backend-only secrets) + Email-or-username login |
| Төлбөр | QPay Merchant V2 (invoice + webhook callback) |
| Push мэдэгдэл | Expo Push API, тусдаа `push_worker` container (`--watch` daemon) |
| Деплой | Docker Compose (`db`, `backend`, `push_worker`, `payment_worker`, `frontend`) + Gunicorn + Whitenoise + Nginx |
| Файл хадгалалт | Public: `MEDIA_ROOT` (Nginx serve). Нууц (ID/selfie/санхүүгийн баримт): `PRIVATE_MEDIA_ROOT`, зөвхөн admin-ы signed URL-аар |
| Имэйл | Gmail SMTP (tanaid.honoy1@gmail.com) |
| i18n | Зөвхөн web: mn / en / fr (`[locale]` routing). Mobile: mn hardcoded |

## Хавтасны бүтэц

```
huduu_garay_production/
├── backend/
│   ├── core/                        # Ганц Django app — бүх логик энд
│   │   ├── models.py                # 22 model (доор бүрэн жагсаалт)
│   │   ├── views.py                 # Бүх DRF API view
│   │   ├── serializers.py
│   │   ├── urls.py                  # /api/ доорх endpoint-ууд
│   │   ├── admin.py                 # ~2000 мөр: model admin + /admin/stats/ dashboard
│   │   ├── backends.py              # EmailOrUsernameBackend
│   │   ├── adapters.py              # allauth AccountAdapter
│   │   ├── auth_serializers.py      # PasswordAwareTokenRefreshSerializer
│   │   ├── facebook_views.py        # Facebook authorization-code flow
│   │   ├── booking_messages.py      # Захиалгын чат (BookingMessagesView)
│   │   ├── private_media_views.py   # /admin/private-media/<token>/ — staff-only signed file serve
│   │   ├── private_storage.py       # PrivateMediaStorage, upload_to функцүүд
│   │   ├── image_processing.py      # Pillow resize/optimize
│   │   ├── signals.py
│   │   ├── services/
│   │   │   ├── qpay.py              # QPayClient — auth token, invoice, callback verify
│   │   │   ├── settlements.py       # HostPayout/GuestRefund тооцоолол, FinancialAuditLog
│   │   │   ├── cancellations.py     # Guest/host цуцлалтын бодлого, буцаалтын дүн
│   │   │   ├── booking_times.py     # Улаанбаатарын цагийн бүс, check-in/out цаг
│   │   │   ├── booking_contact.py   # Хэзээ guest↔host мессеж бичиж болохыг шийднэ
│   │   │   ├── facebook.py          # Server-side Facebook token баталгаажуулалт
│   │   │   ├── payment_expiry.py    # QPay provider-first cancel + hold lifecycle
│   │   │   └── push_notifications.py
│   │   ├── utils/
│   │   │   ├── email_notifications.py
│   │   │   └── staff_notifications.py
│   │   ├── management/commands/
│   │   │   ├── move_private_media.py       # Public → private media migration
│   │   │   ├── process_push_notifications.py  # push_worker container-ийн command
│   │   │   ├── process_expired_payments.py    # payment_worker container-ийн command
│   │   │   └── cleanup_facebook_auth.py
│   │   └── test_*.py                # 266 тест, доор жагсаалт
│   └── huduu_garay/
│       ├── settings.py              # QPAY_*, FACEBOOK_*, EXPO_PUSH_*, PRIVATE_MEDIA_ROOT
│       └── urls.py                  # JWT, /admin/stats/, /admin/private-media/
├── frontend/src/                    # Web (Next.js)
│   ├── app/[locale]/                # Pages — доор бүрэн жагсаалт
│   ├── components/
│   ├── context/                     # AuthContext, NotificationContext
│   ├── lib/                         # axios.ts, api.ts, i18n.ts
│   └── locales/                     # mn.json, en.json, fr.json
├── mobile/src/                      # Mobile (Expo)
│   ├── app/                         # expo-router pages — доор бүрэн жагсаалт
│   ├── context/, components/, hooks/, lib/, constants/
├── docs/                            # facebook-login.md, features/booking-messages.md
├── docker-compose.yml               # Production: db, backend, push_worker, payment_worker, frontend
├── docker-compose.override.yml      # Local dev (автоматаар apply)
└── docker-compose.dev.yml
```

## Database Models (core/models.py — 22 model)

**Хэрэглэгч / зар**
- **CustomUser** — AbstractUser + `is_host`, `is_guest`, `avatar`, `phone`, `address`, `bio`, `full_name`, `host_application_status`
- **Category**, **Amenity** (`translation_key` i18n-д)
- **Listing** — `status` (pending_review/active/changes_requested/rejected/suspended) — **шинэ зар admin хяналт шаардана**; `review_notes`, `reviewed_by/at`; location талбарууд public (city/district/khoroo/extra) vs private (building/apartment)
- **ListingImage** — Pillow resize 1024×768, JPEG 85%
- **Availability** — listing + date
- **Favorite** — user + listing

**Захиалга / төлбөр** (шинэ QPay урсгал — доорх Бизнесийн логик хэсгийг үзнэ үү)
- **Booking** — `status` (pending_payment/confirmed/cancelled/expired/payment_failed), `payment_intent_key`, `hold_expires_at`, guest/host цуцлалтын шалтгаан+бодлогын хувилбар тус тусад нь
- **BookingHold** — booking+listing+date, өдөр тус бүрийг түр “түгжиж” давхар захиалгаас сэргийлнэ (unique listing+date)
- **BookingMessage** — booking доtorh чат (зөвхөн `status=confirmed` үед)
- **Payment** — QPay invoice: `provider_fee_rate/amount` (QPay-ийн 1% шимтгэл), `idempotency_key`, `raw_response` (JSON)
- **HostPayout** — booking бүрт 1:1, 72 цагийн хугацаа (`eligible_at`), `status` (pending/review/hold/paid/not_payable), `transfer_proof` (private storage)
- **GuestRefund** — booking бүрт 1:1, `reason` (guest/host cancelled, admin), `status` (review/approved/paid/not_required)
- **FinancialAuditLog** — HostPayout эсвэл GuestRefund-ийн бүх төлөв өөрчлөлтийн түүх

**Бусад**
- **Review** — listing+booking+guest unique, rating 1–5
- **HostApplication** — 1:1 user, `id_card_image`/`selfie_with_id` (private storage), `host_commission_rate`, `host_terms_version/accepted_at/ip/user_agent`
- **SupportRequest** — category, status (new/in_progress/answered/closed), admin_reply
- **PlatformAnalyticsEvent** — web_page_view/app_install/app_open, `visitor_hash` (нууцалсан), app_install нь device тус бүрт unique
- **Notification** — 19 төрлийн type (booking_message, host_application, admin_support, review, гэх мэт)
- **PushDevice** / **PushDelivery** — Expo push token, хүргэлтийн статус tracking
- **FacebookAccount** / **FacebookAuthFlow** — Facebook нэвтрэлтийн session state

## API Endpoints (бүгд `/api/` prefix, эсрэгээр заагаагүй бол)

### Auth
```
POST   /signup/
POST   /token/                          # JWT нэвтрэх (huduu_garay/urls.py)
POST   /token/refresh/
GET    /me/                             # профайл
PATCH  /me/                             # профайл засах (multipart)
POST   /auth/google/                    # Google OAuth
POST   /auth/facebook/config/           # App ID гэх мэт client config
POST   /auth/facebook/start/            # authorization URL үүсгэх
GET    /auth/facebook/callback/         # redirect callback
POST   /auth/facebook/exchange/         # code → token
POST   /auth/facebook/send-code/        # холбоо баталгаажуулах код
POST   /auth/facebook/register/
POST   /auth/facebook/connect/          # одоо байгаа хэрэглэгчид холбох
POST   /password-reset/
POST   /password-reset/confirm/
```
⚠️ Login/Signup endpoint дээр throttling алга (2026-09 review-оор олдсон — TODO).

### Listings
```
GET    /listings/                       # ?category=&search=&location=&price_min=&price_max=&amenities=
POST   /listings/                       # host л үүсгэж болно, status=pending_review-ээр эхэлнэ
GET    /listings/<id>/
GET/PATCH /listings/<id>/edit/
DELETE /listings/<id>/delete/           # active booking байвал 409
GET    /my-listings/
GET    /categories/  /amenities/
POST   /listing-images/                 # multi-file upload
DELETE /listing-images/<id>/delete/
```

### Availability
```
GET    /availability/?listing=<id>
POST   /availability/bulk/              # {"listing": id, "dates": [...]}
DELETE /availability/<id>/
POST   /availability/delete-by-listing/
```

### Booking / Payment (QPay)
```
POST   /bookings/                       # ⚠️ DEBUG үед л ажиллана, production 410 Gone
POST   /bookings/payment-intent/        # шинэ booking (pending_payment) + BookingHold үүснэ
POST   /payments/                       # тухайн booking-д QPay invoice үүсгэнэ
GET    /payments/<id>/
POST   /payments/<id>/check/            # QPay-с статус шалгах (throttled)
GET/POST /payments/qpay/callback/       # QPay webhook (AllowAny, throttled)
POST   /payments/<id>/mock-confirm/     # зөвхөн DEBUG-д
GET    /bookings/my/  GET /bookings/<id>/
POST   /bookings/<id>/host-cancel/  POST /bookings/<id>/guest-cancel/
GET    /host-bookings/  GET /host-bookings/<id>/  GET /host-booking-calendar/
GET    /bookings/<id>/messages/  POST /bookings/<id>/messages/read/
```

### Favorites / Notifications / Reviews / Host / Support
```
POST   /favorites/  DELETE /favorites/<id>/  GET /my-favorites/
GET    /notifications/  GET /notifications/unread-count/
POST   /notifications/mark-read/  POST /notifications/<id>/read/
POST   /push-devices/register/  POST /push-devices/deactivate/
GET/POST /listings/<id>/reviews/  GET /listings/<id>/review-eligibility/
POST   /host/apply/                     # multipart: id_card_image, selfie_with_id
GET/PATCH /host/application/me/
GET/POST /support-requests/
POST   /analytics/events/               # AllowAny, throttled — web/app page view/install
```

### Admin (session auth, staff/superuser л, `/api/` дотор биш)
```
GET    /admin/                          # Custom stats dashboard (stats_view)
GET    /admin/stats/                    # Орлого, QPay шимтгэл, traffic analytics
GET    /admin/stats/bookings/<id>/      # Нэг захиалгын санхүүгийн дэлгэрэнгүй
GET    /admin/private-media/<token>/    # ID/selfie/санхүүгийн баримт — signed, 1 цаг, staff-only
```

## Бизнесийн логик

### Үнийн тооцоо
- `total_price` = шөнийн тоо × price_per_night
- `service_fee` = total_price × 10%
- Guest төлнө: total_price + service_fee (QPay-ээр)
- Host авна: total_price − 10% (HostPayout-оор, 72 цагийн дараа)
- QPay өөрөө нэмэлт ~1% шимтгэл авдаг (`Payment.provider_fee_amount`) — энэ нь платформын орлогоос суутгагдана

### Booking + Payment flow (QPay, 2026-09-с хойш)
1. **`POST /bookings/payment-intent/`** — Guest огноо сонгоход `Booking(status=pending_payment)` + `BookingHold` (тухайн өдрүүдийг түр түгжинэ) үүснэ, `hold_expires_at` тавигдана
2. **`POST /payments/`** — тухайн booking-д QPay invoice (`Payment`) үүсгэнэ; idempotency key-ээр давхар invoice-оос сэргийлнэ
3. Guest QPay-ээр төлнө → **webhook** (`/payments/qpay/callback/`) QPay-г нэг удаа баталгаажуулаад статусыг `paid` болгоно. Web/mobile-ийн 5 секундийн polling нь зөвхөн өөрийн DB-г уншина; банкны апп-аас буцаж ирэх болон гараар шалгах үед `/payments/<id>/check/` нэг удаагийн fallback болно
4. Төлбөр амжилттай болмогц `Booking.status = confirmed`, `HostPayout` үүснэ. Notification DB transaction дотор үүсэх боловч email нь commit-ийн дараа илгээгдэж, төлбөр баталгаажуулалтыг саатуулахгүй
5. `payment_worker` нь `hold_expires_at` дууссан төлбөрийг `cancellation_pending` болгоно. QPay invoice хаагдсан нь баталгаажсаны **дараа л** BookingHold устгаж огноог суллана; QPay алдаа/эргэлзээтэй үед hold хэвээр үлдэж retry хийнэ
6. Callback `cancellation_pending` үед PAID илрүүлбэл хугацаа өнгөрсөн байсан ч төлбөр давуу эрхтэйгээр booking-г баталгаажуулна. Иймээс “мөнгө орсон мөртлөө огноо суллагдсан” төлөв үүсэхгүй
7. Хуучин `POST /bookings/` (шууд booking, төлбөргүй) endpoint зөвхөн DEBUG орчинд идэвхтэй — production дээр 410 Gone буцаана

### Цуцлалт / буцаалт
- Guest болон Host тусдаа цуцлах бодлоготой (хувилбар version-той хадгалагдана: `*_cancellation_policy_version`)
- Цуцлахад `GuestRefund` үүсэж, admin гараар шалгаад дүнг баталж, буцаалтыг гараар шилжүүлдэг (автомат биш)
- Бүх санхүүгийн төлөв өөрчлөлт `FinancialAuditLog`-д бичигдэнэ

### Host Application
- Guest хүсэлт илгээнэ (`id_card_image`, `selfie_with_id` → private storage) → Django admin дээр хянана
- approved → `is_host=True`, rejected → `is_host=False` (save() дотор автомат)
- Бүр шатанд имэйл + notification (guest-д болон бүх admin/staff хэрэглэгчид)

### Зар (Listing) хяналт
- Шинэ зар `status=pending_review`-ээр эхэлнэ → admin `active`/`changes_requested`/`rejected` болгоно
- `reviewed_by`, `reviewed_at`, `review_notes` бичигдэнэ

### Push мэдэгдэл
- Mobile app `PushDevice` бүртгэнэ (`/push-devices/register/`)
- `push_worker` container (`manage.py process_push_notifications --watch --interval 10`) тогтмол ажиллаж, `PushDelivery` мөрүүдийг Expo Push API-руу илгээнэ, хүргэлтийн статусыг хянана
- `payment_worker` container (`manage.py process_expired_payments --watch --interval 5`) хугацаа дууссан QPay invoice-ийг provider-first зарчмаар хааж, амжилтгүй оролдлогыг retry хийнэ

### Нууц файлын хамгаалалт (private media)
- `HostApplication.id_card_image/selfie_with_id`, `HostPayout.transfer_proof`, `GuestRefund.transfer_proof` — бүгд `PrivateMediaStorage`-аар `PRIVATE_MEDIA_ROOT`-д хадгалагдана (Nginx-ээр serve хийгддэггүй, `/media/id_cards/`, `/media/selfies/`, `/media/financial_proofs/` бүгд Nginx дээр 404)
- Файлын `.url` нь зөвхөн staff-д зориулсан, 1 цагийн хугацаатай signed `/admin/private-media/<token>/` холбоос буцаана

## JWT тохиргоо
- ACCESS: 60 мин, REFRESH: 7 хоног
- `ROTATE_REFRESH_TOKENS = True` + `token_blacklist` app (INSTALLED_APPS-д байх ёстой)

## Web Frontend Pages (frontend/src/app/[locale]/)

| Route | Зориулалт |
|---|---|
| `/` | Нүүр (listing grid + map) |
| `/listings`, `/listings/[id]` | Зарууд |
| `/listings/new`, `/edit-listing/[id]` | Зар удирдах (host) |
| `/checkout`, `/payment`, `/booking-success` | Захиалга + QPay төлбөр |
| `/bookings`, `/bookings/[id]` | Зочны захиалгууд |
| `/host-bookings`, `/host-bookings/[id]` | Хостын захиалгууд |
| `/my-listings`, `/favorites`, `/profile`, `/notifications` | Хэрэглэгч |
| `/become-host`, `/host-terms` | Хост болох хүсэлт + нөхцөл |
| `/support` | Тусламжийн хүсэлт |
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/confirm-email` | Auth |
| `/social/callback` | Google OAuth callback |
| `/facebook`, `/facebook/callback`, `/facebook/connect`, `/facebook/data-deletion` | Facebook auth |
| `/terms`, `/privacy` | Хууль эрх зүйн хуудас |

## Mobile Pages (mobile/src/app/, expo-router)

| Route | Зориулалт |
|---|---|
| `(tabs)/index`, `(tabs)/favorites`, `(tabs)/bookings`, `(tabs)/notifications`, `(tabs)/profile` | Үндсэн tab bar |
| `listing/[id]`, `create-listing`, `edit-listing/[id]`, `my-listings` | Зар |
| `checkout`, `payment`, `booking-success` | Захиалга + QPay төлбөр |
| `host-bookings`, `host-bookings/[id]`, `booking/[id]` | Захиалга удирдах |
| `become-host`, `host-terms` | Хост болох хүсэлт |
| `support`, `edit-profile` | Хэрэглэгч |
| `login`, `signup`, `forgot-password`, `reset-password` | Auth |
| `facebook-callback`, `facebook-connect` | Facebook auth |
| `terms` | Нөхцөл |

Санамж: mobile app-д i18n систем алга — бүх текст Монгол хэлээр шууд hardcode хийгдсэн (web-ээс ялгаатай scope шийдвэр).

## Тест ажиллуулах

```bash
cd backend
DB_HOST=localhost python manage.py test core --verbosity=2   # 266 тест (бүх test_*.py)
```

Тест файлууд: `test_api.py`, `test_booking_messages.py`, `test_facebook_login.py`, `test_finance_admin.py`, `test_guest_cancellation.py`, `test_host_cancellation.py`, `test_password_recovery.py`, `test_private_media.py`, `test_push_notifications.py`, `test_staff_activity_notifications.py`, `test_support.py`.

Шаардлага: local PostgreSQL, `huduu_user` (CREATEDB эрхтэй), `huduu` database. CI pipeline (GitHub Actions) одоогоор алга — тест зөвхөн гараар ажиллуулагдана.

## Деплой

```bash
# Production (local override-ийг автоматаар ашиглахгүй)
docker compose -f docker-compose.yml up -d --build

# Local dev
make local-up

# Зөвхөн web container-ийг clean rebuild хийх
make web-rebuild

# Web log
make web-logs
```

- Containers: `db` (postgres:15), `backend`, `push_worker` (Expo push daemon), `payment_worker` (QPay invoice/hold lifecycle, 5 сек), `frontend`
- Backend: port 8010 (production: 127.0.0.1 only)
- Frontend: port 3000
- Local dev backend: port 8011 (hot reload), DEBUG=True
- Nginx (`/etc/nginx/sites-available/tanaid-honoy` серверт): `/media/id_cards/`, `/media/selfies/`, `/media/financial_proofs/` бүгд 404 (private media, доогуур), `/media/` бусад нь public (listing зураг, avatar)
- Автомат DB backup cron/systemd timer одоогоор алга — зөвхөн эрсдэлтэй deploy-ийн өмнө гараар `pg_dump` авдаг (`backups/` хавтас, серверт)
- Docker image/build cache үе үе хуримтлагддаг тул `docker image prune -f && docker builder prune -f` тогтмол хийж болно (running container-д нөлөөгүй, зөвхөн dangling image/cache устгана)
