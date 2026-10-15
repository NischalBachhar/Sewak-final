# Secure caregiver verification

Implementation branch: `feature/sewak-secure-verification`, based on refreshed `origin/main` at `387a45f`. The separate auth/notification branch and its uncommitted work are not included. This feature has not been deployed. Existing `APP_WRITES_ENABLED`, production configuration, deployment policy and release guards are unchanged.

## Workflows

Caregivers open **My Verification** in their existing dashboard. Identity, phone, training, background and references are independent. The same workflow serves independent, organization-associated, household and mixed-category workers. Marketplace approval is separate and unchanged.

1. Select a check and enter the required details. Identity accepts citizenship, national ID or passport. Training accepts caregiver, childcare, first aid, CPR, healthcare and household qualifications. References require 2–5 distinct consenting professional contacts.
2. For document checks, choose up to two originals of at most 10,000,000 bytes each. JPEG, WebP and PNG originals are decoded in the browser; uploads are still JPEG/WebP only. Review the compressed previews at full size, confirm readability, and consent to private review/storage.
3. Submit. The result is **Pending**, never verified. Phone verification uses the number already saved in the caregiver profile and a manual call. No SMS/code provider is used.
4. Read the reviewer response and resubmit if information is requested, rejected, expired or revoked. **Manage private evidence** supports withdrawal/deletion; withdrawing attached evidence revokes its check. Remove old photos there when the active-image limit is reached.

Superadmins open **Verification Management** in their existing dashboard. Search by caregiver name/ID, filter by check/status or expiry within 30 days, and navigate 20 records per page. Open details, inspect private evidence, and **Begin review**. Approval requires the specific manual method and a recorded outcome. References require individual contact confirmations and notes. Rejection, revocation and requests for information require a reason. Every action requires confirmation and a current record version. Owners cannot review themselves, even if their role is superadmin. Review history includes reviewer identity, timestamps and method; the UI shows the latest 100 decisions and audit events per caregiver.

Organizations see safe verification progress in the existing team-member details and can use the tenant-scoped progress endpoint. They cannot inspect verification submissions/photos or make decisions.

## Nepal Police

