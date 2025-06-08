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
