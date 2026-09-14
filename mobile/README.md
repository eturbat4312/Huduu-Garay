# Танайд Хоной Mobile

Expo React Native app for the Танайд Хоной marketplace.

## Requirements

- Node.js 20.19.4 or newer
- npm
- Expo Go or iOS/Android simulator

## Setup

```bash
npm install
cp .env.example .env
npm run start
```

## API URL

The app reads `EXPO_PUBLIC_API_URL`.

Examples:

```bash
EXPO_PUBLIC_API_URL=https://www.tanaid-honoy.mn/api
EXPO_PUBLIC_API_URL=http://localhost:8010/api
```

For Android emulator, localhost may need to be replaced with `http://10.0.2.2:8010/api`.

## Current Scope

- Guest-first app shell
- Listings API smoke screen
- Search, bookings, favorites, and profile tabs
- Host dashboard reserved for a later role-based UI step
