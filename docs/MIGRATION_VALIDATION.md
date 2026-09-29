> Historical migration evidence. Firebase Auth was superseded by Cloudflare-only D1 Auth on 2026-09-29. The current deployment and verification state is in [FIREBASE_TO_D1_MIGRATION.md](FIREBASE_TO_D1_MIGRATION.md) and [CLOUDFLARE_AUTH.md](CLOUDFLARE_AUTH.md). Do not run old signing/key-creation instructions.

# Validation checkpoint

## Latest resume - read-only checks PASS, authenticated session BLOCKED

Verified at **2026-09-28T15:05:41.791Z**: exact original 18-record reconciliation, unchanged/frozen Firestore, preserved 8 Auth identities, clean foreign keys/database integrity, zero media, secure inherited key-creation policy, absent temporary signing access, preserved installed credentials and matching rollback backup hashes. Anonymous private profile and forged-token requests returned 401; anonymous private media returned 403. Security headers and exact production bindings passed. Both Workers remain healthy/read-only on their previous versions.

The completed production 67-check/four-role Auth QA is retained and was not repeated. Remaining fresh authenticated checks and controlled production smoke cannot run because the single-verification JWT was discarded and no existing application session/browser is available. No repeat signing, key creation, migration, deployment or data mutation was attempted. Safe next step: normal sign-in with existing Sewak QA accounts in a connected browser; no passwords/tokens in chat. See `.local-tools/cutover-2026-09-28-resume/read-only-checkpoint.json` and the main runbook.

## Single signing verification - PASS, 2026-09-28

Exactly one signing request at **2026-09-28T14:58:10.555Z** returned **HTTP 200** after the two-minute propagation wait. Claims matched; the returned token was discarded without Firebase exchange/sign-in. No key or application/Auth data mutation occurred. The temporary role was deleted at **2026-09-28T14:58:15.572Z**, and independent cleanup passed at **2026-09-28T14:59:29.904Z**: binding absent, signing permission absent, role deleted, API DISABLED, installed keys unchanged, key-creation restriction enforced. Both Workers remain healthy/read-only.

This consumes the single-retry approval. It does **not** complete fresh production Firebase Auth/read-only QA, the controlled write smoke or activation. Production must stay read-only pending those gates and an authorization scope permitting the remaining work. Safe evidence: `.local-tools/cutover-2026-09-28-keyless-retry/signing-verification.json`.

## Earlier keyless signing checkpoint - 2026-09-28

**BLOCKED; production remains read-only.** The approved keyless signing attempt returned HTTP 403 before token issuance or Firebase sign-in. Its temporary grant and custom role were removed, IAM Credentials API was restored to DISABLED, and effective signing permission absence, unchanged keys and enforced key-creation restriction were independently verified. No production activation or new application write occurred. The exact denial cause remains unconfirmed; no matching audit-log entry was available.

The real release rebuild, secret scan, Worker dry run and diff check passed again. Independent safety reconciliation at 14:42:43.109Z confirmed all original 18 records and 8 Auth identities preserved, Firestore unchanged/frozen, no media changes, the QA key absent, and both Workers healthy/read-only. The only added row is the earlier controlled-smoke audit record.

Automatic approval review rejected a subsequent multi-request retry before execution. A narrower **one signing request** retry is prepared and requires explicit approval to restore the same temporary role/grant. See the current migration runbook for exact resources, cleanup and evidence. Earlier gate passes remain recorded below; the final frontend-reflection/logout production smoke is still unfinished.

## Latest media-boundary gate — 2026-09-23

**Credential-free and authenticated staging gates PASS.** Typecheck and lint passed, React 33/33 (9 suites), D1/Worker 24/24, browser 18/18 with zero skipped/flaky. All six responsive role viewports and enforced-CSP Firebase Auth compatibility passed. Fresh staging Auth QA passed 67 checks across all four roles, and its one temporary key was deleted and independently verified absent. Application and Auth hashes were preserved, excluding permitted Auth sign-in timestamps.

