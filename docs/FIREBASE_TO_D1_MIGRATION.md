# Sewak migration and operation

## Current checkpoint: production drift restored read-only, 2026-09-29

**Production is healthy and read-only on `67841390-1437-473a-bfdb-fe244b51dd5f`.** Active version bindings and current settings independently match `DB=sewak-db` (`36fa1df1-aa5d-43a1-ad0e-a4e310c513c3`), `MEDIA_DB=sewak-media` (`c3721e25-4fb2-4a0d-b350-518ec9abbea2`), `AUTH_AUDIENCE=sewak-production`, and `APP_WRITES_ENABLED=false`. D1 API database names were also verified.

**Owner confirmed disconnecting the Git repository from `sewak-final`.** The former connected configuration was repository `NischalBachhar/Sewak-final`, branch `main`, root `/`, build `npm run build`, deploy `npx wrangler deploy`, no configured build variables. That path selected the default staging config rather than explicitly selecting production. Its displayed "Manually deployed" label did not establish automatic-build status or prove which invocation caused the historical drift. Disconnection is recorded from the owner's explicit confirmation; the Builds API remains inaccessible. Keep Git builds disconnected and production read-only. Do not delete Firebase users, keys, secrets or rollback material during this verification phase.

The user confirmed the later staging-config production releases were unintended. The earliest retained wrong-config version is `94f29244-97cc-4219-8b42-e15919de285d`, uploaded at `2026-09-29T06:57:40.541998Z`, following the correct release `f8217461-93e7-45c0-97da-54f33d14d206` at 06:51:45Z. Subsequent versions through `8b944715-248a-4ad6-a149-0e1c9ae67e80` carried staging DBs/audience. Cloudflare metadata labels these Wrangler uploads under the Sewak owner. This does not identify the initiating command or distinguish a connected build from another Wrangler client. Local Wrangler logs do not contain those uploads. The Builds trigger/history API returned HTTP 403 (codes 10000/12004), and no browser connection was available. The initial connected-build verification blocker was subsequently resolved by the owner's explicit disconnection confirmation above.

Restoration re-deployed the verified real release with the explicit production config. An initial activation of the old read-only version did not make `/settings` match its version bindings; that mismatch was caught before QA, and the explicit redeployment brought both into agreement. Fresh full read-only production QA passed **53 checks**, including all four roles, cookie/Bearer authentication, private reads, IDOR/anonymous/invalid/expired-session rejection, CSRF, password changes, revocation, rate limits, maintenance protection and browser login/private-profile access with **zero Firebase requests**. Synthetic identities were removed and application/media hashes matched before and after. Evidence: `.local-tools/cloudflare-auth/sewak-final-qa-b3725c93-56ea-4cea-846b-cf8b3b25c310.json`.

Post-QA verification at `2026-09-29T12:01:21.919Z` reconfirmed all **18 original records exactly**, unchanged/frozen Firestore digest `479a9ddd25de4b35bda77ce2b89a4ad97e02c98636451cddeae609a0a622d393`, intact rollback hashes, all eight original Auth users, both installed Sewak keys, secure inherited key restrictions and absent temporary signing access. Existing Worker Firebase secrets remain installed but unused. No Firebase users, keys, secrets, data, rules, project or rollback artifacts were deleted. Shoe Doctor remains untouched.

After the Git disconnection, read-only source verification repeated successfully at `2026-09-29T12:15:57.061Z` with the same record count, hashes, freeze rules, preserved credentials and secure policies. Production retains the same version already covered by the 53-check read-only QA; its active-version/settings/database-name checks are independently refreshed in `readonly-restoration.json`. No repeated data migration, production redeployment, application-write enablement, Firebase retirement or Git reconnection was performed during this verification.

Repository safeguards now pin Worker/account/database IDs/database names/audience, reject conflicting environment/CI/CLI overrides, route the old Worker npm deploy shortcut through the gated operator, block raw Wrangler custom builds without the reviewed entry point, reject automatic Workers CI builds, and independently verify the active remote version after deployment. Four operator tests, positive guarded dry-run, negative raw staging-to-production dry-run, release build, secret scan and whitespace checks pass. These controls cannot constrain an owner using an older checkout or direct API token; see [DEPLOYMENT.md](DEPLOYMENT.md). The owner-confirmed Git disconnection clears the connected-build blocker for publishing these safeguards, while production write enablement and Firebase retirement remain held during verification. Restoration evidence: `.local-tools/cloudflare-auth/readonly-restoration.json`; drift metadata: `drift-investigation.json` and `production-deployment-drift.json` in the same private directory.

## Earlier Cloudflare-only write-enabled verification (superseded by restoration)

**The earlier Cloudflare-only production verification had application writes enabled.** Production read-only QA passed 53 checks; controlled write smoke passed 13 checks and removed its synthetic accounts/media. Then-live release `f8217461-93e7-45c0-97da-54f33d14d206` used `sewak-db`, `sewak-media`, audience `sewak-production` and `PasswordHasher`. Staging release `1629f2dc-a9a3-481d-ae56-4214fb988e61` passed 54 checks with separate databases. The final dependency update passed 35 unit tests, 39 D1/workerd tests and all 18 browser journeys. Secret scan, Worker dry-run and diff whitespace checks passed. These historical passes do not authorize cleanup while deployment drift remains unresolved.

One earlier staging attempt expected the wrong existing customer landing route (`/user/home` instead of `/user`), and its operator cleanup flattened SQL parameters incorrectly. Both test/operator issues were corrected; independent cleanup proved all four temporary accounts absent before rerunning. A later staging registration timed out without committing records; a fresh diagnostic and the complete 54-check gate then passed. These failed reports remain preserved rather than being relabeled.

Private evidence: `.local-tools/cloudflare-auth/sewak-qa-c35db234-28f3-4f31-be76-b809edcb3e9e.json`, `sewak-final-qa-3fb2cbe2-6175-4ad0-b0f0-7c49125901c8.json`, `production-write-smoke-fce37aca-6d70-4705-a0fa-31b2f987471b.json`. The additional pre-auth production SQL backup has SHA-256 `6326236e6e9359b971eaed04b321200fd69bb30f01f942b4a87188ec74f50dbb`. The owner bootstrap is reserved and unused; its private delivery file is excluded from Git and its password is chosen only on the setup page.

Final post-write source verification, Git delivery and authorized Firebase retirement are being completed. Do not treat this intermediate checkpoint as permission to delete the Firebase project.

The user superseded the Firebase-Auth cutover plan: **zero Firebase runtime dependency is now required**. Do not resume old signing/session/key instructions below. Do not migrate the eight dummy Firebase accounts, unfreeze Firestore, repeat the original 18-record migration, touch Shoe Doctor or delete `care-53593`.

Cloudflare Auth is implemented locally with scrypt, opaque D1 sessions, HttpOnly cookies, mobile Bearer sessions, server roles, one-time bootstrap, invitations, recovery and session revocation. First real owner email is reserved for `nischalbachhar9@gmail.com`. See [CLOUDFLARE_AUTH.md](CLOUDFLARE_AUTH.md), [MOBILE_API.md](MOBILE_API.md) and [openapi.json](openapi.json).

