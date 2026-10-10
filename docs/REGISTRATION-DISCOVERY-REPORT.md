# Registration, organization onboarding and caregiver discovery

Implementation and release: October 10, 2026. **Migration 0004 was applied and verified on staging and production. Application commit `8cac233` is pushed to `release/registration-discovery` and deployed to `sewak-final`, version `03997726-a043-4332-98d7-f570d7555959`.** Existing production records were preserved. Live organization onboarding, profile persistence, authorization and responsive filter smoke checks passed, with disposable QA records cleaned up.

## Root causes and fixes

| Issue | Root cause in the repository | Implemented behavior |
| --- | --- | --- |
| Organization signup acts like a customer | `register` discarded the selected role and always created `user`. `complete-registration` only created an application; approval later created the organization and changed the role. | Public registration accepts only `user` or `orgadmin`. Credentials, session, owner role, organization, application and audit entry commit atomically. Organization owners land on organization onboarding immediately, with approval still required for restricted marketplace actions. |
| Empty service choices and incomplete profiles | The database schema had a catalog and normalized caregiver links, but no shared catalog seed. The caregiver editor omitted service assignments, self-editing was forbidden, and the organization management list loaded only its private services. | Migration 0004 seeds missing global services in the existing catalog. Shared selectors work in signup, organization settings, caregiver self-editing and authorized organization/admin editing. Existing assignment and booking validation are reused. |
| Limited/incomplete rating filtering | The UI hardcoded only 4.0/4.5. Browse downloaded and filtered all pages locally, capped at 1,000 records. Public averages trusted verified/hidden flags without rechecking the booking relationship. | Thresholds 1, 2, 3, 4 and 5 use authoritative eligible review averages in SQL, alongside the other filters. Results have a complete match count and 12-record cursor pages. |
| City = Other cannot be entered | Profile selects stored the literal option; there was no conditional field or shared server validation. The organization page also reloaded organization fields from the user record instead of the organization record. | A shared CitySelect reveals a required custom input, restores saved custom cities, and includes the additional requested Nepal cities. Server validation trims/normalizes whitespace, bounds length, requires letters and rejects HTML/control characters and literal Other. Organization editing reads the correct record. |

Read-only production queries before release confirmed zero catalog services and two pending organization applicants whose user role was still `user`. Migration 0004 subsequently added the catalog and `organization_services` table. No malformed caregiver service arrays or foreign-key violations were found, and `quick_check` passed. The findings above combine source inspection, local database/API tests and aggregate production observations. The two historical applicants were not automatically converted or approved.

## Organization account lifecycle

Before: signup → customer identity → separate pending application → customer profile → role conversion only on approval.

After: signup → one organization owner identity (`orgadmin`) plus linked organization and pending application → organization onboarding → pending dashboard → existing Sewak approval workflow → permitted caregiver management. Refresh and subsequent login load the persisted role from D1; no client role claim is trusted. Invalid organization details create no partial identity, credential, organization, application or session.

The flow collects organization name/type, custom type when Other is selected, contact name/email, phone, city/address, service IDs, optional registration number and PAN/VAT. A pending owner can edit their own details and change their password. They cannot provision or publish caregivers, approve themselves, change ownership, or access another organization. Existing pending/approved and suspension rules remain in use; no separate role or dashboard system was created.

The organization dashboard now opens the existing caregiver editor for its own roster. That editor supports service assignments, public city, category, work type, shifts, availability, price and experience. Self-editing caregivers have the same service selector. Profile and companion user updates use atomic batches. Caregiver approval remains a Sewak operation, separate from organization approval.

Existing independent caregivers remain readable/bookable under the existing rules. **Public independent-caregiver signup remains a product gap**; this change does not invent that account type. Existing staff provisioning/invitation workflows remain in place.

## Catalog and booking rules

The migration adds missing shared entries without overwriting an existing ID or an existing global service with the same display name. It does not assign any new service to an existing caregiver or invent prices.

| Category | Available shared options |
| --- | --- |
| Caregiver Support | Elderly Care; Elderly Companionship; Child Care / Babysitting; Newborn Care (Nonmedical); Patient Care / Attendant Support; Post-Hospital Assistance (Nonmedical); Disability Support; Personal Care Assistance; Mobility Assistance; Daily Living Assistance |
| Household Support | Housekeeping; House Cleaning; Cooking / Meal Preparation; Laundry / Ironing; General Household Assistance; Live-in Household Help |
| Professional nursing — disabled | Home Nursing; Wound Care; Medication Administration; Other Licensed Nursing Services |

