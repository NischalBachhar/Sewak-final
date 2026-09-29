# Sewak

React caregiver platform using a Cloudflare Worker API, D1 application/auth/session data, separate D1 binary profile images, and Cloudflare-only authentication. A private stateless Durable Object computes secure scrypt hashes within the Free plan. Customer, caregiver, organization and superadmin flows are retained. Images are compressed to at most 512 x 512 and 200 KB, without R2 or paid image processing.

**Cloudflare-only auth is deployed to production with D1 writes enabled.** Production is [sewak-final.nischalbachhar9.workers.dev](https://sewak-final.nischalbachhar9.workers.dev); isolated staging is [sewak.nischalbachhar9.workers.dev](https://sewak.nischalbachhar9.workers.dev). Production Auth and controlled profile/media write tests pass. The original 18 application records and rollback snapshots are preserved. Firestore remains frozen. The eight Firebase test accounts are not migrated. Workers Free remains selected. No Firebase login, signing key or policy exception is required by the new architecture. Shoe Doctor is excluded.

Start with [the migration runbook](docs/FIREBASE_TO_D1_MIGRATION.md), [validation](docs/MIGRATION_VALIDATION.md), [audit](docs/FIREBASE_TO_D1_AUDIT.md), [main schema](docs/D1_SCHEMA.md), [media schema](docs/D1_MEDIA_SCHEMA.md), [image pipeline](docs/PROFILE_IMAGE_PIPELINE.md), [Free limits](docs/D1_FREE_TIER_OPTIMIZATION.md), and [rollback](docs/MIGRATION_ROLLBACK.md). Earlier reports are historical.

## Local verification

Use Node 22.18+ for operator/SQLite tests and installed Chrome for browser journeys. The legacy Functions runtime still targets Node 20. On Windows use `npm.cmd`.

```powershell
npm.cmd ci
npm.cmd --prefix worker ci
npm.cmd --prefix functions ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit -- --silent
npm.cmd run test:d1
npm.cmd run test:browser
npm.cmd run build:release
```

Browser tests use real Cloudflare session/password logic with synthetic SQLite records and zero Firebase requests. Actual workerd integration tests separately verify real D1/Durable Object bindings and binary images. Always rebuild the release after local browser tests.

`npm run dev:worker` serves the built app/API. Follow the runbook to initialize its local D1 databases; Wrangler and the migration harness use separate state. Never seed synthetic fixtures into production. Legacy rules/backend tests exercise retained Firebase rollback/reference code.

## Hosting and configuration

`wrangler.toml` targets isolated staging. `wrangler.production.toml` targets production `sewak-final` with `sewak-db` and `sewak-media`. The guarded deploy command selects the matching configuration, checks the exact Sewak account and Free plan, and requires reconciliation/Auth evidence before production cutover. Web API requests remain same-origin. Never put secrets in `REACT_APP_*` variables.

Set `REACT_APP_CANONICAL_ORIGIN` to the reviewed public HTTPS origin before a release build. Without it the build deliberately omits canonicals and sitemap URLs. Browser metadata is route-specific; the served SPA document has generic public metadata. Private routes receive HTTP noindex headers on the configured hosts. Individual caregiver social cards and true HTTP 404 responses require additional host rendering/routing work; client-side metadata alone does not provide these.

Account administration uses D1 roles, hashed one-time invitations, server revocation and opaque sessions. The first real owner is email-bound to `nischalbachhar9@gmail.com` and chooses a password through one-time setup. See [Cloudflare Auth](docs/CLOUDFLARE_AUTH.md), [mobile API](docs/MOBILE_API.md) and [OpenAPI](docs/openapi.json). Legacy Firebase tools are rollback/operator references only; do not run their key creation or old cutover instructions.

Cash booking remains supported; Fonepay stays disabled pending its pre-existing provider integration. Cross-device care/booking updates refresh every 60 seconds while visible and on focus/reconnect. The migration runbook records deployment, verification, rollback and Firebase-retirement status. Development for future mobile clients should target this Cloudflare backend.