Local verification: 35 unit tests, 39 D1/workerd tests, all 18 complete browser journeys, Worker typecheck/lint and actual workerd scrypt/D1/media integration pass. New D1 security checks include duplicate registration, reserved bootstrap email, recovery and revocation during an in-flight transaction. Browser journeys assert zero Firebase requests and nonempty authenticated image bytes without relaxing CSP.

Staging now has **separate** databases: `sewak-staging-db` (`764b3560-fc46-4273-9026-f049941ab4c3`) and `sewak-staging-media` (`0060c4f7-828c-478d-b951-c1be0b43921e`). Production retains `sewak-db` and `sewak-media`; only additive `0003_cloudflare_auth.sql` was applied there. No original application-data migration was repeated.

Post-write verification completed at `2026-09-29T06:53:43.818Z`: all 18 original records remain exact, Firestore remains frozen with unchanged digest `479a9ddd25de4b35bda77ce2b89a4ad97e02c98636451cddeae609a0a622d393`, rollback hashes match, inherited key restrictions remain enforced, and temporary signing permissions remain absent. Remaining: publish the verified implementation and remove only the obsolete Firebase credentials/eight dummy accounts. Keep rollback artifacts. Final project deletion needs separate authorization.

## Historical Firebase-Auth checkpoint (superseded; evidence only)

The source uses a Worker API, main D1 (`DB`) and separate binary profile-image D1 (`MEDIA_DB`), keeping Firebase Authentication. **BLOCKED at completion of the controlled production smoke test. Production is deployed with Auth configured but has been returned to read-only mode.** Credential-free, authenticated staging, production maintenance and production read-only Auth QA passed. Firebase client writes remain frozen. The Google key-creation restriction has been restored and verified. The final snapshot contains 18 application documents, 8 Auth identities and no media; there was no final delta, so the initial migration was not repeated.

### Latest resume: existing app session required - 2026-09-28

The user authorized continuation of the remaining cutover while explicitly forbidding another signing request, new keys, repeated staging QA or repeated migration. Current verification completed at **2026-09-28T15:05:41.791Z** with no remote mutation. The earlier production read-only Auth QA is a preserved **PASS: 67 checks across user, caregiver, orgadmin and superadmin**, finished 2026-09-28T09:41:27.322Z; it was not repeated.

Fresh read-only checks confirmed all **18 original application records** exactly reconcile with the final snapshot, Auth restriction mapping is exact, all **8 Firebase Auth identities** remain unchanged apart from earlier permitted sign-in timestamps, Firestore is unchanged/frozen, foreign keys and both database integrity checks pass, and media count remains zero. The only added D1 row is the retained audit record from the earlier cleaned-up smoke test. Anonymous private profile access returned **401**, invalid-token private profile access **401**, and anonymous private media access **403**. Production security headers, exact database bindings, Firebase source-project binding and installed secret names were verified.

The project key-creation exception is absent and secure inherited enforcement is already active; no restoration mutation was needed. The one-shot QA key is absent, the two installed Worker keys are intact, the temporary signing binding and effective permission are absent, its custom role is deleted, and IAM Credentials API remains DISABLED. Unproven temporary human organization roles remain untouched. Production remains healthy/read-only on **c896825e-ae34-4527-8254-8f50d346663a** and staging remains healthy/read-only on **6442631b-9c9d-4687-bdd9-2aa60fc0fc9e**. The two SQL rollback backups match their recorded SHA-256 hashes; final normalized/raw snapshots and the freeze manifest remain present.

**Exact blocker:** there is no available authenticated Firebase application session for the remaining live production checks and controlled smoke. The successful one-shot signing verification deliberately discarded its JWT without Firebase exchange; earlier QA sessions were closed and their tokens were not persisted. The connected-computer inventory returned no browsers, and requesting a browser for the production URL returned **No browser is available**. Google/Firebase CLI administrator OAuth is not a Firebase application user session. No additional signing or key creation was attempted.

**Safe next action:** connect a browser accessible to this session and sign in normally to `https://sewak-final.nischalbachhar9.workers.dev` using the existing Sewak QA accounts needed for role checks. Do not send passwords or tokens in chat. Use those sessions for remaining authenticated checks; preserve the completed QA evidence and existing role permissions. Production must stay read-only until authenticated gates pass, then the already approved release and controlled smoke can proceed. No production deployment, APP_WRITES_ENABLED change, source unfreeze, reimport, Auth-user mutation or Shoe Doctor action occurred in this resume.

Evidence: `.local-tools/cutover-2026-09-28-resume/read-only-checkpoint.json`. The final cutover remains **incomplete**; this report does not claim fresh authenticated QA or final write smoke passed.

### Single signing verification passed - 2026-09-28

The user narrowed approval to exactly one signing retry and prohibited application, D1, Firebase data and Auth-user changes. That verification **PASSED**. The request at **2026-09-28T14:58:10.555Z** returned **HTTP 200**, and its returned JWT claims matched the requested existing Sewak identity. Exactly **one** signing request was sent after the approximately two-minute propagation wait. The token was discarded in memory without Firebase exchange/sign-in. No key, user, record, claim, password, deployment or organization-policy change was made.

The same temporary one-permission role and service-account binding were used, with a maximum 30-minute conditional grant. Binding removal completed at **2026-09-28T14:58:13.629Z**; role deletion completed at **2026-09-28T14:58:15.572Z**. Independent cleanup verification passed at **2026-09-28T14:59:29.904Z**: the binding and effective signing permission are absent, the temporary custom role is deleted, IAM Credentials API is DISABLED, the existing key set is unchanged, and key-creation restriction remains enforced. Both staging and production were verified healthy with **APP_WRITES_ENABLED=false**.

Safe evidence only: `.local-tools/cutover-2026-09-28-keyless-retry/signing-verification.json` records the request timestamp, HTTP result, non-secret result metadata, role-removal time and independent cleanup result. No JWT/private-key material was recorded. This one-retry authorization is consumed; do not rerun signing or restore access again under it. The earlier broader `finish.mjs` remains unexecuted and must not be used to infer authorization for data writes.

**Cutover remains incomplete and production stays read-only.** This narrow verification establishes signing success; it is not a fresh Firebase sign-in or production Auth/read-only QA pass. The remaining production Auth/read-only gates must pass before activation, and the latest no-data-mutation boundary remains in force. The original 403's precise cause is still unconfirmed; this successful delayed retry does not by itself prove the cause. Shoe Doctor was untouched.

### Earlier keyless signing attempt and verified stop - 2026-09-28

The user approved temporary keyless signing. The read-only preflight verified the explicit Google identity, required administration permissions, disabled IAM Credentials API, empty direct service-account policy, both installed keys, inherited key-creation restriction, frozen source, correct D1 bindings and both Workers in read-only mode. The real production release was rebuilt; frontend/repository secret scans, Worker dry run and diff check passed again at 14:38:02Z.