For a correlated authenticated image request, server and application Blob/ArrayBuffer each held 360 bytes with the same SHA-256; Playwright body capture was empty while the trace body size was 372. The test now validates the actual application Blob before object-URL creation, independently decodes it and checks the rendered dimensions, while retaining separate HTTP/MIME/authentication and private-access checks. This preserves nonempty image validation without changing CSP or requiring Content-Length. See [the detailed boundary rationale](PROFILE_IMAGE_PIPELINE.md#browser-byte-validation-boundary). Evidence is in `.local-tools/cutover-2026-09-23-media-boundary/`.

Final source freeze was verified at 2026-09-23T15:03:25.495Z. All 39 read grants and helpers were retained; 330 simulated writes were denied, and the deployed source matched the reviewed freeze. Final export and exact remote reconciliation passed for 18 application records and 8 Auth identities, with zero media and no final delta. No initial migration was repeated. On 2026-09-28T09:29:25.227Z, read-only resume verification confirmed unchanged Firebase/D1 data, Auth records, frozen rules, original production version and absence of the deleted QA key.

Production maintenance version `c8301254-32ef-4ddf-b154-79c2d06012d9` passed 19 public checks and 7 browser checks, including six viewport widths, with unchanged data hashes. Production Auth QA then passed 67 checks across all four roles. The key-creation policy was restored and effective enforcement verified. Final release checks passed.

**Earlier production smoke checkpoint: BLOCKED; production returned to read-only.** The controlled smoke test successfully created and authenticated-read an inactive synthetic service in D1, then sent an invalid query limit of 100 (the documented implementation permits 1–50). The correct HTTP 400 stopped the runner before frontend-reflection/logout checks. Cleanup removed only that exact unreferenced service and preserved its audit record; Firestore had no corresponding service. Read-only production version is `c896825e-ae34-4527-8254-8f50d346663a`. The runner is corrected to 50 and the public query passes, and a new authenticated session was needed to finish. The subsequent approved keyless attempt and complete cleanup are documented above. No extra private key was created. Later historical sections are not the current status.

## Earlier media-response gate — 2026-09-23

**BLOCKED; no second temporary key created.** The test-only blob fetch was replaced with Playwright observation of the real authenticated media response, without changing CSP or requiring Content-Length. Fresh typecheck, lint, 33 React tests and all 24 D1/Worker tests passed. Browser results were 17 passed / 1 failed; Auth/CSP and six-viewport role journeys passed in the isolated environment.

The remaining photo test failed at line 135: authenticated GET returned HTTP 200 with image/webp, but `response.body()` was empty. The trace reports bodySize 372 and recorded content size 0. The cause has not been established. Keep the nonempty-byte check; compare server output, the browser's Blob before object-URL creation and the network capture before selecting a fix. The mandatory stop prevented further QA, release rebuild, deployment or key creation. The current build remains demo-emulator and is not deployable.

Remote Cloudflare metadata was read only: original production deployment unchanged and healthy; staging writes false. No remote mutation occurred. Evidence is preserved in `.local-tools/cutover-2026-09-23-media-response/`. Earlier results below are historical.

## Earlier browser gate — 2026-09-23

**BLOCKED; replacement QA-key authorization still unused.** The corrected Node media test now passes. Typecheck, lint, all 33 React tests and all 24 D1/Worker tests passed. Browser QA passed 17/18 journeys, including Firebase Auth emulator compatibility under enforced CSP and all roles at six viewport widths.

The final photo test failed on a test-only `fetch(img.src)` for a blob URL. Its trace confirms `connect-src` rejected the fetch; image upload, linking, display and naturalWidth assertions passed. The app uses `img-src` for blob display and does not make this diagnostic fetch. Replace that test measurement with the authenticated media response body, keeping rendered-image and exact-byte checks; do not weaken CSP just to satisfy the diagnostic. No further QA, key creation or remote operation followed the mandatory stop.

The current build is a **demo-emulator bundle**, so it must not be deployed. Release rebuild, dry run and fresh staging QA remain pending. Preserve `.local-tools/cutover-2026-09-23-resume/credential-free-qa.json`, `browser-results-failed.json` and `photo-csp-failure/`. The header changes are still local and have not been deployed.

## Earlier credential-free retry — 2026-09-23

**BLOCKED; no new QA key created.** The replacement one-key authorization is conditional on all credential-free checks passing. Corrected media probes and the isolated malformed/private/missing status regression passed. Typecheck, lint and 33 React tests passed. The D1 suite passed 23/24 tests; a newly added assertion expected `Content-Length: 544` on a Node `Response`, but received null. Binary equality and actual workerd BLOB round-trip checks passed. This is a runtime-inappropriate test expectation, not proof of a production media defect. Preserve the failure and correct the assertion before resuming the gate.

Static security headers and a CSP/Auth browser regression are local changes only. Browser compatibility, fresh release build, dry run and remote credential-free staging checks were not run after the required stop. No remote mutation or deployment occurred. See `.local-tools/cutover-2026-09-23-retry/credential-free-qa.json`. The earlier results below remain historical and do not satisfy this new gate.

## Resume verification — 2026-09-23

The operator completed staging Auth setup on 2026-09-22T16:36:06Z; its four-role live Auth report passed at 16:36:02Z. After the operator restored the missing pre-existing Owner binding through Google's required Console invitation, independent Firebase/Auth/Firestore/rules access checks all passed at 2026-09-23T03:19:39Z. No IAM changes were made during that verification.

The resumed release checks passed: typecheck, lint, 33 React tests in 9 suites, 23 D1/Worker tests, and a fresh combined run of all 17 browser journeys. The production release was rebuilt after the demo browser suite, and Worker dry-run passed with both pinned D1 bindings and writes false. See `.local-tools/cutover-2026-09-22/release-checks.json` and `.local-tools/browser-results.json`.

Public staging checks passed at 03:28:26Z, including public queries, anonymous/forged-token rejection, CORS rejection, and POST/PUT/PATCH/DELETE maintenance rejection. The operator subsequently authorized exactly one temporary staging QA key. That attempt **FAILED at 03:48:58Z before any authenticated role test**: the runner expected 404 for `/api/media/sewak-qa-nonexistent-image`, but the endpoint correctly returned 400 because image IDs must begin with `profile_`. This is a runner expectation defect; it does not establish an Auth defect or satisfy the fresh Auth gate.

The sole temporary key was created at 03:48:56Z and deleted at 03:48:58.983Z. Independent verification at 03:49:48.709Z confirmed GET 404 and absence from the user-managed key list; the existing staging credential was preserved. The initial immediate GET had still returned metadata, and that historical warning is retained separately. No private key was persisted. No second QA key was created, no Firebase sign-in occurred, and before/after D1 and Firestore application-data hashes matched. Staging remained read-only.

Cutover **STOPPED at Phase 1** as required. Firebase freeze, final export/import, production replacement, production Auth setup, policy restoration and IAM cleanup remain unperformed. The original production version and source rules were reverified unchanged at 03:50:45Z. Correct the media probe and complete credential-free checks before any separately authorized fresh credentialed attempt. Static-page security headers were absent in this report and still need review. Do not treat the previous four-role Auth report or local automated journeys as a substitute for the failed fresh staging gate. See `.local-tools/d1-migration/authenticated-staging-qa.json` and the current migration runbook for timestamps and deletion evidence. Earlier sections below describe historical checkpoints and are not evidence of a completed cutover.

The initial read-only export of `care-53593` default Firestore was reconciled against local Miniflare D1. On 2026-09-22, a fresh staging export was imported into the two remote D1 databases in the confirmed Sewak Free account and reconciled again. This is a successful remote staging import, not a frozen final snapshot or completed production cutover.

| Collection | Firebase | Remote D1 |
|---|---:|---:|
| users | 8 | 8 |
| organizations | 3 | 3 |
| vendors/caregivers | 2 | 2 |
| bookings | 2 | 2 |
| careSessions | 1 | 1 |
| historical publicCaregivers | 2 | 2 |
| Other inventoried collections/subcollections | 0 | 0 |
| **Total** | **18** | **18** |

Auth: 8 existing identities, none disabled, no custom claims in the inspected export. Passwords and credentials were not migrated. Images: 0 discovered/migrated/failed/skipped; average/largest size is not applicable.

Local and remote validation passed reconstructed fields, counts, exact fractional timestamps/nested structures/null-versus-missing, imported Auth restriction metadata, cross-database references, both D1 `PRAGMA quick_check` results and `foreign_key_check`. Zero mismatches/FK violations. Repeated local import returned 18 unchanged. D1 disallows integrity_check/page_count, so validation uses supported quick_check and result meta.size_after. Remote storage: main 393,216 bytes; media 36,864 bytes. The initial local sizes were 380,928 and 24,576 bytes.

Three source warnings: completed booking service `elder_care` has no catalog row, and both caregivers have no assigned services. The historical ID is retained in legacy metadata with a NULL FK; no fake services/rates are added. Genuine service configuration is required before new bookings for those caregivers.

Private evidence is under `.local-tools/d1-migration`: initial and staging/raw exports, local and remote import/validation reports, image inventories, created Cloudflare IDs, hosting rollback metadata, source-writer/key-policy audits and the maintenance-rule review. These ignored files include personal data; only aggregate counts appear here.

## Check coverage

Final source checks: 9 React suites/33 tests passed; 23 Worker/migration tests passed, including real workerd, partial-inventory rejection, the independently verified disabled-Functions alternative and prevention of staging overwrites of the existing frontend. Worker typecheck and frontend/legacy-backend lint passed. The production Firebase Auth release build, syntax checks and git diff checks passed. A temporary automatic-approval review usage limit interrupted one full-suite attempt; the later full run completed with all 23 passing. API tests cover private ownership, tenant scope, role escalation, price tampering, atomic booking/care transitions, unique verified reviews, optimistic rollback, image authorization/size/type/replacement, maintenance, cursors and idempotent import.

Actual workerd tests use production Worker code and real D1 bindings to verify anonymous/forged-token rejection, migration gating, binary BLOB type/length/exact response, references and FKs. They caught and fixed D1 byte-array response handling. Signed JWT tests cover issuer/audience/expiry/auth time/UID validation, imported restrictions and D1 role authority. Auth-admin simulated transport checks interrupted/retried provisioning, blocked accounts and draining durable revocation jobs.

Chrome journeys use demo Firebase Auth with a Worker API backed by real SQLite and synthetic records. The 16 existing journeys passed at 320/375/430/768/1366/1920 px, all roles, booking/review/report flows, recovery/account switching, pagination, dialogs and offline Auth. The additional image journey passed separately after its fixes: real Canvas compression, bounded binary upload, private photo viewing, caregiver replacement/public serving, and preservation of the saved city. Total scenario coverage is 17 (16 in the full run plus the focused photo run), not a claim of a fresh combined 17-test run. Browser-added ICC metadata is stripped before upload while strict server checks remain enabled.

Browser fixture APIs are localhost/demo-only and not bundled in production. Rebuild the release after browser testing. Legacy Firebase rules/backend tests are rollback-reference checks, not proof of D1 access control.

## Live staging and remaining cutover

Staging is deployed at `https://sewak.nischalbachhar9.workers.dev`, version `c05ed5bc-6f28-4e3e-b7e6-e957bf7026e9`. Live checks passed: health 200 with both databases and writes false; public caregiver query 200 with two results; anonymous and forged-token private reads 401; writes 503 maintenance; deep SPA route 200 with noindex. Worker startup was reported as 2 ms, which is not an invocation CPU/load test. The first deployment was rejected because a legacy `/* /index.html 200` rule looped with Workers Assets HTML routing; the generator now relies on Wrangler's SPA fallback and successful redeployment verified the fix.

The owner confirmed Workers Free and that only the web app writes to Firebase. Functions API and Google project billing were independently confirmed disabled; the original firebase-adminsdk account had no user-managed keys. The freeze tool records that evidence and explicit owner confirmation, while rejecting other failed/partial inventories. Its maintenance-rule review verified 37 denied write grants and 28 unchanged read grants. Live rules remain unchanged.

Auth setup created the dedicated service account and exact four-permission custom role/binding, but key creation was blocked by inherited `iam.disableServiceAccountKeyCreation`. Policy reads succeeded; the current identity lacks policy-change permission. No key/Worker Auth secret was created, and no policy was weakened. An administrator exception is needed before Auth credential installation and live authenticated verification can run. See the [runbook](FIREBASE_TO_D1_MIGRATION.md#current-required-administrator-action). The original production `sewak-final` frontend is unchanged. After Auth setup succeeds, remaining work is authenticated staging checks, source freeze, final export/reconciliation and guarded production deployment. No final freeze or cutover has been performed.

Resumed checkpoint at 2026-09-22 15:09 UTC: the effective key policy remains enforced; the dedicated service account still has zero user-managed keys and exactly the four Auth permissions. Staging health is 200 with writes false. Production is 200 and still serves the original `main.df7cedb0.js` frontend. Wrangler OAuth has expired and cannot refresh; renew it after the administrator exception is ready, immediately before credential installation. These checks are recorded in `.local-tools/d1-migration/auth-admin-pending.json`.
