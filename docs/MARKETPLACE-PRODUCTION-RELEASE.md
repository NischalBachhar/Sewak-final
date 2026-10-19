# Marketplace production release - 19 October 2026

## Scope and baseline

The release checkout starts at merged PR #43, `8c5875faa90e500f73e9f4f81821912d182602f3`, and preserves its Sewak care marketplace design. The primary checkout's existing auth/notification work is excluded and preserved.

Production baseline inspected: Worker `sewak-final`, account `860970f755498a4fe10e16c2fa99ce55`, version `95c441b9-c1c9-433a-8aa1-3a9302d15c6a`, 100% traffic. DB, MEDIA_DB and EVIDENCE_DB bindings match `wrangler.production.toml`; application writes and the existing Cron are enabled. Existing verification encryption secret is present. No external delivery configuration is enabled.

## Changes in the deployed release

- Recipient-owned booking reminder preferences with durable D1 storage. Mark-read actions refresh the unread bell; pending requests are guarded against updates from a previous account.
- Nepal date boundaries for time off, caregiver upcoming care, weekly calendar and notification/message timestamps, independent of the device or server timezone.
- Original muted MP4 included as a small versioned asset. Public and signed-in media can be paused, preserve a static fallback and avoid mounting video for reduced motion.
- Compact customer discovery layout retaining every filter, shortlist action, job link and membership preview link; family registration is explicit on Get started.
- Superadmin account list and audit log with bounded pagination. Blacklisting and name-confirmed tombstone deletion preserve bookings, messages, reviews and audit evidence while revoking credentials and sessions.
- Atomic, audited caregiver approval updates listing and user approval together, without granting verification badges.
- Additive migration planner/operator validates complete filenames, existing journal hashes, backups and fresh version-matched auth/integrity evidence. The guarded deploy operator refuses a missing marketplace schema.
- Windows unit-test discovery is reliable; CI no longer silently passes when no tests are found. Compatible dependency fixes and patched Worker QA tooling preserve the existing application architecture.

## Database recovery and migration plan

Private evidence is in `.local-tools/backups/backup-evidence.json`. SQL dumps must remain local; they contain private application data and credential hashes.

| Binding | Recovery evidence |
| --- | --- |
| DB | SQL export SHA256 `1a312ae7293e2b25e42cccdafe024a7d8140413bf5235a176cf46e426e32b09d`; restored successfully into isolated SQLite; Time Travel bookmark recorded |
| MEDIA_DB | SQL export SHA256 `58893978207d3b68925e9e2ba85b6b4813bb686f78ed683be7713ee42bdcd82c`; restored successfully into isolated SQLite; bookmark recorded |
| EVIDENCE_DB | Bookmark `00000026-00000000-00005109-84f0151eacf4d9728bbcafa1bee59d5a`; SQL export returned a Cloudflare internal error. No evidence migration is planned. |

The seven additive migrations applied at 10:06 UTC are `0007_care_jobs.sql`, `0008_care_messages.sql`, `0009_care_notifications.sql`, `0010_caregiver_time_off.sql`, `0010_membership_demo.sql`, `0011_caregiver_weekly_hours.sql`, and `0012_notification_preferences.sql`. The offline restored-backup rehearsal and the actual production migration both preserved every preexisting application row and passed foreign-key checks. Historical migration files and recorded hashes were not changed; completed schemas were not reapplied. The public JSON release record includes each new recorded hash.

Read-only plan: `node scripts/migrate-marketplace.mjs`.

Authorized apply, after all release checks: `node scripts/migrate-marketplace.mjs --apply --auth-qa PATH_TO_CURRENT_AUTH_QA`. It checks local SQL backup hashes, restore evidence, recovery bookmarks, active version and both QA reports, journals each migration atomically, compares hashes of preexisting application tables and verifies all three D1 databases.

## Validation and release status

