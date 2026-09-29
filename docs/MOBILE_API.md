# Sewak mobile API

Production base URL: `https://sewak-final.nischalbachhar9.workers.dev`.
Staging: `https://sewak.nischalbachhar9.workers.dev` (separate D1 and sessions).
Machine-readable contract: [openapi.json](openapi.json). Authentication implementation: [CLOUDFLARE_AUTH.md](CLOUDFLARE_AUTH.md).

Use HTTPS JSON. Native registration/login/activation must include `sessionMode: "bearer"` and must not send Origin, Cookie or Sec-Fetch-Site. Store the returned opaque `token` in the OS keychain/keystore. Send `Authorization: Bearer <token>` on later calls. No Firebase SDK, Firebase UID, Google token or client-supplied role is needed. Do not combine cookie and Bearer authentication. Never log tokens/passwords.

```json
{"email":"person@example.com","password":"a password chosen by the user","sessionMode":"bearer"}
```

Send this to `POST /auth/login`. `POST /auth/register` also requires `name`. Successful responses include `user` (`id`, compatibility `uid`, `email`, `displayName`, `role`, `profile`), `session` (`id`, `expiresAt`, `transport`) and `token`. Customer role is `user`; other server roles are `caregiver`, `orgadmin`, `superadmin`. Registration never accepts a role field.

| Endpoint | Method | Purpose / JSON |
|---|---|---|
| `/auth/me` | GET | Current user/session; anonymous returns `user:null`; invalid/expired credentials return 401 |
| `/auth/logout` | POST | `{}` revokes current session |
| `/auth/sessions` | GET | List own active session metadata, never credentials |
| `/auth/revoke-sessions` | POST | `{"all":true}` or `{"sessionId":"..."}`; only own sessions |
| `/auth/change-password` | POST | `currentPassword`, `newPassword`; revokes all sessions; sign in again |
| `/auth/activate` | POST | `token`, `password`, `sessionMode:"bearer"`; one-time admin invitation/recovery |
| `/auth/complete-registration` | POST | `name`, `selectedRole:"user"` or `"orgadmin"`; organization applications also require `organizationName` and later approval |
| `/api/health` | GET | `healthy`, `writesEnabled`, `auth:"cloudflare-d1"` |
| `/api/records/{resource}/{id}` | GET | Read one record under server authorization |
| `/api/query` | POST | Bounded resource query; see OpenAPI and schema docs |
| `/api/commit` | POST | Atomic validated application writes; see below |
| `/api/actions/{operation}` | POST | Named role-protected workflow action |
| `/api/profiles/{uid}/image` | PUT / DELETE | Bounded image/webp or image/jpeg bytes / remove own or authorized profile image |
| `/api/media/{id}` | GET | Authorized media bytes (approved public caregiver media may be public) |

Auth routes also have `/api/auth/...` aliases. Web clients use the same-origin HttpOnly cookie and `X-CSRF-Token` from login or `/auth/me` for unsafe requests. Mobile Bearer calls do not need CSRF headers. Treat 401 as requiring login, 403 as denied access, 409 as a conflict requiring refresh, 429 as a rate limit, and 503 as maintenance/unavailable. Errors are `{ "error": { "code": "...", "message": "..." } }`. Honor Retry-After. Do not automatically retry non-idempotent writes.

Application resources preserve existing data contracts: `users`, `vendors` (caregivers), `organizations`, `services`, `bookings`, `reviews`, reports and role-specific workflow resources. See [D1_SCHEMA.md](D1_SCHEMA.md) for fields. Query filters and allowed fields are implemented in `worker/src/queries.ts`; all ownership/tenant/role checks are server-side. Client IDs and filters never grant access. Sensitive tables such as `cf_credentials` and `cf_sessions` cannot be queried through the records API.

Booking creation uses `POST /api/commit` with a `writes` array. Entries have `path`, `kind` (`set`, `update`, `delete`) and `data`; server validation rechecks prices, tenant ownership, availability and transition rules. Use the UUID-based booking ID and stable request fingerprint contract from `src/bookingService.js` for safe duplicate submission. Do not construct prices or role assignments as authority. The exact same Worker endpoints serve web and mobile.

Images must be JPEG or WebP, at most 200,000 bytes, dimensions at most 512 pixels, and metadata stripped before upload. Fetch private images with the session token, decode the returned bytes, and keep them in private cache scoped to the signed-in user. Clear private views/media on account switch or logout.

While `writesEnabled:false`, auth and private reads work but application workflows return 503. Existing dummy Firebase accounts are deliberately unusable: users must register or accept a Cloudflare invitation. No automatic password-reset email service is configured; contact a verified administrator for a one-time recovery invitation.
