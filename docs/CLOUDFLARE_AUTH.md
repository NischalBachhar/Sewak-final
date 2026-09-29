# Cloudflare authentication

The web app and Worker use no Firebase runtime SDK, token validation, UID lookup or Google network request. Original Firebase snapshots, rules and application IDs remain rollback artifacts; they do not grant access to a new account. The eight legacy Auth accounts are not imported. New identities have random `usr_` IDs, even when an email matches legacy data.

## Passwords and sessions

Passwords are 12–128 characters and use versioned scrypt with N=32768, r=8, p=3, a random 32-byte salt and 64-byte result. Comparisons are timing-safe. This is the [OWASP 32 MiB scrypt configuration](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). A private `PasswordHasher` Durable Object performs native scrypt without storing passwords, hashes or sessions. D1 holds all durable authentication state. This separates password CPU work from the Free HTTP Worker's 10ms budget; [Durable Objects allow 30 seconds by default](https://developers.cloudflare.com/durable-objects/platform/limits/) and SQLite-backed classes are available on Free. Billing is not upgraded.

Sessions contain 256 random bits. Only SHA-256 token digests are stored in `cf_sessions`. Absolute lifetime is seven days; idle lifetime is one day; activity updates are coalesced to five minutes. Each session is bound to its Worker audience, cookie/Bearer transport and current credential version. At most ten active sessions are retained per account. Roles and suspensions come from current D1 rows on every request. Application write transactions recheck session validity and every authorization record version atomically.

Web sessions use a host-only Secure, HttpOnly, SameSite=Lax cookie. JavaScript receives a CSRF token, never the session credential. Unsafe cookie requests require exact Origin plus a matching CSRF header; browser cross-site requests fail. Native mobile sessions use Bearer tokens, issued only when Origin, Cookie and Sec-Fetch-Site headers are absent. Mixed cookie/Bearer requests fail. CORS is not authentication. Tokens must not enter URLs, logs, analytics or localStorage.

Login/activation/password-change limits persist in D1: 30 attempts per IP and operation per 15 minutes; login/change-password also use ten per normalized email. Registration permits ten per IP/hour; bootstrap five per IP/hour. Failed passwords count. Unknown login emails receive a real-cost dummy hash check and the same credential error. Rate-limit failures return 429; storage/compute failures fail closed.

## Roles and recovery

Public registration creates only `user` (customer). An organization application requires approval before `orgadmin` access. Organization admins invite their own caregivers. Only a superadmin may provision organization or superadmin accounts. Invitations are random, stored hashed, expire after one day, and are consumed atomically. Activation sets the password, increases credential version and revokes prior sessions. No password is assigned or emailed by an administrator.

Recovery currently uses a manually delivered one-time invitation, issued by a recently signed-in superadmin. There is no automatic reset email service or email ownership verification claim. Deliver the invitation only after independently verifying the intended recipient. Password changes require the current password and revoke every session. Account safety actions disable credentials and revoke sessions, including caregivers in a blocked organization.

The first production superadmin is reserved for `nischalbachhar9@gmail.com`. A guarded operator seeds one hashed, expiring bootstrap token. The user opens `/account/setup?mode=bootstrap#token=...` and chooses a password. The page removes the fragment immediately. The token never enters HTTP URLs or the repository. Bootstrap is email-bound and transactional, and cannot succeed twice or when an active Cloudflare superadmin already exists. Never send a password through chat.

## Maintenance and environments

`APP_WRITES_ENABLED=false` blocks application commits, provisioning, organization applications, booking/actions and image writes. Registration, login, own basic onboarding, password changes and revocation remain available to verify authentication. Those explicit auth flows create only new account/profile/session state; they never adopt or mutate preserved legacy records.

`wrangler.toml` targets isolated staging databases and audience `sewak-staging`. `wrangler.production.toml` targets `sewak-db`, `sewak-media`, and audience `sewak-production`. A staging session cannot authenticate to production. Worker assets serve the same-origin web app. Runtime Firebase secrets are absent from both Workers after successful Cloudflare Auth verification.

## Verification boundary

Unit tests cover UI session races and registration. SQLite tests exercise authorization, IDOR, CSRF, expiry, revocation, invitations, role enforcement and rate limits. The workerd test uses actual D1 and Durable Object bindings for scrypt/register/login and binary media. Browser tests use synthetic accounts with the real Worker auth implementation and exact production CSP, and assert zero Firebase network requests.

For media, the isolated server labels each response with a request ID, byte length and SHA-256. Instrumentation reads the actual application's Blob/ArrayBuffer before `URL.createObjectURL`, compares its bytes and digest with the server, verifies decoded pixels and separately verifies authenticated HTTP 200/image Content-Type. Playwright DevTools body capture may be empty even when the application consumed the entire body; trace/network size and application byte checks remain mandatory. No Content-Length or weakened CSP is required.

Remote staging and read-only production gates are recorded separately; local passes alone do not authorize opening production writes.