The background form includes English and Nepali instructions and the official [application portal](https://opcr.nepalpolice.gov.np/). Reviewers use the official [cross-verification page](https://opcr.nepalpolice.gov.np/#/crossVerify) manually, then record matched, not matched or unavailable. Police approval requires `nepal_police_portal_manual` and a matched result. Other background documents cannot create a police badge. No scraping, government API, OCR or automated government claim exists. The decision method/result fields allow a future authorized adapter without changing the submission/evidence/decision model; an API adapter still needs its own authentication and review.

## Data and security

### API surface

All routes below use the existing authenticated Worker API and CSRF handling. Mutations respect `APP_WRITES_ENABLED`. Evidence preview also requires writes enabled so access can be audited.

| Route | Purpose / authorization |
| --- | --- |
| `GET /api/verification/me` | Owner's checks, current submissions, evidence metadata and safe reviewer responses |
| `PUT /api/verification/evidence?kind=identity` | Owner-only bounded binary upload; `kind` is one of the document checks |
| `GET /api/verification/evidence/:id` | Owner or active superadmin; decrypts and audits a private binary preview |
| `DELETE /api/verification/evidence/:id` | Owner withdrawal, atomic revocation and recoverable binary deletion |
| `POST /api/verification/submit/:kind` | Owner submission with version, unique request ID, validated details, up to two evidence IDs, consent and readability confirmation |
| `GET /api/verification/queue` | Active superadmin; `status`, `kind`, `search` and zero-based `page` filters |
| `GET /api/verification/caregiver/:id` | Active superadmin's private review details/history |
| `POST /api/verification/review/:id/:kind` | Active superadmin; current version, decision, method, outcome, required reasons/confirmations and optional earlier expiry |
| `GET /api/verification/progress/:id` | Active organization admin, own worker only; safe check progress |
| `GET /api/verification/notifications` | Signed-in active recipient's latest 30 updates |
| `POST /api/verification/notifications` | Mark a recipient-owned notification ID as read |
| `POST /api/verification/maintenance` | Active superadmin; one bounded expiry/retention batch |

Unknown fields, invalid transitions, self-review and cross-owner evidence IDs are rejected. Public consumers continue using the existing `publicCaregivers` endpoints; no public evidence route exists.

Apply additive migrations in order:

- `migrations/main/0006_secure_verification.sql`: verification records, encrypted submissions, evidence metadata, encrypted decisions, audit, recipient-scoped notifications, phone-change/notification triggers and safe public status view. `0005` remains reserved for the separate auth/notifications branch. No legacy review is imported or trusted.
- `migrations/evidence/0001_private_evidence.sql`: private binary ciphertext, storage accounting and deletion tombstones. Bind as `EVIDENCE_DB`. `MEDIA_DB` remains exclusively for existing profile images.

`VERIFICATION_ENCRYPTION_KEY` is a dedicated 32-byte random key, encoded as unpadded base64url in a Worker secret. Stored payloads are binary BLOBs, not base64: format version byte, random 12-byte IV and AES-256-GCM ciphertext/tag. Associated data binds each payload to its caregiver, type and immutable ID. Submission details, identity numbers, reference contacts, private review notes and photos are encrypted. Do not reuse the notification encryption key. Keep a recoverable key in a password manager; replacing the secret alone makes old evidence unreadable. Rotation requires an explicitly authorized, tested decrypt/re-encrypt migration. There is no committed operational key.

Authentication, active-account/role/organization checks, cookie CSRF and same-origin protection reuse the existing Worker. Every status/submission/decision/audit/notification change is atomic within MAIN D1. Repository commits recheck authorization/session and profile versions inside that transaction. Verification-specific guards reject stale decisions and competing submissions. All inputs/SQL parameters are bounded; no document filenames are retained or sensitive payloads logged.

Generic profile writes can no longer change any verification status or legacy trust boolean. Public profiles, directory results, the verified-only search filter and permitted private vendor responses derive their verification fields from the review tables. Existing field names remain compatible; `verificationSource: audited_v1` identifies the safe response. Five current reviewed checks are required for the overall badge. Status expiry is computed on reads, so delayed maintenance cannot extend a badge. Changing the phone in either the user or caregiver profile revokes phone checks atomically. Legacy `verified`, `isCertified`, and `backgroundChecked` values never establish trust. Existing organization approval fields are separate.

Private evidence has no public URL. Authenticated previews check ownership/active superadmin status and audit access, return `private, no-store`, `nosniff`, restrictive CSP, and no-referrer. The UI fetches a binary Blob and revokes its local object URL on close/unmount. Downloaded content already seen by an authorized reviewer cannot be remotely recalled. Previewing is disabled while writes are closed because preview access must be audited.

### Cross-database recovery

An atomic MAIN reservation enforces the caregiver quota before EVIDENCE receives ciphertext. MAIN only marks it ready after the binary write succeeds. An uncertain response leaves a bounded reservation/ready photo visible to the owner, with a 24-hour unsubmitted TTL. No cross-database write can grant verification.

Deletion first marks MAIN evidence inaccessible and revokes its current check, then atomically adds an EVIDENCE tombstone and deletes the binary row, then releases MAIN quota. Failed deletion is retried. Tombstones reject a late upload after deletion and prevent resurrection. Replaced photos become inaccessible immediately and are physically removed by maintenance. A failed/ambiguous upload can consume a slot for up to 24 hours plus maintenance delay; refreshing shows recoverable uploaded photos.

### Retention and notifications

- `VERIFICATION_RETENTION_DAYS`: default 365, integer clamped to 1–730. Private submissions/photos/review payloads expire; minimal audit/decision metadata and deletion tombstones remain. Backups/Time Travel may retain deleted ciphertext for Cloudflare's retention period; immediate erasure from backups is not claimed.
- `VERIFICATION_BACKGROUND_DAYS`: default 365, clamped to 1–730. Reviewers may choose an earlier expiry. Approval cannot exceed submission retention; training expiry is additionally capped by the certificate date.
- `VERIFICATION_MAX_IMAGES`: default/hard ceiling 8. Lower positive limits may be configured. Upload reservations count until deleted, preventing concurrent quota bypass.
- Unsubmitted photos expire after 24 hours. All submitted checks receive a deadline, so an abandoned pending request can be resubmitted after retention expires.
- An authorized future staging/production configuration should add `[triggers] crons = ["*/15 * * * *"]`. The scheduled handler performs bounded expiry/deletion work only when writes and private storage are enabled. It handles 10 expiries/photos and up to 20 private review payloads per run; backlog drains over repeated runs. Superadmins can run the same batch from the management panel. Read-time expiry always applies.
- MAIN triggers notify the caregiver and active superadmins on submission, review start, more-information requests, approval, rejection, expiry and revocation. Notifications contain only check/status metadata and are recipient scoped. The dashboard refreshes notifications every minute and immediately after actions. Notifications retain 90 days. There is no notification service on the selected main baseline, so this uses its own `verification_notifications` table. No email/SMS/paid delivery is configured or enabled.

## Free-tier capacity

Cloudflare documents [10 databases per Free account, 500 MB per database, 5 GB account storage, 50 D1 queries per invocation and a 2 MB row/BLOB ceiling](https://developers.cloudflare.com/d1/platform/limits/). [Free daily quotas](https://developers.cloudflare.com/d1/platform/pricing/) are 5 million rows read and 100,000 rows written. Verify account usage before provisioning; this implementation does not change billing or provision remote resources.

Each uploaded photo is at most **500,000 bytes**, plus 29 encrypted-envelope bytes. The EVIDENCE database enforces a **400,000,000-byte ciphertext budget**, leaving headroom below the database limit for indexes/tombstones/SQLite overhead. At maximum size, that is about 799 photos, roughly **99 caregivers with eight photos each**. This is a conservative capacity estimate, not a claim about the account's available storage. Schema/index overhead, historical metadata, backup behavior, other D1 databases and daily quota usage reduce practical capacity. Monitor database size and MAIN metadata as well as the ciphertext counter. Two environments need separate evidence databases and consume separate account slots.

Writes reserve at most 8 concurrent photos per caregiver and permit at most 30 upload reservations and 10 submissions per caregiver in a rolling day. Queue results are bounded; public badge reads aggregate the five indexed records in the existing listing query. Native Web Crypto performs encryption; browser compression avoids Worker image decoding/OCR CPU. Workers Free CPU/request limits still apply and must be measured on authorized staging; local tests do not prove production CPU usage. If platform/database capacity is exhausted, uploads fail closed with a retryable error, leaving bounded recoverable reservations. No service is automatically upgraded. Retention cleanup or deliberately lower volume is required; R2 is not a dependency.

Server validation checks still-image container/signature, declared MIME, dimensions, metadata/attachment chunks and the exact byte cap. The browser keeps quality at or above 0.74, uses up to 2800 pixels on the long edge, never shrinks below 600 pixels on either side, strips metadata, and refuses to meet the byte cap by reducing quality indefinitely. Human preview/attestation and manual review determine actual readability; there is no automated legibility guarantee. Original PDFs are deliberately unsupported.

## Local verification (Windows PowerShell)

From the feature worktree:

```powershell
Set-Location 'C:\Users\ASUS\Downloads\Sewak-final-main\.local-tools\secure-verification'
npm.cmd ci
npm.cmd --prefix worker ci
npm.cmd run typecheck
npm.cmd run lint
$env:CI = 'true'
# Explicit glob avoids CRA/Jest's mixed-separator discovery issue in this nested Windows worktree.
npm.cmd run test:unit -- --testMatch '**/src/**/*.test.js'
npm.cmd run test:d1
npm.cmd run build:release
npm.cmd run test:browser -- verification.spec.cjs
npm.cmd run d1:local
git diff --check
```

`d1:local` uses local Miniflare storage, including EVIDENCE_DB, and never uses `--remote`. Browser tests create isolated synthetic identities and databases. They do not contact the police portal, call references, send SMS, or deploy.

## Authorized staging preparation only

The following commands are instructions, **not actions performed for this task**. Run remote creation/migrations/secret configuration only after approval. They target existing **staging** MAIN and a new **staging evidence** database. They do not deploy code or alter write flags. Never substitute production IDs.

```powershell
Set-Location 'C:\Users\ASUS\Downloads\Sewak-final-main\.local-tools\secure-verification'
$env:CLOUDFLARE_ACCOUNT_ID = '860970f755498a4fe10e16c2fa99ce55'
$verificationWrangler = '.\worker\node_modules\wrangler\bin\wrangler.js'
node $verificationWrangler whoami
node $verificationWrangler d1 list --json
# STOP if Free database/account capacity cannot accommodate one more database.
node $verificationWrangler d1 create sewak-staging-verification-evidence
if ($LASTEXITCODE -ne 0) { throw 'Evidence database creation failed' }
$verificationEvidenceId = Read-Host 'Paste the new STAGING evidence database UUID'
if ($verificationEvidenceId -notmatch '^[0-9a-f-]{36}$' -or $verificationEvidenceId -in @('36fa1df1-aa5d-43a1-ad0e-a4e310c513c3','c3721e25-4fb2-4a0d-b350-518ec9abbea2')) { throw 'Invalid staging evidence ID' }
# D1-only preparation config: no Worker deployment entrypoint or assets.
@"
name = "sewak-verification-preparation"
account_id = "860970f755498a4fe10e16c2fa99ce55"
[[d1_databases]]
binding = "EVIDENCE_DB"
database_name = "sewak-staging-verification-evidence"
database_id = "$verificationEvidenceId"
migrations_dir = "../migrations/evidence"
"@ | Set-Content -Encoding utf8 '.local-tools\verification-preparation.toml'
node $verificationWrangler d1 migrations list sewak-staging-db --config wrangler.toml --remote
# Review pending migrations before applying; MAIN includes any prior unrun additive migrations.
node $verificationWrangler d1 migrations apply sewak-staging-db --config wrangler.toml --remote
if ($LASTEXITCODE -ne 0) { throw 'Staging MAIN migration failed' }
node $verificationWrangler d1 migrations apply EVIDENCE_DB --config '.local-tools\verification-preparation.toml' --remote
if ($LASTEXITCODE -ne 0) { throw 'Staging evidence migration failed' }
# Generate/store a dedicated 32-byte base64url key in a password manager first.
# Wrangler prompts for the value; never put the key in a command, source file or chat.
node $verificationWrangler secret put VERIFICATION_ENCRYPTION_KEY --config wrangler.toml
```

Before approving an eventual release, the owner must review binding the new UUID as `EVIDENCE_DB`, cron/retention settings and the evidence key. **The current existing deployment guard requires exactly two D1 bindings and staging read-only mode. It remains unchanged and deliberately blocks deployment with a third binding.** A separately authorized release must extend that guard to pin the reviewed evidence UUID, preserve all existing account/database/QA checks, and authorize any staging write-enablement separately. Do not bypass the guard with a raw deployment command. No deployment command or write-flag change is part of these instructions. Migration-before-code order is required because public projections now depend on the new safe view.

If the unmerged auth/notification feature is later integrated, retain its email verification/session guards and route existing in-app delivery to the verification events without enabling optional email by default. Its reserved `0005` migration does not collide with this feature's `0006`.

## Deliberate limits / release prerequisites

Manual reviewer training, consent/privacy wording approval, official portal availability and real evidence review are operational responsibilities. No government endorsement, professional licensing or safety guarantee is implied. Optional PDF ingestion, automated phone codes, OCR, email and external background services are excluded. Staging bindings, secrets, cron activation, Free-account capacity, staging CPU measurements and the separately approved deployment-guard extension remain required before any deployment. Production data, infrastructure, settings and deployments have not been modified.
