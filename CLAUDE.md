# huduu_garay — tanaid-honoy.mn

Монгол дахь байр/байшин түрээслэлийн платформ (Airbnb хэлбэр).

## Технологийн Stack

| Давхарга | Технологи |
|---|---|
| Backend | Django 5 + DRF + SimpleJWT + PostgreSQL 15 |
| Frontend | Next.js 15 (App Router, TypeScript, Tailwind CSS) |
| Auth | JWT + Google OAuth + Email-or-username login |
| Деплой | Docker Compose + Gunicorn + Whitenoise |
| Имэйл | Gmail SMTP (tanaid.honoy1@gmail.com) |
| i18n | mn / en / fr (`[locale]` routing) |

## Хавтасны бүтэц

```
huduu_garay_production/
├── backend/
│   ├── core/                   # Ганц Django app — бүх логик энд
│   │   ├── models.py           # Бүх model
│   │   ├── views.py            # Бүх API view
│   │   ├── serializers.py
│   │   ├── urls.py             # /api/ доорх бүх endpoint
│   │   ├── admin.py
│   │   ├── backends.py         # EmailOrUsernameBackend
│   │   ├── test_api.py         # 69 integration тест (бүгд pass)
│   │   └── utils/
│   │       └── email_notifications.py
│   └── huduu_garay/
│       ├── settings.py
│       └── urls.py             # JWT token endpoint-ууд
├── frontend/src/
│   ├── app/[locale]/           # Next.js pages
│   ├── components/             # React компонентууд
│   ├── context/                # AuthContext, NotificationContext
│   ├── lib/                    # axios.ts, api.ts, i18n.ts
│   └── locales/                # mn.json, en.json, fr.json
├── docker-compose.yml          # Production
├── docker-compose.override.yml # Local dev (автоматаар apply)
└── docker-compose.dev.yml
```

## Database Models (core/models.py)

- **CustomUser** — AbstractUser + `is_host`, `avatar`, `phone`, `bio`, `full_name`, `host_application_status`
- **Category** — Байрны ангилал
- **Amenity** — Тав тухт нөхцөл (`translation_key` i18n-д)
- **Listing** — Зар: host, category, price_per_night, amenities(M2M), location_city/district/khoroo/extra/building/apartment/lat/lng
- **ListingImage** — Зарны зураг (Pillow resize 1024×768, JPEG 85%)
- **Availability** — Боломжтой огноо (listing + date)
- **Booking** — guest, check_in/out, full_name, phone_number, total_price, service_fee (10%), `is_cancelled_by_host`
- **Favorite** — user + listing (unique_together)
- **Notification** — type choices: booking, booking_cancelled, booking_created, booking_confirmed, review, comment, payment, rating
- **Review** — listing + booking + guest (unique_together), rating 1–5
- **HostApplication** — OneToOne to user, id_card_image, selfie_with_id, bank_name, account_number, status(pending/approved/rejected)

## API Endpoints (бүгд `/api/` prefix)

### Auth
```
POST   /signup/
POST   /token/                     # JWT нэвтрэх
POST   /token/refresh/
GET    /me/                        # профайл
PATCH  /me/                        # профайл засах (multipart)
POST   /auth/google/               # Google OAuth
POST   /password-reset/
POST   /password-reset/confirm/
```

### Listings
```
GET    /listings/                  # ?category=&search=&location=&price_min=&price_max=&amenities=
POST   /listings/                  # host л үүсгэж болно
GET    /listings/<id>/
GET    /listings/<id>/edit/
PATCH  /listings/<id>/edit/
DELETE /listings/<id>/delete/      # active booking байвал 409
GET    /my-listings/
GET    /categories/
GET    /amenities/
POST   /listing-images/            # multi-file upload
DELETE /listing-images/<id>/delete/
```

### Availability
```
GET    /availability/?listing=<id>
POST   /availability/bulk/         # {"listing": id, "dates": ["2026-01-01", ...]}
DELETE /availability/<id>/
POST   /availability/delete-by-listing/
```

### Booking
```
POST   /bookings/                  # боломжтой огноо шалгаж захиална
GET    /bookings/my/               # зочны захиалгууд
GET    /bookings/<id>/
POST   /bookings/<id>/host-cancel/
GET    /host-bookings/
GET    /host-bookings/<id>/
GET    /host-booking-calendar/
```

### Favorites / Notifications / Reviews / Host
```
POST   /favorites/                 # {"listing_id": id}
DELETE /favorites/<id>/
GET    /my-favorites/
GET    /notifications/
GET    /notifications/unread-count/
POST   /notifications/mark-read/   # {"type": "booking_created"} эсвэл бүгд
GET    /listings/<id>/reviews/
POST   /listings/<id>/reviews/     # check_out-аас хойш л зөвшөөрнө
POST   /host/apply/                # multipart: id_card_image, selfie_with_id
GET    /host/application/me/
PATCH  /host/application/me/
```

## Бизнесийн логик

### Үнийн тооцоо
- `total_price` = шөнийн тоо × price_per_night
- `service_fee` = total_price × 10%
- Guest төлнө: total_price + service_fee
- Host авна: total_price − 10%

### Booking flow
1. Availability record байгааг шалгана → бүгд байвал booking үүснэ
2. Availability record-ууд устгагдана (давхар захиалгаас сэргийлнэ)
3. Host болон Guest-д **notification + email** хоёулаа илгээнэ
4. Хост цуцалбал availability буцаж нэмэгдэнэ

### Host Application
- Guest хүсэлт илгээнэ → Django admin дээр хянана
- approved → `is_host=True`, rejected → `is_host=False` (save() дотор автомат)
- Бүр шатанд имэйл мэдэгдэл

## JWT тохиргоо
- ACCESS: 60 мин, REFRESH: 7 хоног
- `ROTATE_REFRESH_TOKENS = True` + `token_blacklist` app (INSTALLED_APPS-д байх ёстой)

## Frontend Pages (src/app/[locale]/)

| Route | Зориулалт |
|---|---|
| `/` | Нүүр (listing grid + map) |
| `/listings`, `/listings/[id]` | Зарууд |
| `/listings/new`, `/edit-listing/[id]` | Зар удирдах (host) |
| `/checkout`, `/booking-success` | Захиалга |
| `/bookings`, `/bookings/[id]` | Зочны захиалгууд |
| `/host-bookings`, `/host-bookings/[id]` | Хостын захиалгууд |
| `/my-listings`, `/favorites`, `/profile`, `/notifications` | Хэрэглэгч |
| `/become-host` | Хост болох хүсэлт |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Auth |
| `/social/callback` | Google OAuth callback |

## Тест ажиллуулах

```bash
cd backend
DB_HOST=localhost python manage.py test core.test_api --verbosity=2
```

Шаардлага: local PostgreSQL, `huduu_user` (CREATEDB эрхтэй), `huduu` database.

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

- Backend: port 8010 (production: 127.0.0.1 only)
- Frontend: port 3000
- Local dev backend: port 8011 (hot reload), DEBUG=True