Nursing entries are inactive with a credential-required marker. Worker policy also blocks medical service publication, assignment, discovery and booking until credential/availability infrastructure is implemented. Existing or custom medical labels are guarded as well. A healthcare organization type alone grants no nursing booking permission.

Categories retain the existing `caregiver` / `vendor` (`household` alias) / `both` semantics. Changing the browse category clears incompatible selected services. At most 20 actual service IDs can be assigned; the server validates ownership, active state and category and checks catalog versions atomically. Retirement/category changes cannot leave assigned services invalid. Grouped catalog version guards keep 20-service writes within the existing request budget.

Cards show two configured service tags and an overflow count, or “Services not specified.” Public service assignments come from valid active catalog relationships. Cards show real verified review counts and an explicit unrated state, derive jobs completed from completed bookings, use the current organization name, and show only supported stored prices. Booking continues to verify the caregiver's offered service, availability, schedule, recurrence, price and commission on the server. Sign-in retains the intended caregiver ID.

## Reviews, search and cities

A public/eligible review must have `isVerifiedReview=true`, not be hidden, have a rating between 1 and 5, and reference a completed booking with the same caregiver and customer. Public review listings and rating averages share this rule. Deleted reviews are absent; hidden or mismatched/incomplete-booking reviews do not count. No fake review, default five-star rating or review count is added.

Thresholds compare the **unrounded arithmetic average**. A 4.96 average displays as 5.0 to one decimal but does not qualify for the exact maximum threshold of 5.0. Unrated profiles remain in Any verified rating and are excluded from positive thresholds. Jobs completed count completed bookings independently of reviews.

Name/public-location search, category, service, part/full-time aliases, supported shift, location, minimum years of experience, minimum rating and Sewak verification combine with AND semantics in parameterized SQL. Search never uses private residential or organization street addresses. The browse listing retains only available and approved caregivers with active organizations. Clear All resets local and parent/dependent filters. Match counts are computed before pagination; pages do not download the full roster.

CitySelect is used by customer profiles, caregiver editors, organization signup/settings and booking addresses. The city value remains in the existing string field; unknown cities reopen with Other and their actual text. Legacy literal Other values are preserved in storage until corrected, but cannot be newly saved. Cancelling the caregiver editor leaves the persisted city unchanged. Search accepts saved custom city text.

## Database changes and safe repair

`migrations/main/0004_catalog_onboarding.sql`:

- Adds catalog rows with conflict/name checks; nursing rows remain inactive.
- Reuses `caregiver_services`; backfills only existing valid IDs from `caregivers.services_offered`.
- Adds `organization_services` with organization/service foreign keys, a composite primary key and service lookup index.
- Adds the eligible-review lookup index.
- Stores unindexed organization metadata in the existing `extra_json` extension mechanism; no destructive table recreation or account conversion.

The migration is rerunnable and was exercised against SQLite and actual workerd D1 bindings. Local `npm.cmd run d1:local` applied the auth and catalog migrations successfully; its previous sentinel logic incorrectly skipped every later main migration once `users` existed, which is now corrected.

Historical customer-role applicants are **not automatically converted**. The production aggregate audit found two such pending applicants. An authorized administrator can inspect this read-only query privately:

```sql
SELECT u.id, u.role, a.status, a.organization_name
FROM users u JOIN organization_applications a ON a.applicant_id=u.id
WHERE u.role='user' AND a.status='pending';
```

An administrator must verify each applicant and use the existing **Approve application** action. `approveOrganizationApplication` validates the linked application and account, updates the organization/user/application atomically, and records `organization_approved` in the audit log. Ordinary customers without a verified application are untouched. Approval grants marketplace access, so this is an approval decision, not an automatic data repair. Local tests cover this legacy path and customer preservation.

## Validation evidence

