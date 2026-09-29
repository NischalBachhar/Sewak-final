# Sewak Mobile

Cross-platform React Native / Expo application for Sewak, using the same production Cloudflare Worker + D1 platform as the web app.

## Architecture

```text
React Native / Expo
      |
      | HTTPS + opaque Bearer session
      v
Cloudflare Worker
      |
      +--> D1 application/auth database
      +--> D1 media database
      +--> PasswordHasher Durable Object
```

There is **no Firebase runtime dependency** in the mobile app. Native login, registration and activation request `sessionMode: "bearer"`. The opaque credential is stored with Expo SecureStore (iOS Keychain / Android Keystore-backed storage) and never placed in AsyncStorage, logs, URLs or analytics.

Production API defaults to:

`https://sewak-final.nischalbachhar9.workers.dev`

Override `EXPO_PUBLIC_API_BASE_URL` only for isolated staging/local development.

## Implemented mobile flows

### Public / customer
- public caregiver discovery
- caregiver profile, services, verification signals, verified reviews and rate
- Cloudflare registration/login and invitation activation
- customer profile
- exact-hour or supported time-window booking
- one-time / recurring care requests
- schema-v2 quote review and duplicate-safe booking submission
- booking history/detail
- pending cancellation
- active care-session tasks and family updates
- completed-care verified reviews

### Caregiver
- role-aware mobile dashboard
- job request/status filters
- accept / decline
- check in on arrival
- care task creation/completion
- family care updates
- shift checkout
- conduct reporting
- completed-job earnings summary
- editable caregiver profile, work type, shifts, rate, experience and availability

### Account / security
- profile photo resize/compress/upload to D1 media
- session list/revocation
- sign out all devices
- password change (revokes all sessions)
- secure local bearer-token storage

### Organization
- pending organization application status
- approved organization overview and booking history
- caregiver roster
- caregiver account provisioning with one-time activation token
- organization service creation/retirement
- organization profile editing

Superadmin safety, account-restriction and platform-approval actions intentionally remain on the secured web dashboard for this milestone; they are not duplicated as an under-tested privileged mobile surface.

## Run

Node 22.13+.

```bash
cd mobile
cp .env.example .env
npm install
npm run doctor
npm run typecheck
npm start
```

For a physical device, keep the production Worker URL or use a staging URL reachable from the device.

## Backend source of truth

The mobile app follows:

- `docs/MOBILE_API.md`
- `docs/openapi.json`
- `docs/CLOUDFLARE_AUTH.md`
- `src/d1Client.js`
- `src/bookingService.js`
- `src/bookingValidation.js`
- `src/careSessionService.js`

The Worker remains authoritative for authorization, roles, current caregiver/organization safety state, pricing, booking transitions and all D1 writes.
