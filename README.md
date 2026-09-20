# Huduu-Garay 🏕️🇲🇳

**Huduu-Garay** is a full-stack travel marketplace platform inspired by Airbnb, designed for Mongolia.  
It connects urban residents with authentic countryside experiences by enabling bookings with nomadic herder families.

---

## 🌟 Features

- 🔍 Search & Filter Listings by location, category, price, and amenities
- 🛏️ Listings with images, beds, max guests, amenities, and calendar availability
- 📅 Availability calendar with conflict validation
- 🔐 JWT Authentication (access & refresh tokens)
- 💬 Wishlist (Favorites) system
- 🧑‍🌾 Host panel to manage bookings and cancellations
- 👥 Guest panel to track bookings
- 🖼️ Multi-image upload with optimization
- 🔔 Notifications for new bookings _(coming soon)_

---

## 🛠️ Tech Stack

### Frontend (Next.js + Tailwind CSS)

- Next.js 14 (App Router)
- Tailwind CSS
- Axios with refresh interceptor
- React Day Picker for calendar
- Fully responsive UI

### Backend (Django + DRF + PostgreSQL)

- Django 4.x with Django REST Framework
- PostgreSQL database
- JWT (SimpleJWT)
- Role-based auth (host, guest)
- Booking, Listing, Availability, Favorite models

## Password recovery rollout

- Set backend `FRONTEND_URL` to the public web origin (default: `https://www.tanaid-honoy.mn`). For local development, use the local frontend origin.
- Configure `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, and optionally `DEFAULT_FROM_EMAIL`. Recovery reports SMTP failures; other notification delivery behavior is unchanged.
- Apply migrations before starting the updated backend. Migration `core.0052_unique_user_email` normalizes emails and enforces case-insensitive uniqueness for nonempty addresses. It stops without merging or deleting accounts if existing addresses conflict; review those accounts and resolve ownership before retrying.
- Existing JWTs lack the new password fingerprint and require users to sign in again after rollout. Password changes invalidate both access and refresh tokens.
- Recovery links expire after 24 hours and after a successful reset. Mobile emails include an app link and a web fallback. Verify delivery and app opening on a real device after deployment.
- Run recovery regression tests with `python manage.py test core.test_password_recovery core.test_api.PasswordResetTests core.test_api.SignupLoginTests core.test_api.GoogleLoginTests` against a configured test database.

## Facebook login

Web and mobile use a shared server-side OAuth flow. Setup, Meta callback URLs, activation, and verification steps: [Facebook Login setup](docs/facebook-login.md). Production Facebook buttons remain hidden until the backend is configured and enabled; local web development shows a disabled preview with a setup explanation.