Production was actually deployed through guarded `deploy:cloudflare` from source commit `52e03c0a9817e335023a37cea60246be6652f7c8`. Activated Worker version: `3edd2923-6643-4f57-9bff-1942de974f74`. Live URL: https://sewak-final.nischalbachhar9.workers.dev . Post-upload settings and version bindings match the pinned production configuration, writes remain enabled and the existing 15-minute Cron is retained.

Fresh post-deployment integrity passed on all three databases with zero foreign-key violations. Registration-based production auth QA passed 54 checks on the activated version, including real browser cookie login/session restoration, four-role authorization, private media, CSRF, password/session revocation and synthetic cleanup. Preexisting application/media records remained unchanged. The first post-deployment attempt hit the existing registration IP limit, cleaned its two identities, and was rerun successfully after natural expiry; no limiter was cleared or weakened.

Controlled live marketplace QA passed 28 API checks, verified byte-identical original MP4 delivery, and captured 25 public/authenticated screenshots across 320, 390, 768, 1440 and 1920 pixels without overflow. It covered private messages/inbox, cross-role rejection, notification read state and preference isolation, demo membership and admin permissions. All unpublished fixtures were removed and every preexisting application table hash matched. Live organization moderation verified approval, rejection, name-confirmed deletion, queue/count persistence and analytics with zero page errors; exact synthetic cleanup passed and four new audit entries were retained. These checks used unpublished identities and a closed test booking. Real booking creation, acceptance/cancellation and overlap rejection were exercised locally in D1/workerd and browser journeys; no test request was sent to a real caregiver.

Full private evidence and screenshots are under `.local-tools/cloudflare-auth/`. The sanitized summary is `MARKETPLACE-PRODUCTION-RELEASE.json`. Evidence must be regenerated after any later deployment or expiry.

Release candidate typecheck and lint pass. Frontend tests: 105 passed. D1/workerd regression tests: 163 passed. Complete browser/axe suite: 166 passed, including all four roles at 320, 390, 768, 1440 and 1920 pixels. The final customer hero contrast correction passed 10 follow-up video/responsive checks. Production build with the exact canonical origin, guarded Cloudflare dry run, and offline release guard checks pass.

The follow-up's PowerShell wrapper returned nonzero while redirecting Node color/experimental warnings to stderr. Its structured Playwright result was checked separately: 10 expected passes, zero unexpected/skipped tests and an empty errors list; all ten individual results passed.

Security review: runtime dependency audit is zero; full Worker tooling audit is zero. The full frontend development/toolchain audit remains 99 findings (63 high, 33 moderate, 3 low, zero critical). All affected lockfile nodes are development-only and none appear in the 13 reviewed production JavaScript source maps. Complete findings are recorded in `MARKETPLACE-DEPENDENCY-REVIEW.json`; these findings must not be described as a clean full audit.

Workers billing API access returns 403; the owner explicitly confirmed Workers Free is currently selected for the pinned account, allowing the existing guarded `--free-plan-confirmed` attestation. The existing safeguards remain enabled, including comparison against the actual current Worker version immediately before upload. The existing Wrangler login was refreshed after normal OAuth expiry during post-deployment QA. No new account, secret, paid resource or automatic deployment connection was introduced.

All reported validation was executed locally against the checkout or live Worker. GitHub Actions were inspected and updated; they were not separately dispatched for this direct, authorized fast-forward push to `main`. The final documentation/operator-only commit does not alter the deployed frontend or Worker source.

## Operational limits

In-app delivery works without a paid provider. Real email requires an owned verified sending domain, provider account/secrets and delivery/webhook QA. Web Push requires VAPID keys, explicit user consent and browser delivery validation. Neither is activated by this release. Verified online payment credentials and reconciliation are absent, so cash and the explicit demo-only membership remain the supported behavior.

See `CARE_MARKETPLACE_FEATURE_MATRIX.md` for exact supported workflows and limitations. In particular, the shortlist remains per-browser, recurring requests do not generate an unlimited series of appointments, and organization managers cannot silently substitute a different caregiver in a family's existing booking.