| Check | Result |
| --- | --- |
| Lint | Passed, no lint findings. Existing Browserslist age notice remains. |
| Worker TypeScript | Passed. |
| Frontend unit tests | 38 passed in 11 suites. |
| D1/security/workerd suite | 39 passed, including new onboarding, discovery, migration, tenant and service-race checks. |
| Browser E2E | All 50 scenarios passed across the full run and targeted retry. Full run: 48 passed, two browser timeouts during the interrupted session; both 375px/390px discovery checks passed on retry. Earlier old-contract signup assertions were updated for the requested account behavior. |
| Responsive checks | 320, 360, 375, 390, 414, 430, 768, 1024 and 1440px for signup and discovery; existing role-route checks also cover 1366/1920px. Chromium viewport testing, not a physical iPhone/Safari certification. |
| Local migrations | Passed; SQLite rerun/data-preservation and workerd D1 foreign-key checks passed. |
| Production build / Worker dry-run / release scan | Passed. Production assets compiled; `sewak-final` dry-run bundled successfully without publishing. Release scan passed: 310 repository files, zero Firebase runtime references and zero private credential matches. |
| Remote staging migration | Passed: 24 statements executed against `sewak-staging-db`; 20 catalog rows (10 active caregiver, 6 active household, 4 inactive nursing), new organization-service table, zero foreign-key violations and `quick_check=ok`. Existing counts preserved: 2 users; 0 organizations, caregivers, bookings and reviews. |
| Production migration and deployment | Passed through the guarded operator. Existing counts preserved: 14 users, 3 organizations, 2 caregivers, 2 bookings and 0 reviews; catalog now contains 20 rows. Both main and media D1 integrity checks passed. Exact production bindings and active 100% version were verified. |
| Live feature smoke | Passed: customer/organization registration, persisted owner role, pending approval, service links, cross-account denial, role/self-approval rejection, invalid-city rejection, combined search, browser profile save/reload and public rating filters at 320/390/1440px. Disposable records cleaned up. First attempt returned a transient signup 503 with no partial records; subsequent signups passed. A test-only browse timeout was corrected by testing public filters in a signed-out session. |

Security regression tests cover public role escalation, protected profile fields, tenant reads/writes, cross-organization assignments, medical-service restrictions, server booking quotes, completed-booking review eligibility, atomic rollback, optimistic conflicts, cookie CSRF, session revocation/expiry/audience, rate limits, password hashing/change, private media and deployment guards. Browser journeys assert zero Firebase requests. Existing customer booking → caregiver acceptance/start/completion → verified review, cancellations and organization historical-booking access passed.

## Deployment sequence

Run from the repository root in PowerShell. Cloudflare login was refreshed successfully for this task. Staging and production migration/deployment steps were completed; these commands document the sequence for reproducibility. Keep the production Git integration and existing security gates unchanged.

```powershell
node worker/node_modules/wrangler/bin/wrangler.js login
$env:CLOUDFLARE_ACCOUNT_ID='860970f755498a4fe10e16c2fa99ce55'

# Apply only this additive migration to isolated staging after checking bindings.
node worker/node_modules/wrangler/bin/wrangler.js d1 execute sewak-staging-db --remote --config wrangler.toml --file migrations/main/0004_catalog_onboarding.sql
node worker/node_modules/wrangler/bin/wrangler.js d1 execute sewak-staging-db --remote --config wrangler.toml --command "PRAGMA foreign_key_check; PRAGMA quick_check; SELECT COUNT(*) FROM organization_services; SELECT COUNT(*) FROM services WHERE id LIKE 'catalog_%';"
```

Staging is configured read-only. Keep that guard intact. The migration can be validated directly in staging D1, but staging registration/profile-write E2E requires a separately reviewed staging write-test configuration; the current deployment policy deliberately disallows simply opening writes on `sewak`. Local write E2E uses isolated test databases with the real Worker authentication and policy code. Do not treat local passes or a successful schema migration alone as a remote write-E2E pass.

After staging validation, record a current Cloudflare Time Travel recovery bookmark and apply only the additive new migration before deploying the new Worker. Older migrations may already have been applied outside Wrangler's migration ledger; do not blindly replay all migrations. Automatic approval review rejected a full local database export because it could copy private records and credentials. This release instead recorded the existing Cloudflare recovery bookmark without exporting database contents.

```powershell
node worker/node_modules/wrangler/bin/wrangler.js d1 time-travel info sewak-db --config wrangler.production.toml --json
node worker/node_modules/wrangler/bin/wrangler.js d1 execute sewak-db --remote --config wrangler.production.toml --file migrations/main/0004_catalog_onboarding.sql
node worker/node_modules/wrangler/bin/wrangler.js d1 execute sewak-db --remote --config wrangler.production.toml --command "PRAGMA foreign_key_check; PRAGMA quick_check;"

npm.cmd run build:release
npm.cmd run deploy:cloudflare -- --worker sewak-final --dry-run
node scripts/scan-release.mjs
node scripts/verify-cloudflare-data.mjs
```

