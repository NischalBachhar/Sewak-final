# Authentication and notifications delivery report

Date: 2026-10-11. Branch: `feature/sewak-auth-notification-system`.

## Implemented features

| Area | Implemented behavior |
| --- | --- |
| Authentication | Pending Gmail ownership verification, server-side protected-service gate, resend cooldown, safe pending-address correction, ordinary 8 to 128 character passwords, confirmation/visibility UI, single-use recovery with session revocation, and preservation of privileged recovery. Existing accounts and bookings remain intact. |
| Google | Configured-only authorization-code OIDC with state, browser binding, nonce, PKCE and verified signed claims. Stable Google subjects identify accounts. Matching email alone never links an existing account. Customer and organization onboarding reuse the existing flow. |
| Email | Real Resend HTTP adapter, branded escaped templates, encrypted durable authentication payloads, transactional outbox, quota reservations, bounded leases/retries and provider idempotency. Submission is `accepted`; only an authenticated delivery webhook establishes `delivered`. |
| In-app | Recipient-scoped common dashboard bell, unread/read state, pagination, authorized links and category preferences. Atomic booking/care/review/application/security notifications, schedule reminders and pending escalation. Confirmation follows authorized caregiver acceptance. |
| Web Push | Explicit browser permission, encrypted owner-bound subscriptions, device listing/removal, standards-based encrypted Web Push/VAPID, endpoint retirement, generic lock-screen text and iPhone Home Screen guidance. No private service-worker caching. |
| Organizations | Existing combined caregiver/household services, pending approval, administrator ownership and tenant authorization preserved. Application and approval notifications use existing mutations. Legacy provider listings without login accounts are not treated as notification recipients. |
| Google Forms | Optional configured-only feedback/partnership links and an installable quota-aware Sheet submission alert example. No medical data prefill, public relay, SMS or WhatsApp automation. |

## Important files

- `worker/src/email-auth.ts`, `cloudflare-auth.ts`, `google-auth.ts`, `secret-box.ts`: credentials, ownership proof, recovery and OIDC.
- `worker/src/delivery.ts`, `notifications.ts`, `email-webhook.ts`, `index.ts`: delivery, inbox, scheduling and HTTP integration.
- `worker/src/repository.ts`: transaction-time verification/session guard.
- `migrations/main/0005_auth_notifications.sql`: new state and atomic event/outbox triggers.
- `src/AccountEmailPage.js`, `accountLink.js`, `AuthPage.js`, `PasswordChangeModal.js`, `components/SignupRegistrationForm.js`: account UI and fragment-token cleanup.
- `src/components/NotificationCenter.js`, `NotificationCenter.css`, `Header.js`, `GoogleSignIn.js`, `ExternalForms.js`: shared dashboard integrations.
- `public/sw.js`, `public/_headers`, `public/index.html`: Web Push and referrer/installation metadata.
- `tests/d1/auth-notifications.test.mjs`, `tests/browser/auth-notifications.spec.cjs`: security and integration regressions; existing suites/fixtures updated for verified accounts.
- `scripts/sql-statements.mjs`, `local-d1.mjs`, `serve-d1-test.mjs`: trigger-safe local migrations and isolated synthetic test harness.
- `.dev.vars.example`, `docs/AUTH-NOTIFICATIONS.md`, `docs/examples/google-form-alert.gs`: safe configuration and operator instructions.
- `worker/package.json`, `worker/package-lock.json`: Worker-compatible JOSE/Web Push dependencies and patched development tools. Root frontend dependencies are unchanged.

## Database changes and status

Migration `0005_auth_notifications.sql` adds nullable `cf_credentials.email_verified_at`, email tokens, OAuth states/identities, notifications, outbox, preferences, encrypted subscriptions, quota/lease state, webhook receipts, indexes, a participant view and domain triggers. Earlier migrations are unchanged. Existing addresses are not falsely marked verified.

Migration validation ran in disposable local SQLite/D1 fixtures and actual workerd, including foreign-key checks and domain/event/outbox rollback tests. No migration was applied to shared staging or production. The browser test server's synthetic mail-inspection endpoint is local-only and is not present in the production Worker.

## Automated validation

| Command | Final result |
| --- | --- |
| `npm run test:unit -- --silent` | PASS: 38 tests, 11 suites. The nested Windows worktree additionally used `--testMatch '**/src/**/*.test.js'` to correct Jest's mixed-separator discovery path; the same 11 suites passed. |
| `npm run test:d1` | PASS: 79 tests, including actual workerd, transaction rollback, expiry/replay, Google callback conflicts, encrypted push and signed delivery webhooks. |
| `npm run typecheck` | PASS: Worker TypeScript. |
| `npm run d1:local` (twice) | PASS: applies local migrations, then detects completed migrations without reapplying. Migration 0005 uses an atomic D1 batch. |
| `npm run lint` | PASS. Non-blocking stale Browserslist data notice. |
| `npm run test:browser` and resumed targeted Playwright run | PASS: all 58 cases. The isolated full run passed 55 cases before session interruption; the remaining 3 passed against the same bundle after updating the final legacy signup fixture. |
| `npm run build:release` | PASS: production-mode frontend bundle. |
| Guarded Worker `--dry-run` and `node scripts/scan-release.mjs` | PASS: local bundle, 347 repository files scanned, zero private-credential matches and zero Firebase runtime references. No deployment. |
| `npm --prefix worker audit --json` | PASS: zero reported vulnerabilities. |
| Root `npm audit --json` | FAIL: 100 findings (4 low, 17 moderate, 76 high, 3 critical) in the unchanged frontend dependency tree. |
| `npm --prefix mobile run typecheck` | Cannot validate locally: native Expo/React Native dependencies are absent, including `expo/tsconfig.base`. Native source is unchanged. Existing PR CI installs and checks these dependencies. |
| `git diff --check` | PASS. |

