# Authentication audit and recovery handoff — 11 October 2026

## Verified production state

Read-only checks on 11 October 2026 (D1 integrity report at 09:24 UTC / 15:09 Nepal time) found:

- Production still runs `750f1bb7-7bfd-43a8-89d2-f87cb90ab9c6`. GitHub main at the start of this audit was `0404ec7c807778a84c3a0d572bffa0b079f7ddb6`, including PRs #24–26.
- All nine production D1 diagnostic probes passed. Both databases passed integrity checks with zero foreign-key violations. The initial diagnostic attempt could not authenticate to Cloudflare; refreshing the existing Wrangler OAuth login resolved that operator-access problem. It was not evidence of a database failure.
- Anonymous `/api/auth/me` returned 200 with `user: null`. A malformed cookie returned 401. A correctly shaped but nonexistent session cookie returned 503; public caregiver queries with that cookie also returned 503.
- The guarded recovery's aggregate password-format check passed: existing credentials are present and all non-null hashes match its scrypt prefix/length requirement. No hashes or account records were printed. This establishes format compatibility, not a successful login using every customer's password.
- Time Travel bookmark endpoints are available for both databases. Recovery preparation must save **new** bookmarks immediately before the operator attempt; this audit's availability check is not release evidence.

The production login incident has **not** been repaired or deployed by this PR. The earlier successful 51-check recovery and subsequent rollback are recorded in PRs #25–26. The underlying exception inside the old version's session/login path remains unconfirmed. Passing read-only SQL probes does not validate rate-limit writes, password Durable Object execution, or session commits. There is no basis here for diagnosing exhausted daily D1 quota or recommending a paid plan.

## Confirmed defects fixed

1. The Worker authenticated before every public query. A stale cookie therefore blocked an otherwise anonymous caregiver/service/review projection. Exactly those existing projections now bypass session lookup; their existing visibility filters and field redaction still run. Private records, media, mutations, CSRF and role authorization retain their checks. Database failures in a public projection still return errors.
2. The top-level logger classified every `D1_ERROR` as `database-capacity`. It now uses the existing finite privacy-safe classification, distinguishing schema, constraints, contention, resource limits and other D1 failures. HTTP failure semantics and per-operation traces remain intact.
3. The header navigated before logout completed. React Router's deferred navigation could also race the anonymous protected-route redirect. The application now holds the logout destination until navigation commits after revocation, shows its existing loading state while waiting, and retains the account with a retry message if revocation fails.
4. An old failed startup session request could clear a newer login. A session refresh started while logout was pending could resurrect the revoked account in memory. Generation checks now cover successful auth transitions, logout, password changes and current-session revocation.
5. Repository actors silently defaulted missing roles to `user`. Missing/unsupported roles now fail closed, without rewriting identities. Login checks the same parent-organization suspension/blacklist restriction already enforced when validating caregiver sessions.
6. The local browser fixture ignored `_headers` lines ending in Windows CRLF, so it did not actually apply the production CSP on Windows. It now trims line endings before parsing; the security test reads complete response headers and retains every policy assertion.

Password algorithms, credential versions, hashing, Secure/HttpOnly/host-only/SameSite cookies, idle/absolute expiry, CSRF and persistent rate limits are unchanged. No migration, account reset, role rewrite or session-table purge is included. The current three-step registration and artwork are unchanged. Customer and organization self-registration remain intact; caregivers and household staff retain the existing provisioning/invitation activation workflow rather than gaining an unauthorized public role-selection path.

## Validation