Production deployment requires current production Auth QA and the guarded workflow in `docs/DEPLOYMENT.md`; do not substitute local test results or bypass its gates. The older `verify-cloudflare-auth.mjs` is a maintenance/read-only runner. This release used the existing write-enabled operator `.local-tools/login-release-auth-qa.mjs`, which ran fresh real-cookie login/restoration tests, checked the active version/bindings and verified disposable-account cleanup. The owner confirmed Workers Free because the billing API was inaccessible. The successful deployment command was:

```powershell
npm.cmd run deploy:cloudflare -- --worker sewak-final --validation .local-tools/cloudflare-auth/cloudflare-data-check.json --auth-qa .local-tools/cloudflare-auth/web-login-release-qa.json --free-plan-confirmed
```

After deployment, verify real organization signup/refresh/login, pending restrictions, owner profile persistence, actual caregiver service assignment/filtering, booking service enforcement, review thresholds and custom-city search. Existing caregivers need their owners to configure actual services; seed data does not infer skills. Medical bookings remain disabled. If application rollback is necessary, revert the Worker/assets while retaining the additive schema and historical records; do not drop the new tables or delete bookings/reviews.

## Changed files

The accompanying Git diff is the source of truth. Complete changed/new path list:

```text
docs/CLOUDFLARE_AUTH.md
docs/D1_SCHEMA.md
docs/REGISTRATION-DISCOVERY-REPORT.md
docs/openapi.json
migrations/main/0004_catalog_onboarding.sql
scripts/generate-d1-schema-doc.mjs
scripts/generate-openapi.mjs
scripts/local-d1.mjs
scripts/serve-d1-test.mjs
src/App.js
src/AuthPage.js
src/BookingFormPage.js
src/CaregiverDashboardPage.js
src/CaregiverListPage.js
src/OrganizationDashboard.js
src/OrganizationProfilePage.js
src/PasswordChangeModal.js
src/PublicCaregiverProfilePage.js
src/SignupPage.css
src/UserProfilePage.js
src/authClient.js
src/components/CaregiverEditor.js
src/components/NepalCitySelect.js
src/components/NepalCitySelect.test.js
src/components/OrganizationFields.js
src/components/ServiceSelector.js
src/index.css
src/registrationService.js
tests/browser/journeys.spec.cjs
tests/browser/signup-ui.spec.cjs
tests/browser/zz-discovery.spec.cjs
tests/d1/discovery.test.mjs
tests/d1/harness.mjs
tests/d1/security.test.mjs
tests/d1/workerd.test.mjs
worker/src/actions.ts
worker/src/catalog.ts
worker/src/cloudflare-auth.ts
worker/src/onboarding.ts
worker/src/policy.ts
worker/src/queries.ts
worker/src/repository.ts
```

## Completion status

Implementation, commit/push, local validation, staging/production migration, guarded deployment and live feature verification are complete. Staging application writes remain disabled; no remote staging write-E2E pass is claimed. Production verification used only disposable identities and verified cleanup. `git diff --check` passes.

- Application commit: `8cac233221255d0386d084b2d55c1b09675a2d38`, branch `release/registration-discovery`.
- Live URL: https://sewak-final.nischalbachhar9.workers.dev
- Production version: `03997726-a043-4332-98d7-f570d7555959`.
- Pre-migration production recovery bookmark: `0000004a-00000017-00005100-cd204da40d2a4d63ca50902907b85308`.
- Production migration bookmark: `0000004a-00000023-00005100-bfb1d298e7ddce03960e57e683efdd68`.
- Staging migration bookmark: `0000000e-0000000e-000050ff-edc72fa5b6492ae21e7da6f02ef176ab`.
- Local private evidence: `.local-tools/cloudflare-auth/registration-release-smoke.json`, `web-login-release-qa.json` and `cloudflare-data-check.json`.

The build emitted existing Browserslist-age and missing canonical-origin notices. Configure `REACT_APP_CANONICAL_ORIGIN` for the intended release hostname if canonical/sitemap output is required. These notices did not fail the build. Physical iPhone/Safari and on-screen keyboard behavior remain manual device checks; automated coverage uses Chromium at the requested viewport widths.