Only in `care-53593`, IAM Credentials API was enabled at **14:38:12.805Z**. The custom role `projects/care-53593/roles/sewakCutoverSmokeSigner` contained only `iam.serviceAccounts.signJwt`; its sole conditioned binding on the existing dedicated Sewak Auth service account targeted `user:nischalbachhar9@gmail.com` and expired at **15:08:18.507Z**. Although the permission test returned allowed, the one actual signing request returned **HTTP 403** at 14:38:21Z. No signed token or Firebase session was obtained; production writes were never enabled and no synthetic data write was attempted. The runner did not preserve the Google error body, and a targeted audit-log query returned no matching entry, so the precise reason is **unconfirmed**. [IAM propagation is eventually consistent](https://docs.cloud.google.com/iam/docs/access-change-propagation), but propagation has not been established as the cause.

Cleanup completed: binding removed **14:38:22.692Z**, role deleted **14:38:25.093Z**, API restored to **DISABLED at 14:38:29.971Z**. Independent verification at **14:38:36.834Z** confirmed the binding absent, role deleted, effective signing permission absent, unchanged two installed keys and key-creation restriction enforced. No private key was created. No tokens or key material were persisted.

A subsequent automatic approval review rejected a proposed retry that would undelete the temporary role and allow multiple signing requests, stating this exceeded the approved single temporary grant/sign-in scope. **That retry did not execute.** A narrower, syntax-checked proposal is prepared but requires explicit approval: re-enable this project's IAM Credentials API, restore only the same one-permission temporary role, conditionally bind the same human on the same service account for 30 minutes, allow two minutes for propagation, send **exactly one** signing request, capture only safe error metadata if denied, then immediately remove the grant/role and disable the API on either success or failure. No new key or organization policy change. Production can be enabled only after successful sign-in and verified cleanup; the corrected controlled smoke and exact reconciliation must then pass.

Independent post-attempt safety checks passed at **14:42:43.109Z**: all original 18 records exact, all 8 Auth identities unchanged except previously permitted sign-in timestamps, Firestore unchanged and frozen, media unchanged, deleted QA key absent, two installed keys preserved, and only the earlier smoke audit row added. Production remains healthy/read-only on `c896825e-ae34-4527-8254-8f50d346663a`; staging remains healthy/read-only on `6442631b-9c9d-4687-bdd9-2aa60fc0fc9e`. Shoe Doctor and `sewak-ff563` were not touched.

Evidence: `.local-tools/cutover-2026-09-28-keyless/keyless-cutover.json`, `production-smoke.json`, `release-checks.json`, `signing-denial-audit.json`, `post-signing-safety-audit.json`. The unexecuted single-request proposal is `.local-tools/cutover-2026-09-28-keyless-retry/finish.mjs`; its approval guard must not be bypassed. All earlier evidence and rollback material remain preserved.

### Earlier production smoke checkpoint - 2026-09-28

Production read-only Auth QA passed 67 checks across all four roles. At **09:43:00.338Z**, the exact project-level `iam.disableServiceAccountKeyCreation` exception was cleared with its etag, and inherited enforcement was verified. Both required installed Worker keys were retained. No organization policy was changed. Human Organization Role Viewer, Service Account Key Admin and Organization Policy Admin bindings were reviewed but retained because their temporary provenance is not proven; project Owner and all legitimate baseline roles remain intact.

The final real release rebuild, secret/artifact scans, Worker dry run and diff check passed. Production writes were opened on version `180e1a9e-061f-4f62-bd2d-8f8731c1166b` at 09:43:29.947805Z. The controlled smoke test created one **inactive synthetic service** through the authenticated production API, verified its exact D1 row and authenticated API read, then failed because the runner requested `publicServices` with **limit 100**. The API correctly restricts page size to **1–50** and returned HTTP 400. This was an operator test defect, not an established application/data/security failure. The subsequent frontend-reflection and logout assertions were not reached.

The exact unreferenced synthetic service was removed under ID/label/creator/version guards, and its audit record was retained. Firestore had no corresponding synthetic service record. Production was immediately returned to `APP_WRITES_ENABLED=false`, version **`c896825e-ae34-4527-8254-8f50d346663a`**, with healthy read-only status verified at 09:44:20.737Z. Staging remains read-only. The original Firebase project, data, Auth, snapshots, rule backups, D1 backups and deployment metadata are preserved.

The runner is corrected to limit 50; an independent public query returned HTTP 200 with zero services. No further key was created. The production credential remains installed in Worker secrets, but its private material was discarded when its in-memory process ended. There is no connected browser session, no existing `iam.serviceAccounts.signJwt`/`signBlob` permission for the current human account, and IAM Credentials API is disabled. The current human Google account has no matching existing app account, and Google sign-in is disabled; no user/provider was created or linked to bypass this.

At that earlier checkpoint, the proposed recovery had **not yet executed** (see the later attempted recovery and verified stop above): enable IAM Credentials API only in `care-53593`; define a temporary custom role containing only `iam.serviceAccounts.signJwt`; bind it only on the dedicated Sewak Auth service account to `nischalbachhar9@gmail.com`, with a 30-minute expiration; mint one existing superadmin sign-in; remove the new binding/role and restore the API's prior disabled state; complete and clean up the corrected smoke test. This creates no private key and does not relax the restored key-creation policy. The user subsequently approved that access; its failed attempt and cleanup are recorded above. Exact proposal: `.local-tools/cutover-2026-09-28/keyless-signing-proposal.json`. Do not rerun `finish-production.mjs`, which is guarded against duplicate production credentials.

Evidence: `.local-tools/cutover-2026-09-28/production-cutover.json`, `production-auth-qa.json`, `production-smoke.json`, `final-release-checks.json`, `containment-read-only-deploy.log`. Independent post-smoke safety reconciliation is recorded separately when completed. **Shoe Doctor was not touched.**

### Verified cutover progress — 2026-09-23; resumed 2026-09-28

The real release passed the frontend/repository credential scan, emulator-artifact scan, Worker dry run and diff check. Read-only staging version `6442631b-9c9d-4687-bdd9-2aa60fc0fc9e` was deployed with the reviewed security headers and both existing Auth secret names preserved. Live credential-free QA passed 19 checks plus public browser coverage, with unchanged main/media/auxiliary/Firestore hashes.

Fresh real Firebase Auth QA passed **67 checks across all four represented roles**, including browser sessions, UID-to-D1 mapping, own/private reads, role and cross-user boundaries, invalid/tampered tokens, and all four maintenance write methods. Staging writes stayed disabled. Auth inventory hashes were unchanged excluding only `lastLoginAt` and `lastRefreshAt`; application data hashes were unchanged. Correctly signed expired-token behavior is covered by local Worker tests; the live tampered-expiry probe is not claimed as proof of a naturally expired Firebase ID token.

The one replacement temporary key ended `83bbd360fe8349f87126db63b497bb58f5e38cc8`: created **09:56:09Z**, deleted **09:58:11.066Z**, independently verified absent by GET 404 and key listing at **09:58:23.153Z**. The installed staging key was preserved. Private material stayed in process memory and was not persisted. This authorization is now consumed; do not create another temporary QA key.

Fresh pre-cutover reconciliation passed. Private SQL backups of both D1 databases, source snapshots, original rules and the original production version are preserved. The freeze review preserved all 39 read grants and helpers; 330 simulated writes were denied, and original/frozen read cases passed. The applied ruleset is `projects/care-53593/rulesets/7dcc230e-50e7-46ce-b6ec-70ac4aface6d`, released at **15:02:27.921455Z**. Live source exactly matched the reviewed freeze, Auth configuration remained identical, and five live-source simulations passed. No actual Firebase data write was used to test the freeze. Functions API and billing were independently disabled; the owner's existing confirmation that no server/Admin SDK writers remain is retained.

Final export: **18 documents / 8 Auth users**, with zero added, removed or changed documents and unchanged exported Auth metadata since staging. Final D1 synchronization was a verified no-op. Media discovery returned zero. Exact final reconciliation passed counts, fields, IDs, timestamps, relationships, Auth restriction metadata, integrity and foreign keys, with only the three previously documented legacy warnings. Evidence: `.local-tools/cutover-2026-09-23-media-boundary/` and `.local-tools/d1-migration/firebase-final.json`, `final-images.json`, `final-validation.json`, `freeze-new/`.

The September 28 resume reverified unchanged deployment, source freeze, Auth state, key absence and data hashes at 09:29:25.227Z. Production maintenance version `c8301254-32ef-4ddf-b154-79c2d06012d9` then passed public/header/browser checks. The production-only Auth key was installed in Worker secrets with no local private-key persistence and no permission broadening; its non-secret metadata is in `.local-tools/d1-migration/auth-admin-sewak-final.json`. Production read-only Auth QA passed 67 checks across all four roles, finishing at 09:41:27.322Z, with unchanged application data hashes. See the current checkpoint above for policy restoration, the smoke runner failure and production containment. Shoe Doctor remains untouched.

### Media boundary investigation resolved — 2026-09-23

For the same authenticated media request, the isolated Worker/server sent 360 bytes and the application received the identical 360-byte Blob/ArrayBuffer, with matching SHA-256. Playwright captured zero bytes, while the saved trace recorded 372 transferred body bytes and zero captured-content bytes. Installed Playwright delegates to Chromium's DevTools body capture; an empty capture is returned directly without a refetch in this case. This is a capture-boundary discrepancy, not an empty image delivered to the application. The precise upstream Chromium cause is not claimed. [The image-pipeline documentation](PROFILE_IMAGE_PIPELINE.md#browser-byte-validation-boundary) records the exact measurements, source inspection, and test-boundary rationale.

The regression now requires nonempty bounded bytes from the actual Blob handed to the application before `URL.createObjectURL`, matching server/upload size and SHA-256, successful independent decoding, and matching rendered dimensions. HTTP 200, image MIME and authenticated access are separately verified. Private rejection and public replacement remain covered. CSP, Worker authorization, image limits and production behavior were not changed by this fix; no Content-Length requirement or blob refetch was introduced.

The focused image test and then the entire credential-free gate passed. Full browser QA finished with **18 passed, zero failed/skipped/flaky**, including all roles at 320/375/430/768/1366/1920 and Auth under enforced CSP. Evidence: `.local-tools/cutover-2026-09-23-media-boundary/credential-free-qa.json`, `browser-results.json`, `media-boundaries.json`, and the preserved `diagnostic-trace.zip`. Historical failed checkpoints below remain for audit history.

### Latest resume: media-response gate stop — 2026-09-23

The operator accepted the blob-fetch diagnosis and instructed replacement with Playwright network instrumentation while retaining CSP and all media checks. The test now registers `page.waitForResponse` before navigation, inspects the actual authenticated `/api/media/profile_e2e-customer` GET and reads its body with `response.body()`. It keeps status/MIME/authorization checks, nonempty and bounded binary checks, upload-size equality, profile linkage, visibility, dimensions and unauthorized-media checks. Neither CSP nor runtime authorization was weakened; no Content-Length requirement was added.

The entire local gate was rerun: typecheck, lint, **33 React tests / 9 suites and all 24 D1/Worker tests passed**. Browser QA again passed **17/18**, including enforced-CSP Auth compatibility in the isolated emulator and all roles at six viewport widths. The remaining failure is now `tests/browser/journeys.spec.cjs:135`: HTTP 200, image/webp and an authenticated request were observed, but Playwright's captured body length was **0**, failing the required nonempty-image assertion. The trace reports network `bodySize: 372` while its recorded content size is zero. This discrepancy is unresolved; do not describe it as a proven production defect or dismiss it as another harmless test issue. Later UI and unauthorized-media assertions in this particular journey were not reached.

The required stop was honored. No temporary key, remote data mutation, staging/production deployment, freeze, final snapshot/import, IAM or policy change occurred. The read-only Cloudflare check at **09:30:39.512Z** confirmed staging healthy with writes false, both correct D1 bindings and existing secret names; production remained HTTP 200 on deployment `58b70a20-f66c-4635-867b-b21c561b90d7`, version `8dc54932-f57a-4808-9b51-e4b7e08b1e52`, with no bindings or secrets. Header changes remain local. The current build is still `demo-emulator` and is not deployable. Release rebuild, dry run, full live staging QA and new data-digest checks were not reached. `git diff --check` passed.

Safe next action: compare the isolated server's bytes, the browser-received Blob before object-URL creation, and Playwright's captured bytes for the same request to locate the discrepancy. Keep the nonempty-body assertion and all security controls intact. Correct the identified cause, then rerun the complete credential-free gate before using the still-unused conditional key authorization. Evidence: `.local-tools/cutover-2026-09-23-media-response/credential-free-qa.json`, `browser-results.json` and `photo-response-failure/`. Earlier failure artifacts remain preserved.

### Earlier resume: browser gate stop — 2026-09-23

The renewed approval in attachment `0051df7c-4724-4b45-8579-a72f51eb3277/Pasted text.txt` retained the mandatory stop on any credential-free failure. The inappropriate Node Content-Length assertion was removed while keeping exact binary equality, stored byte length, MIME, nosniff, ETag, privacy and media-status checks. Typecheck, lint, **33 React tests / 9 suites and all 24 D1/Worker tests passed**.

The full browser run passed **17 of 18 journeys**, including the new enforced-CSP Auth regression with the isolated Firebase Auth emulator, every role at six viewport widths, booking/care/review workflows, private routes and account switching. The final photo journey failed at `tests/browser/journeys.spec.cjs:133`: its diagnostic `fetch(img.src)` tried to fetch a `blob:` URL, which `connect-src` does not permit. The preserved browser trace explicitly records this CSP violation. Upload, profile reference update, rendered image visibility and positive naturalWidth checks had passed. `img-src` permits blob display; the inspected application displays an object URL created from the authenticated media API response and does not itself refetch that blob URL. This result is a failed browser gate, not a verified production image outage.

Safe next action: replace the test-only blob-size fetch with observation of the authenticated media response bytes through Playwright, preserving the image-rendering and byte-size assertions. Do not broaden CSP merely to accommodate that diagnostic. Then resume the complete credential-free gate before any new key. The previous failure and current trace remain preserved.

No key was created, and no staging/production deployment, remote D1/Firebase mutation, IAM or policy change occurred. The header policy remains **local only**. Fresh release rebuild, Worker dry run and live staging checks were not reached after the required stop. **The current build is marked `demo-emulator` and must not be deployed.** Evidence is under `.local-tools/cutover-2026-09-23-resume/`: `credential-free-qa.json`, `browser-results-failed.json`, and `photo-csp-failure/`.

### Earlier credential-free retry gate — 2026-09-23

The operator approved fixing the media test and conditionally authorized one new temporary key **only after every credential-free check passes**, with an explicit stop on any failure. The media contract was reviewed without changing production: malformed IDs return 400; anonymous/unauthorized private or missing images return 403 before existence is revealed; an authorized owner/admin receives 404 for a missing image. The local QA probes and separate regression coverage now represent those cases, and the new media-status regression passed.

Typecheck, lint and all 33 React tests / 9 suites passed. D1/Worker tests returned **23 passed, 1 failed out of 24**. The failing assertion was newly added in `tests/d1/security.test.mjs`: it expected the Node `Response` harness to expose `Content-Length: 544`, but the header was null. Binary bytes matched before that assertion, and the actual workerd binary round-trip test passed. The application does not explicitly set that header; [Cloudflare's Response documentation](https://developers.cloudflare.com/workers/runtime-apis/response/) describes runtime-managed length behavior. This test assertion does not establish a deployed media defect. Correct it according to the runtime contract while preserving binary equality, MIME, cache, privacy and status checks before rerunning the gate.

Static security headers were added **locally only** in `public/_headers`, preserved by `scripts/public-metadata.cjs`. CSP permits same-origin application assets/API requests, the existing Firebase Auth API/auth-domain/gapi origins, blob/data images and existing inline React styles; it denies objects, framing and off-origin form submission. Additional headers are `nosniff`, strict-origin-when-cross-origin referrer policy, disabled camera/microphone/geolocation, frame denial and HSTS for HTTPS (`max-age=31536000`, no subdomain/preload directive). The local browser server applies the policy with only the isolated Auth emulator connection origin added. A browser Auth/CSP regression was added but **has not run** because the preceding test gate failed. No deployed-header or Firebase browser-compatibility pass is claimed. Cloudflare's [asset headers configuration](https://developers.cloudflare.com/workers/static-assets/headers/) is used because static pages bypass API response headers.

The requested stop was honored. No new key, staging deployment, production deployment, Firebase freeze, final snapshot/import, IAM change or policy change occurred in this retry. Browser checks, release rebuild, Worker dry run, fresh remote hash checks and staging QA remain pending. `git diff --check` passed. Evidence: `.local-tools/cutover-2026-09-23-retry/credential-free-qa.json`. The conditional second-key authorization is unused; do not bypass the failed credential-free gate.

The renewed login was verified on 2026-09-22 as `nischalbachhar9@gmail.com`, account `860970f755498a4fe10e16c2fa99ce55`, pinned in `wrangler.toml`. The owner explicitly confirmed Workers Free, allowing `--free-plan-confirmed`; OAuth billing reads still return 403. Created `sewak-db` (`36fa1df1-aa5d-43a1-ad0e-a4e310c513c3`) and `sewak-media` (`c3721e25-4fb2-4a0d-b350-518ec9abbea2`) with all migrations applied. Staging is `https://sewak.nischalbachhar9.workers.dev`, version `c05ed5bc-6f28-4e3e-b7e6-e957bf7026e9`, with writes disabled. The Shoe Doctor Cloudflare account was never modified and is rejected by operator tools.

The account already hosts Sewak on `https://sewak-final.nischalbachhar9.workers.dev` (HTTP 200, title "Sewak - Care, close to home"). Its existing `sewak-final` Worker has no bindings, no custom domain, and predates this migration. The current deployment/version/settings metadata was recorded in `.local-tools/d1-migration/cloudflare-existing-host.json` without changing it. Keep that host working during staging. Final deployment uses `--worker sewak-final` to preserve the URL. A temporary read-only production deployment requires explicit `--cutover-maintenance`, a frozen source and passing reconciliation; install production secrets only after that reviewed code is deployed, then enable writes.

## Google Cloud / Firebase ownership verification — 2026-09-22

Verified at **2026-09-22T15:39:31Z** using the existing official Firebase CLI OAuth session explicitly selected for `nischalbachhar9@gmail.com`. Google's OAuth userinfo endpoint independently confirmed the account's verified email before project operations. No Shoe Doctor session or service-account impersonation was used.

**The requested ownership state already existed.** `nischalbachhar9@gmail.com` is the intended and independently verified Sewak administrator, with an unconditional **`roles/owner` binding directly on `care-53593`**. No new role was assigned. This existing single role covers project IAM and Firebase administration; additional Firebase Admin or Storage Object Creator grants are unnecessary. [Firebase's Owner role documentation](https://firebase.google.com/docs/projects/iam/roles-basic) explains its project administration permissions.

`shoedoctorhtd@gmail.com` was **already absent** from both the project's direct IAM bindings and its parent organization's IAM bindings when inspected. Exact bindings requiring removal: **none**. No removal was performed in this session, and the inspection does not establish when or whether an earlier removal occurred. There are no IAM conditions or group/domain grants in either inspected allow policy. All existing service-agent bindings were preserved.

Resource hierarchy: **organization `62621436036` (`nischalbachhar9-org`) → project `care-53593` (number `1079707135149`, display name `Care`, ACTIVE)**. There is no intermediate folder. The following organization-level roles already belong to the target account and remain unchanged; they are separate from its direct project Owner binding:

- `roles/billing.admin`
- `roles/billing.creator`
- `roles/iam.workforcePoolAdmin`
- `roles/resourcemanager.organizationAdmin`
- `roles/resourcemanager.projectCreator`
- `roles/resourcemanager.projectMover`
- `roles/serviceusage.serviceUsageAdmin`

Independent target-account verification confirmed:

- Project metadata, project IAM and the Firebase project are readable. Permission tests confirm `resourcemanager.projects.setIamPolicy`, project update, Firebase project update, Auth configuration update and Auth user administration capabilities.
- Firebase Auth configuration is accessible. All **8 existing Auth users** remain present, with zero disabled users; non-credential user metadata matches the migration snapshot. No Auth sign-in, user mutation or credential creation was performed.
- `sewak-worker-auth@care-53593.iam.gserviceaccount.com` exists, with **zero user-managed keys**. Its unconditional project binding to `projects/care-53593/roles/sewakWorkerAuth` remains intact. The role still contains exactly `firebaseauth.users.create`, `firebaseauth.users.get`, `firebaseauth.users.sendEmail` and `firebaseauth.users.update`.
- All **18 Firestore documents**, including typed fields and document timestamps, match `.local-tools/d1-migration/firebase-staging.json.raw.json`. Existing source rules remain in place. These were read-only checksum checks, not another export or import.
- Staging `/api/health` returns HTTP 200 with `healthy: true` and `writesEnabled: false`. The production homepage returns HTTP 200 and still loads `main.df7cedb0.js`.
- No D1 operation, Worker deployment, billing change, organization IAM change, organization policy change or Shoe Doctor resource/credential operation was performed. No production cutover was attempted.

Organization policy outcome: **B — the target account can read the policy but cannot modify it.** `constraints/iam.disableServiceAccountKeyCreation` is enforced by the organization; there is no project override. The target has `orgpolicy.policy.get`, but permission tests return none of `orgpolicy.policy.set`, `orgpolicy.policies.create`, `orgpolicy.policies.update` or `orgpolicy.policies.delete` on the project. Organization-level tests likewise do not grant policy set/create/update. Its existing Organization Administrator role does not supply Organization Policy Administrator permissions.

Domain restricted sharing: the effective legacy `constraints/iam.allowedPolicyMemberDomains` policy allows all values, and the effective `constraints/iam.managed.allowedPolicyMembers` policy reports no enforcement. Custom-constraint enumeration through Organization Policy API v2 was unavailable because that API is disabled for the Firebase CLI OAuth consumer project; no API was enabled. This limits the custom-policy inventory, but the target's existing Owner binding and actual administrative access were verified directly.

**Remaining administrator action:** an authorized Organization Policy Administrator must review and, if approved, create a temporary exception **only for `care-53593`**. The missing legacy capability is `orgpolicy.policy.set`; v2 uses policy create/update/delete permissions. Google's predefined [`roles/orgpolicy.policyAdmin`](https://docs.cloud.google.com/iam/docs/roles-permissions/orgpolicy) is granted at organization scope, so assigning it would require a separately authorized organization IAM action, outside this ownership check. No such role was granted and no policy was relaxed. Once an authorized administrator confirms the exception is active, follow the existing Wrangler login and `configure-auth-admin.mjs` commands below; do not restart provisioning or the initial import.

Private inspection evidence and policy backups are under `.local-tools/iam-correction/2026-09-22/`. They contain no tokens, private keys or Auth password hashes. Final verification at **2026-09-22T15:41:25Z** found no differences in project/organization IAM, Auth configuration/user metadata, Firestore documents, source rules, service-account metadata/custom role, key inventory, billing or public staging/production response checksums. Of 291 existing repository/checkpoint files, only this document changed. The existing migration reports and snapshots remain unchanged.

### Project selector discrepancy resolved — 2026-09-22

A separate read-only investigation reverified Google OAuth identity and access at **2026-09-22T15:47:44Z**. Both `gcloud auth list` and `gcloud config get-value account` could not run because `gcloud` is unavailable in this environment; no active gcloud account is claimed. The actual credential source was the existing **official Firebase CLI OAuth session for `nischalbachhar9@gmail.com`**, verified directly by Google's userinfo endpoint. No service-account credentials, Firebase token override or Cloud SDK token override was used.

Cloud Resource Manager returned HTTP 200 for `care-53593` metadata and project IAM. Both v1 project listing filtered to `id:care-53593` and v3 project search returned **Care / `care-53593` / `1079707135149`**, under organization `62621436036`. Permission checks confirmed `resourcemanager.projects.get`, `resourcemanager.projects.getIamPolicy`, `resourcemanager.projects.setIamPolicy`, Firebase project read/update and Firebase Auth configuration read/update. `resourcemanager.projects.list` was verified on the parent organization, its appropriate resource scope. Firebase project and Firebase Auth configuration reads both returned HTTP 200. The direct Owner binding and all seven organization-level bindings listed above remained unchanged and unconditional; neither policy contained `user:shoedoctorhtd@gmail.com`.

**Confirmed selector cause:** the user reported that the earlier selector showed **All under No organisation**, which displayed Sewak (`sewak-ff563`). The migration source **Care (`care-53593`) belongs to `nischalbachhar9-org`**, so that earlier organization scope excluded it. After selecting the correct organization, the user confirmed that Care is accessible and that its dashboard displays project number `1079707135149`. Browser verification is based on that explicit user confirmation; no browser session was connected to the investigation tools. The mismatch was the selector's organization scope, not a missing Owner binding or a different CLI identity.

No IAM addition or removal was needed or performed. `sewak-ff563` was not queried as a substitute or modified. No Firebase data/Auth users, Cloudflare resources, migration checkpoints, production deployment or organization policies were changed. Only this documentation was updated.

The remaining blocker was independently rechecked at **2026-09-22T15:49:37Z**: `constraints/iam.disableServiceAccountKeyCreation` remains enforced with no project override. On both `care-53593` and organization `62621436036`, the target account has `orgpolicy.policy.get` but lacks `orgpolicy.policy.set`, `orgpolicy.policies.create`, `orgpolicy.policies.update` and `orgpolicy.policies.delete`. Access verification is resolved; an appropriately authorized Organization Policy Administrator must handle the separately reviewed project-only exception before Auth credential setup can continue.

## Current cutover resume checkpoint — 2026-09-23

Staging Auth setup succeeded at **2026-09-22T16:36:06Z**, recorded in `.local-tools/d1-migration/auth-admin-sewak.json`; existing-role Auth checks passed at **16:36:02Z** in `live-auth-sewak.json`. The service-account private key was not persisted locally. Both staging secret names are present, its D1 bindings match the pinned IDs, and writes remain disabled. Secret installation advanced staging to version `14605bdb-1501-4af3-bffc-54ffd910a33d`, deployment `2d2245df-1605-423c-96a0-96d290a1c35b`. Do not rerun staging Auth setup.

An unexpected removal of the pre-existing project Owner binding blocked the first cutover preflight with Firebase/Auth/Firestore/rules HTTP 403 responses. The operator explicitly authorized restoring it. Google returned `ORG_MUST_INVITE_EXTERNAL_OWNERS`, requiring a Console invitation; no API IAM update succeeded. The operator completed and accepted that invitation. At **2026-09-23T03:19:39Z**, independent verification as `nischalbachhar9@gmail.com` confirmed the unconditional project `roles/owner` binding and all required Firebase, Auth, Firestore and rules reads/permissions. No binding was recreated or modified during that successful verification. The live Firestore rules release still points to the original ruleset, with no freeze applied.

The temporary project-only key-creation exception is currently active. The operator now has `orgpolicy.policy.set` and policy deletion capability, verified at **2026-09-23T03:21:05Z**. Keep the exception only until the still-pending production Auth key is installed and verified; then restore inheritance and verify effective enforcement before opening D1 writes. The newly observed organization Role Viewer, Service Account Key Admin and Organization Policy Administrator roles have not been removed. Preserve the pre-existing project Owner binding and review temporary-role provenance at the cleanup gate.

Release checks completed in this resumed attempt: typecheck and lint passed, **33 React tests / 9 suites**, **23 D1/Worker tests**, and a fresh combined **17 browser journeys** passed. The browser suite used only demo Auth/local fixtures. A production release was rebuilt afterward at **2026-09-23T03:26:23Z**, with canonical origin `https://sewak-final.nischalbachhar9.workers.dev`; Worker dry-run and `git diff --check` passed. No frontend Firestore/Realtime Database/Storage SDK imports or private-key/server-credential markers were found in the scanned runtime source/release assets.

Public staging checks at **2026-09-23T03:28:26Z** passed: health reports writes false; caregiver/service/review queries return 200 with counts 2/0/0; anonymous and forged-token private requests return 401; disallowed CORS returns 403; POST/PUT/PATCH/DELETE mutation attempts return 503 maintenance. The earlier automatic approval rejection was superseded by explicit operator authorization for exactly one temporary QA key, with mandatory deletion and a stop on any QA failure.

The authorized attempt on **2026-09-23T03:48:57Z** failed before any real Firebase sign-in or authenticated role test. The runner requested `/api/media/sewak-qa-nonexistent-image` expecting 404, but received 400. Source review confirms `serveProfileImage` requires IDs beginning with `profile_`; the API correctly rejected the malformed probe. This is a QA runner expectation error, not evidence that Firebase authentication failed. Fresh role authorization, private reads, mapping, browser sessions and authenticated write-protection checks remain unverified. The public homepage also lacked the four security headers recorded by the runner; this observation remains for review and was not silently marked passing.

Exactly one temporary key was created for the existing dedicated Auth service account. Resource metadata: `projects/care-53593/serviceAccounts/sewak-worker-auth@care-53593.iam.gserviceaccount.com/keys/73b38c282f2f4a618a5ae87453698b0cd3d443be`. Creation: **03:48:56Z**. Successful deletion response: **03:48:58.983Z**, immediately after the failed QA. The first immediate GET still returned metadata; independent verification at **03:49:48.709Z** returned **404**, and the user-managed key inventory no longer contained the key. The original installed staging key remains present. No private-key material was written to disk, logs, reports, frontend code or Git, and no second QA key was created. Key handling used the official [IAM key APIs](https://docs.cloud.google.com/iam/docs/keys-create-delete).

Before/after read-only digests match for all enumerated D1 application tables, Auth mapping and media metadata, and all **18 Firestore documents including their timestamps**. No Firebase Auth sign-in was reached, and no Auth user, password, claim or application record was changed by this attempt. `APP_WRITES_ENABLED` remained false. Owner binding and Firebase project, Auth configuration, Firestore and rules read access were rechecked successfully before creation without changing IAM.

**Mandatory stop honored:** no Firebase freeze, final export/import, production deployment, production credential setup, policy change or IAM cleanup followed the failed QA. The one-key authorization is consumed. Next action: correct the media probes (malformed IDs expect 400; an authenticated owner's valid but absent profile image can test 404), complete credential-free QA and review the absent static-page headers before another credentialed attempt. Any new QA key requires fresh explicit authorization; do not rerun the one-shot runner or recreate staging credentials. Preserve the failed result rather than relabeling it PASS.

Evidence: `.local-tools/d1-migration/authenticated-staging-qa.json`, `.local-tools/cutover-2026-09-22/temporary-qa-key-metadata.json`, `temporary-qa-key-deletion-verification.json`, `staging-qa-failed-initial-cleanup-check.json`, and `post-qa-stop-state.json`. The last read-only check at **03:50:45.902Z** confirmed healthy staging with writes false, the original Firestore ruleset, the original production deployment, and no final snapshot or new freeze package. The project-only key-creation exception remains active as instructed pending production credential setup; it has not been restored, and temporary human IAM roles remain unchanged.

Production is still the original `sewak-final` deployment `58b70a20-f66c-4635-867b-b21c561b90d7`, version `8dc54932-f57a-4808-9b51-e4b7e08b1e52`, with no D1 bindings or Auth secrets; the homepage serves `main.df7cedb0.js`. No final snapshot/import, maintenance deployment, production Auth setup, policy restoration or production write enablement has occurred. Evidence is under `.local-tools/cutover-2026-09-22/`; keep earlier immutable migration snapshots and reports.

## Historical key-creation blocker — before staging Auth setup

The following records the earlier blocker and setup sequence. It has been superseded by the successful staging setup above; do not repeat that setup command.

Google organization `62621436036` enforces `constraints/iam.disableServiceAccountKeyCreation` on project `care-53593` (number `1079707135149`). Key creation returned `400 FAILED_PRECONDITION: Key creation is not allowed on this service account.` The current identity has only `orgpolicy.policy.get`, not policy-change permissions. The dedicated `sewak-worker-auth@care-53593.iam.gserviceaccount.com` identity and its Auth-only custom role/binding were created, but **no private key or Worker Auth secret was created**. No organization policy was changed.

An **Organization Policy Administrator** (with the policy-change permissions above, not merely `roles/resourcemanager.organizationAdmin`) must review a temporary exception in [this project's key-creation policy](https://console.cloud.google.com/iam-admin/orgpolicies/iam.disableServiceAccountKeyCreation?project=care-53593), ideally scoped to the dedicated service account through a conditional tag policy. If using a temporary project override, limit it to `care-53593` and restore the inherited restriction after the two target keys are installed and verified. Do not disable the restriction organization-wide. See [Google's policy troubleshooting](https://docs.cloud.google.com/iam/docs/troubleshoot-org-policies). No compatible existing workload identity provider was identified for the current Worker setup; no new provider or policy workaround was created. Do not send a private key in chat.

After the administrator reports the exception is active, resume the Auth setup command below with `--verify-origin https://sewak.nischalbachhar9.workers.dev --snapshot .local-tools/d1-migration/firebase-staging.json`. It checks existing identities for all four roles using temporary custom tokens; tokens stay in memory, no application records/passwords/claims are changed, but Firebase sign-in timestamps can advance. This live verification has not run yet because key creation was blocked.

The 15:09 UTC resume check still found the policy enforced, zero user-managed keys on the dedicated account, and healthy read-only staging. Wrangler's OAuth session had expired again. Once the exception is ready, renew login immediately before setup:

```powershell
.\worker\node_modules\.bin\wrangler.cmd login
.\worker\node_modules\.bin\wrangler.cmd whoami
$env:CLOUDFLARE_ACCOUNT_ID = '860970f755498a4fe10e16c2fa99ce55'
node scripts/configure-auth-admin.mjs --apply --free-plan-confirmed --verify-origin https://sewak.nischalbachhar9.workers.dev --snapshot .local-tools/d1-migration/firebase-staging.json
```

Read [validation](MIGRATION_VALIDATION.md), [schema](D1_SCHEMA.md), [images](PROFILE_IMAGE_PIPELINE.md), [cost limits](D1_FREE_TIER_OPTIMIZATION.md) and [rollback](MIGRATION_ROLLBACK.md). Commands run from the repository root in PowerShell. Use Node 22.18+ for TypeScript/SQLite operator tools; this workspace used Node 25.6.0. Legacy Functions still target Node 20.

## Install and rehearse

```powershell
npm.cmd ci
npm.cmd --prefix worker ci
npm.cmd --prefix functions ci
worker/node_modules/.bin/wrangler.cmd login
worker/node_modules/.bin/wrangler.cmd whoami
$env:CLOUDFLARE_ACCOUNT_ID = '860970f755498a4fe10e16c2fa99ce55'
node scripts/provision-cloudflare.mjs
node scripts/configure-auth-admin.mjs
```

The last two commands are dry runs. Configuration templates contain names only. Frontend `REACT_APP_*` values are public; never put credentials there.

```powershell
node scripts/firebase-to-d1/export.mjs --project care-53593 --output .local-tools/d1-migration/firebase-initial.json
node scripts/firebase-to-d1/import.mjs --input .local-tools/d1-migration/firebase-initial.json --report .local-tools/d1-migration/plan.json
npm.cmd run d1:local
node scripts/firebase-to-d1/import.mjs --input .local-tools/d1-migration/firebase-initial.json --apply --report .local-tools/d1-migration/local-import.json
node scripts/firebase-to-d1/images.mjs --input .local-tools/d1-migration/firebase-initial.json --apply --report .local-tools/d1-migration/local-images.json
node scripts/validate-migration/index.mjs --input .local-tools/d1-migration/firebase-initial.json --report .local-tools/d1-migration/local-validation.json
```

The initial snapshot already exists: use a new filename for another export. Export never overwrites a backup. It recursively enumerates live collections/subcollections, stores a typed raw backup, and exports only non-credential Auth metadata. Passwords, salts, hashes and refresh tokens are excluded. It is not a point-in-time snapshot: final cutover requires a write freeze and fresh export. Private snapshots/reports stay ignored under `.local-tools`.

Import preserves document IDs, UIDs, timestamp precision, nested JSON, arrays and null versus missing fields. Known typed document references become validated relational IDs; unknown/nested reference paths retain their complete qualified value. Cross-project relational references need explicit mapping. Two passes handle cyclic relationships. A source-hash journal resumes unchanged records and refuses unrelated or subsequently edited D1 rows. Unknown collections, secrets, unsupported binary/numeric fields and missing mandatory relationships fail visibly. One missing historical service ID is retained in legacy metadata with a NULL SQL FK; two caregivers lack assigned services. No replacement services or prices are invented.

## Provision, import and stage read-only

The following provisioning/import/staging steps were completed after Workers Free was confirmed; staging Auth setup subsequently succeeded on 2026-09-22 as recorded above:

```powershell
node scripts/provision-cloudflare.mjs --apply --free-plan-confirmed
$env:SEWAK_D1_ID = '36fa1df1-aa5d-43a1-ad0e-a4e310c513c3'
$env:SEWAK_MEDIA_D1_ID = 'c3721e25-4fb2-4a0d-b350-518ec9abbea2'
node scripts/firebase-to-d1/import.mjs --input .local-tools/d1-migration/firebase-staging.json --apply --remote --report .local-tools/d1-migration/remote-import.json
node scripts/validate-migration/index.mjs --input .local-tools/d1-migration/firebase-staging.json --remote --report .local-tools/d1-migration/remote-validation.json
$env:REACT_APP_CANONICAL_ORIGIN = 'https://sewak-final.nischalbachhar9.workers.dev'
npm.cmd run build:release
npm.cmd run deploy:cloudflare -- --free-plan-confirmed
node scripts/configure-auth-admin.mjs --apply --free-plan-confirmed
```

Provisioning creates only `sewak-db` and `sewak-media`, fills their TOML IDs, and applies SQL through small D1 REST requests. No R2/bulk-upload infrastructure is configured. The remote schema journal records checksums/progress; add new migrations instead of editing applied ones. Staging writes remain closed with `APP_WRITES_ENABLED="false"`. Verify the staging URL returned by Wrangler; its same-origin API is independent of the production canonical URL used for final metadata.

Auth setup uses the dedicated `sewak-worker-auth` service account with only `firebaseauth.users.create/get/update/sendEmail` in a custom role. It preserves unrelated IAM bindings with the policy etag, verifies a read-only Auth lookup, and installs `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` Worker secrets. The generated key stays in memory; only its resource name and identity metadata are recorded locally. Failed installation deletes that new key. The Worker receives no Firestore, Storage, billing, project-admin or user-deletion permissions. A temporary project policy exception now permits the remaining production key; restore inheritance after production credentials are verified. Do not paste keys in chat. If IAM propagation delays a permitted key's verification, retry later; a failed new key is removed.

Verify deployed health/public reads, anonymous private-read rejection, real Firebase sign-in and private read-only views. Local emulator tests do not establish production credential or domain configuration.

## Final freeze and cutover

1. Complete remote data/image reconciliation and authenticated staging QA. The owner confirmed only the web app writes to Firebase. Functions listing returned `SERVICE_DISABLED`; independent reads confirmed both the Functions API and project billing are disabled, with no user-managed keys on the original firebase-adminsdk account. Pass `--no-server-writers-confirmed` only while that owner confirmation remains valid. The tool records this alternative to a Functions inventory only when the API and billing are independently still disabled. Other inventory/permission errors, unreachable regions or discovered Functions remain blocking. No API or billing service is enabled automatically.
2. Back up live rules and prepare a read-only copy with `freeze.mjs --prepare`. A backup already exists under `.local-tools/d1-migration/freeze`; only a Firestore rules release was discovered, no Storage release. It has not been applied.
3. Apply the reviewed freeze after reconciliation and Auth verification. Its review confirmed 37 write grants become false and 28 read grants keep their original conditions. The tool requires the writer verification described above. Auth and permitted reads remain available; no data is deleted.
4. Export a fresh snapshot, import remotely, migrate any discovered photos and validate again. Keep old and new writers closed during this interval.
5. Remove/disable the temporary image migration endpoint and deploy the reviewed code to `sewak-final` using `--cutover-maintenance` while writes are still false. Install/verify Auth admin secrets on that reviewed code, then set `APP_WRITES_ENABLED="true"` and deploy again with the final report. This retains the existing URL with `/api/*` on the same Worker and avoids installing credentials into the old frontend's Worker code. Both Worker names are allowlisted; key metadata is recorded separately for each target.

```powershell
node scripts/firebase-to-d1/freeze.mjs --project care-53593 --prepare --output .local-tools/d1-migration/freeze-new
node scripts/firebase-to-d1/freeze.mjs --project care-53593 --apply --no-server-writers-confirmed --validation .local-tools/d1-migration/remote-validation.json --output .local-tools/d1-migration/freeze-new
node scripts/firebase-to-d1/export.mjs --project care-53593 --output .local-tools/d1-migration/firebase-final.json
node scripts/firebase-to-d1/import.mjs --input .local-tools/d1-migration/firebase-final.json --apply --remote --report .local-tools/d1-migration/final-import.json
node scripts/validate-migration/index.mjs --input .local-tools/d1-migration/firebase-final.json --remote --report .local-tools/d1-migration/final-validation.json
npm.cmd run deploy:cloudflare -- --worker sewak-final --cutover-maintenance --free-plan-confirmed --source-frozen --validation .local-tools/d1-migration/final-validation.json
node scripts/configure-auth-admin.mjs --apply --worker sewak-final --free-plan-confirmed
# After Auth secrets are verified, set APP_WRITES_ENABLED="true" in wrangler.toml.
$env:REACT_APP_CANONICAL_ORIGIN = 'https://sewak-final.nischalbachhar9.workers.dev'
npm.cmd run build:release
npm.cmd run deploy:cloudflare -- --worker sewak-final --free-plan-confirmed --source-frozen --validation .local-tools/d1-migration/final-validation.json
```

`--source-frozen` is an operator assertion, not a distributed lock: only use it after all source writers are closed. For custom-domain Auth redirects, add the real host to Firebase Auth authorized domains if needed. Existing email/password, password reset and sessions remain Firebase Auth.

## Development and checks

`npm run test:browser` uses demo Firebase Auth and a SQLite-backed Worker with synthetic fixtures. The local fixture endpoint is guarded by a random runner token/demo project and is absent from the production Worker. It produces a demo build; always run `build:release` afterward. The real workerd integration test separately verifies D1 bindings and binary images.

`npm run dev:worker` serves the built app/API. Wrangler local D1 state is separate from the migration harness's `.local-tools/d1-state`: initialize it using `wrangler d1 migrations apply DB --local` and `... MEDIA_DB --local`. Use separate synthetic data and never apply browser fixtures remotely. Production token verification never accepts emulator JWTs.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit -- --silent
npm.cmd run test:d1
npm.cmd run test:browser
npm.cmd run build:release
worker/node_modules/.bin/wrangler.cmd deploy --dry-run --outdir .local-tools/worker-build
git diff --check
```

Legacy `test:rules`, `test:backend` and original `test:migration` exercise retained Firebase rollback/reference code, not D1 authorization. No Firebase Functions deployment is needed by the new app. Fonepay remains deliberately disabled as before.
