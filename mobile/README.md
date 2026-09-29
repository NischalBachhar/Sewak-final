# Sewak Mobile

Cross-platform Sewak mobile app foundation built with React Native, Expo Router and TypeScript.

## Implemented
- light Sewak theme aligned with the current web dashboard
- public caregiver browsing
- caregiver profile screen
- Firebase email/password sign-in with persistent native session
- role-aware Home, Caregivers, Bookings and Profile tabs
- customer care-request foundation
- centralized Cloudflare Worker/D1 API adapter
- development-only sample caregiver data while the Worker endpoint is unavailable

## Run locally
```bash
cd mobile
cp .env.example .env
npm install
npm run start
```

Set the Firebase public client configuration in `.env`. Never put service-account keys, Cloudflare API tokens or other server secrets in `EXPO_PUBLIC_*`.

## Backend boundary
The app must never connect directly to D1.

```
React Native app
      |
      | HTTPS + Firebase ID token
      v
Cloudflare Worker API
      |
      v
Cloudflare D1
```

The mobile adapter currently expects:
- GET /api/public/caregivers
- GET /api/public/caregivers/:id
- GET /api/me
- GET /api/bookings/me
- POST /api/bookings

Those endpoint names are isolated in `src/api/sewak.ts` because the Firebase-to-D1 Worker implementation is not present in the GitHub branches currently visible here. When that code is pushed, update the adapter rather than every screen.

## Next milestone
Mirror the hardened web booking validation and booking schema exactly, then add caregiver job requests, active care sessions, availability, earnings, notifications and profile-image upload.