The final browser suite covers verification/recovery, fragment removal, pending-account API denial, notification settings, all four role dashboards, combined organizations, booking acceptance/start/completion/reviews, tenant history, keyboard interaction and responsive layouts. Provider tests intercept outbound requests; no email or push is sent to real people. Google callback tests use generated signing keys and controlled responses, not real consent credentials.

During validation, the Google async error boundary, legacy recipient foreign keys, mobile header overflow and outdated signup/recovery assertions were corrected. The Windows sandbox initially prevented esbuild from resolving the real Worker; the authorized isolated run passed with the required filesystem access.

Concurrent logout work and a shared frontend rebuild appeared during validation. The rebuild interrupted the shared browser run, so final validation and commit moved to `.local-tools/auth-notifications-review`, an isolated worktree. The logout edits and their test remain in the original checkout and are excluded from this feature commit.

## Security release blocker

The root frontend audit remains unresolved. Critical findings include `proxy-addr` (GHSA-jqcg-44mw-7w3h), `shell-quote` (GHSA-w7jw-789q-3m8p / GHSA-395f-4hp3-45gv), and `websocket-driver` (GHSA-xv26-6w52-cph6 / GHSA-mp7j-qc5w-4988). A dependency being used by development/build tooling does not establish that every finding is harmless. Exact remediation and emitted-bundle review are required before release. No audit suppression, forced major upgrade or weakened CI gate was added. This branch is for review, not an assertion of production readiness.

## External setup still required

Follow `AUTH-NOTIFICATIONS.md` for the complete setup sequence:

1. Separate staging origin and isolated D1 resources; migration 0005, reviewed staging deployment and explicitly authorized staging writes.
2. A Sewak-owned Resend sender domain, provider-specified DNS/SPF/DKIM, reviewed DMARC alignment, restricted API key, sender address and signed delivery webhook secret/URL.
3. A random independent 32-byte base64url outbox encryption key, securely stored and backed up.
4. Google Cloud web OAuth client, consent configuration/test users, exact allowed origin/callback and client credentials. Live callback/consent validation remains required.
5. VAPID keys/contact, explicit desktop/Android browser permissions and compatible installed iPhone Home Screen app; physical-device delivery tests.
6. Review actual Cloudflare/D1/Cron quotas and provider-wide usage, configure a staging Cron Trigger, then enable notification processing after credentials and migrations are ready. No Queue or paid plan is required.
7. Owner-created feedback/partnership Forms and restricted response Sheets, configured URLs/Script Properties, installable submit trigger and an authorized non-sensitive test submission.
8. An explicitly authorized test inbox for real email delivery and authentication-header checks; no live customer data for tests.

No provider secret, DNS record, external account, Cron Trigger or paid upgrade was created. `APP_WRITES_ENABLED` and deployment configurations remain unchanged; the existing production configuration already declares writes enabled. No production write test was performed.

## Free-tier behavior

Resend caps are hard-bounded to 100 daily / 3,000 monthly submissions, configurable downward. Up to 20 daily / 200 monthly are reserved for authentication/security. Quota exhaustion defers email while keeping the in-app event. Shared provider account usage and inbound mail must also fit the provider quota. D1 is the durable queue; processing is conservatively limited to two delivery jobs per minute, with authentication first and no automatic paid overage. High volume needs measured capacity planning.

Retries back off, retain provider idempotency, and stop before its 24-hour retention window. Authentication deliveries expire after 30 minutes. Delivery is at-least-once, and accepted submission is not a delivery guarantee. Push denial/unsupported browsers keep the inbox. Apps Script checks its actual remaining recipient quota and records deferred status; its example is never an authentication provider. Current official quota sources are linked in the setup guide.

## Genuinely remaining work

- Resolve the frontend dependency audit and complete owner-configured staging/live integration tests before release.
- Native Expo screens have not been extended with this web verification/inbox UI; coordinate native client handling of the new verification-required API state before backend rollout. Bearer authentication transport is preserved.
- Rescheduling, recurring visit generation, application information requests and suspicious-login detection have no current authoritative workflow to attach to. No business transitions were invented. Reminders use existing stored booking schedules.
- Authenticated linking of an existing password account to Google is not implemented; matching email fails safely. Optional organization business domains need corresponding frontend policy/validation updates when activated.
- Nepali language preference is stored for future translation; current notification copy is English. Quiet hours are not implemented.
- The optional general Apps Script mail-provider relay is omitted because it cannot offer equivalent provider idempotency. The separate Forms example documents its crash/duplicate limitation.

## GitHub and deployment

Feature branch: `feature/sewak-auth-notification-system`. The final commit and draft PR identify this change. Review base is `feature/secure-superadmin-recovery`, the current checkout's existing parent branch, so earlier unmerged signup/recovery work is not silently included in this feature diff against main.

Local implementation and tests are distinct from staging and production activation. No remote migration, merge or deployment has occurred. All test data is synthetic and confined to disposable local fixtures. A release requires separate authorization and the external validation above.