- Worker typecheck and frontend ESLint pass.
- Production build, guarded `sewak-final` deployment dry-run and release scan pass (zero detected private credentials or Firebase runtime references). No upload occurred.
- 83 D1 tests pass, including actual workerd/D1/PasswordHasher bindings, cookie/CSRF checks, expiry/revocation, wrong-password and unknown-account equivalence, role/tenant boundaries, rate limiting, registration, booking and review behavior.
- 52 React unit tests pass. This nested Windows checkout required `npm.cmd run test:unit -- --silent --testMatch '**/src/**/*.test.js'` because CRA's generated absolute test glob found no tests; zero-test success was not enabled.
- Desktop Chrome and emulated mobile Chrome pass all 12 new authentication journeys. They assert the actual role landing page, authenticated content, HttpOnly cookie attributes, refresh persistence, server-side revocation, stale-cookie public browsing and failed-logout retry.
- All 21 selected existing browser journeys pass with production CSP applied: responsive signup, customer/organization registration, custom city input, combined agency selection and approval, account switching, booking acceptance/start/completion, and verified reviews.
- The local Playwright Firefox distribution cannot launch because `lgpllibs.dll` is missing. The dedicated Linux GitHub Actions workflow runs the same Firefox scenarios with installed dependencies; consult the PR checks for the current result.
- Production deployment, synthetic production account writes, and post-deployment browser QA were not run. Those remain operator steps below.

## Operator recovery after PR review and merge

The existing version pin and incident contract still match the observed active version. Do not loosen them. The procedure requires a clean checkout of the **reviewed merged main**, fresh D1 evidence, both bookmarks, compatible credentials, the exact known `503 delivery-unavailable` synthetic registration failure, verified cleanup, and an explicit typed deployment authorization. It automatically attempts code-only rollback if post-deployment checks fail.

Use a new release checkout, not the divergent original working tree. Run these in an interactive PowerShell terminal **after review and merge**:

```powershell
Set-Location "$env:USERPROFILE\Downloads"
git clone --branch main --single-branch https://github.com/NischalBachhar/Sewak-final.git Sewak-auth-release-20261011
Set-Location .\Sewak-auth-release-20261011
git status --short
git log -1 --oneline
npm.cmd ci
npm.cmd --prefix worker ci
$env:CLOUDFLARE_ACCOUNT_ID = '860970f755498a4fe10e16c2fa99ce55'
$env:REACT_APP_CANONICAL_ORIGIN = 'https://sewak-final.nischalbachhar9.workers.dev'
node worker/node_modules/wrangler/bin/wrangler.js whoami
node scripts/incident-recover-sewak-final.mjs --prepare
```

Stop on any failed prerequisite. `--prepare` checks tests/build/dry-run/scan, current version and bindings, D1 integrity, existing hash compatibility and saves both bookmarks. Its evidence expires after 30 minutes. Confirm the selected account is Workers Free as required by the incident procedure.

When ready to authorize the controlled synthetic QA writes, supply a Gmail inbox you control:

```powershell
$env:SEWAK_QA_GMAIL = Read-Host 'Gmail inbox you control for synthetic QA'
node scripts/verify-cloudflare-auth.mjs --worker sewak-final --apply-synthetic-qa --verify-write-enabled-production
```

Review the newly emitted report. Proceed only when it has the exact incident failure, `cleanupVerified: true`, `applicationRecordsUnchanged: true`, and the pinned old version. Never substitute an old report. If QA passes unexpectedly or the version changes, this one-time recovery path no longer qualifies; use the normal guarded release process instead.

Only with the owner's explicit deployment authorization, run the following and supply the **exact new report path** printed by QA:

```powershell
$failedQa = Read-Host 'Exact path of the newly generated failing QA report'
node scripts/incident-recover-sewak-final.mjs --execute --failed-qa $failedQa
```

At the interactive confirmation prompt type `RECOVER sewak-final 750f1bb7`. This is the production-write boundary required by the task and reviewed recovery procedure; automation must not type it for the owner.

Require the command's new-version smoke checks, D1 validation, real Chrome customer sign-in, synthetic Auth QA, and cleanup assertions to pass. Record the actual deployed version and new report paths. Then verify existing-account caregiver, household worker, organization and superadmin journeys with authorized operators, without sharing passwords in chat. If any check fails, inspect the attempted Worker-code rollback and cleanup outcome before retrying. Never restore D1 automatically.
