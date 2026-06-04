# Sheher Mobile (separate from website)

Native-style app built with **Expo**. It talks to the **same Next.js API** as the website but lives in its own folder so the web UI stays untouched.

## Setup

```bash
cd mobile
npm install
```

Create `mobile/.env` (optional):

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000
```

Use your machine's LAN IP when testing on a physical phone (not `localhost`).

## Run

```bash
# Terminal 1 — website API (from repo root)
npm run dev

# Terminal 2 — mobile app
cd mobile
npm start
```

Scan the QR code with Expo Go, or press `a` / `i` for Android / iOS simulator.

## Features (app-only)

- **Mood picker** — explicit mood axis sent to `/api/recommendations/mood`
- **Town events** — `/api/events/town` for workshops, markets, time-pass plans
- **Location** — optional GPS for better ranking on the API

## Website vs app

| | Website (`/`) | Mobile (`mobile/`) |
|---|-------------|-------------------|
| UI | Unchanged cinematic web | Native list + mood chips |
| Mood | Inferred from search + time (no new UI) | User picks mood |
| Deploy | Vercel / your web host | App Store / Play Store via EAS |

## Ship to stores (later)

```bash
npm install -g eas-cli
eas build --platform all
```

Bundle IDs are set in `app.json` (`com.sheher.mobile`).
