# Super Admin recovery (operator runbook)

This tool changes authentication only. It does not deploy, migrate schema, alter UI, or change ordinary users, organizations, bookings or caregiver permissions. Production writes require both `--apply` and exact interactive confirmation. Node 22.13+ with type stripping (or Node 24+) is required. Run from the repository root in a private, interactive VS Code PowerShell terminal. Do not use a terminal transcript, screen sharing, shell tracing, or a logging wrapper during secret entry.

## Verified production finding — 2026-10-10

Read-only inspection verified Cloudflare user `07814ac610a382656508564ca444a1ec` / `nischalbachhar9@gmail.com`, Worker `sewak-final`, account `860970f755498a4fe10e16c2fa99ce55`, DB `sewak-db` / `36fa1df1-aa5d-43a1-ad0e-a4e310c513c3`, media binding, and audience `sewak-production`.

* No user or Cloudflare credential is associated with `nischalbachhar9@gmail.com`.
* One preserved profile, `hXaBhjmVrzVd4BXpwGUlwa8OtTz2`, is named Nischal Bachhar and has role `superadmin`, but has no email or Cloudflare credential. It cannot authenticate. Its name alone cannot prove ownership or safely justify adopting its ID.
* No credential-bearing Super Admin exists, including disabled accounts.
* The email-bound first-owner reservation is unused and expired at 2026-09-30 06:44:09 UTC. Its old secret is neither read nor printed by this tool.
* Migration documentation explicitly says the eight legacy Firebase credentials were not imported, while original application records were preserved. This explains the legacy profile's inability to sign in; there is no evidence that its role was removed. No new Firebase lookup was performed.

The appropriate action is a **new Cloudflare owner account**, preserving the legacy record and all its associations. The canonical internal role is `superadmin`; `super_admin` is not a valid database role and would fail the existing permission contract.

## Windows terminal troubleshooting

The earlier implementation sent non-secret approval phrases through the raw, hidden password reader and used a fixed five-minute deadline. Its catch handler hid the timeout reason. An approval requires Enter to reach that reader before the deadline; typing in a different pane or pasting without submitting cannot complete it. A general Windows/Node defect was not reproduced: the original reader accepted synthetic input in a Windows PowerShell pseudo-terminal. These findings do not establish exactly why the previous interactive attempt received no completed line.

Approvals now use standard [Node readline](https://nodejs.org/api/readline.html), with visible input, normal terminal handling, explicit steps, and up to three exact-match attempts. No phrase is prefilled or auto-approved. Passwords continue through a separate hidden reader; the visible reader and its echo listeners close before password entry. Timeout, Ctrl+C and non-interactive errors show fixed actionable messages without logging entered values. The five-minute deadline remains in place.

Tested locally on Windows PowerShell 5.1 and Node 25.6.0 through an actual Windows pseudo-terminal, including the npm.cmd invocation. Automated tests also feed raw CRLF/paste bytes and check timeout/cancellation cleanup. The ordinary Codex command runner has piped stdin and TERM=dumb; it is not a user-interactive terminal. A Codex pseudo-terminal can be exercised with synthetic input, but the real password must be entered by you in your own VS Code terminal. The VS Code GUI itself was not automated during this fix.

In VS Code, select **Terminal > New Terminal**, use the terminal profile dropdown to select **PowerShell**, and click inside the bottom **TERMINAL** panel. Do not use Output, Debug Console, or Codex chat. First run this optional, entirely offline check:

```powershell
npm.cmd run admin:terminal
```

At its visible prompt, paste `TERMINAL CHECK` and press Enter. At the two hidden prompts, type the same disposable test text (not your password) and press Enter after each. Wait for PASS. This helper has no Cloudflare imports, network requests, or account writes. If the terminal reports a timeout, click inside its input area and retry the check. An approval phrase should be visible immediately; hidden test text should never appear.

Both `npm.cmd run admin -- ...` and `npm.cmd run admin:recovery -- ...` now invoke exactly the same guarded recovery script. Previously only `admin:recovery` was defined; the `admin` alias has been added for compatibility with the reported command.

## Inspect and approve a concrete plan

```powershell
node worker/node_modules/wrangler/bin/wrangler.js whoami
$env:CLOUDFLARE_ACCOUNT_ID = '860970f755498a4fe10e16c2fa99ce55'
npm.cmd run admin:recovery -- inspect
npm.cmd run admin:recovery -- bootstrap --acknowledge-legacy-admin
```

If Wrangler is not signed in, run `node worker/node_modules/wrangler/bin/wrangler.js login` interactively, then repeat `whoami`. An expired OAuth token may be refreshed by `whoami`. A token that cannot read `/user` cannot authorize this tool. No raw token needs to be copied. Account selection above is a public ID, not a credential.

The first two recovery commands are read-only. Inspect prints only selected non-secret profile and setup status fields. The command verifies the exact Cloudflare user ID and email, local configuration, live Worker bindings and D1 metadata before querying data. It fails closed on ambiguity, incorrect targets, missing permissions, suspended/disabled accounts, changed roles, or unexpected administrators.

After reviewing and explicitly approving account creation, run:

```powershell
npm.cmd run admin -- bootstrap --acknowledge-legacy-admin --apply
```

When Step 1 appears, copy only the PRESERVE line below, click the terminal, paste with Ctrl+V, and press Enter. Wait for "Approval accepted" and Step 2 before copying/pasting the BOOTSTRAP line and pressing Enter. Paste one line at a time, without quotes or extra spaces:

```text
PRESERVE hXaBhjmVrzVd4BXpwGUlwa8OtTz2
BOOTSTRAP nischalbachhar9@gmail.com 36fa1df1-aa5d-43a1-ad0e-a4e310c513c3
```

Then enter your new password and confirmation **only at the hidden terminal prompts**. Approval phrases are visible. Password characters and asterisks are never echoed. Wait for the "New password" prompt before entering your password, press Enter, then repeat it at "Confirm new password" and press Enter. Completing the second password prompt permits the already-approved production write after the security checks pass. Use 12–128 characters; spaces are preserved. Ctrl+C cancels and each prompt expires after five minutes. Piped input/output is rejected. Never put the password in the command, chat, an environment variable, a file, or Git. The process exits after verification; JavaScript cannot guarantee zeroization of its in-memory strings.

The command uses the same `newAccountProfile`, record encoder, transactional repository and scrypt implementation as the application. It creates a random new ID and `superadmin` role, consumes the setup reservation permanently, and records the Cloudflare operator ID, target and reviewed legacy exception in `admin_audit_logs`. SQL guards and unique constraints prevent duplicate accounts and concurrent privilege changes. Failure of the audit write rolls back creation. The old legacy profile is preserved byte-for-byte.

The migration exception is limited to the single inspected, email-less, credential-less profile above. Any other Super Admin, including disabled or unactivated accounts, blocks CLI bootstrap. Existing authorized administrators must use the existing `provisionSuperAdminAccount` action for additional admins; changing the allowlist or database by hand is not a recovery procedure. Anyone with unrestricted Cloudflare D1 write credentials ultimately controls the database; local code guards do not override that infrastructure authority.

## Existing account password reset

If a future inspection finds the intended active Super Admin with Cloudflare credentials, use:

```powershell
npm.cmd run admin:recovery -- reset
npm.cmd run admin:recovery -- reset --apply
```

Type the displayed `RESET <email> <database ID>` phrase, then enter the password twice privately. The reset preserves the user row, ID, role, associations and existing audit records. One transaction changes only the credential hash/version, consumes outstanding invitations, deletes all old sessions and inserts the reset audit event. Disabled or suspended accounts are not re-enabled. Unknown outcomes after a timeout must be inspected before retrying; the tool does not automatically repeat writes.

After either operation, safe D1 checks verify the account and audit. The command performs an actual login with the password still in memory, checks the returned ID/role and an admin-only user listing, then signs out and deletes the verification session even if the authorization check fails. It prints success flags only. If login verification fails after commit, it explicitly reports that the account write committed; do not bootstrap again.

Login: <https://sewak-final.nischalbachhar9.workers.dev/auth>. The authenticated dashboard is `/superadmin`. Account creation/reset and login have **not** been performed as part of the read-only investigation. Successful production login is not established until the approved command completes and reports its verification flags.

## Future recovery and role loss

A recently authenticated Super Admin can issue an existing manual recovery invitation with `createAccountRecoveryInvitation` after independently verifying the recipient. New recovery invitations expire after 15 minutes; initial account activation invitations retain their one-day window. The existing `/account/setup#token=...` page consumes a single-use hashed token. Failed/expired/used tokens share an error; activation attempts are rate-limited. Issuing another invitation invalidates prior unused invitations. Successful reset consumes every outstanding token and revokes prior sessions; normal password change now consumes outstanding invitations too. Issuance and completion are audited. No anonymous email lookup or public privileged signup is added, and no automatic email-delivery or email-verification service is claimed. These Worker improvements take effect only after an authorized deployment.

For a future sole-owner lockout, the verified Cloudflare owner can use `reset --apply`. Additional admins recover through another recently signed-in Super Admin and a privately delivered invitation. Keep Cloudflare account recovery access current and enable MFA through Cloudflare account settings; no Cloudflare settings were changed here.

If the intended account exists with another role, the CLI refuses both reset and bootstrap. Investigate its creation/provisioning/organization-approval audit history and migration evidence. Record the expected role, current role, account ID, associations, and incident authorization. An existing authenticated Super Admin (or a separately verified Cloudflare-owner emergency review when none can sign in) must approve a narrowly scoped repair. Prepare and review a transaction guarded by the exact current user and credential versions that changes only the reviewed role fields, revokes sessions/invitations, increments credential version, and appends actor/reason/before/after audit evidence. Test it on an isolated copy before requesting explicit production approval. This tool deliberately contains no automatic role-elevation switch.

## Validation and release boundary

Run `npm.cmd run typecheck`, `npm.cmd run test:d1`, `npm.cmd run test:unit`, and `npm.cmd run build:release`. Tests use synthetic passwords only, including actual workerd/D1 transactions and Node-to-Durable-Object scrypt compatibility. They cover reset, bootstrap, duplicates, concurrency, unauthorized operators, wrong targets, sessions, authorization, audit rollback, unchanged ordinary/organization roles, private prompts and the legacy exception. Local workerd validation does not constitute a remote staging deployment or production login test.

No schema migration is needed. The CLI can operate with the currently deployed schema and login contract after account-write approval; deploying the Worker changes separately requires authorization. The retired `bootstrap-cloudflare-admin.mjs` now fails without writing or creating a token file.

References: [D1 transactional batches](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch), [REST batch format](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/), [OWASP password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

Validation completed on 2026-10-10: 49 D1/security tests (48 in the full sandboxed suite plus the workerd test rerun successfully outside its filesystem restriction), 38 frontend unit tests, Worker typecheck, frontend lint, release build, and whitespace checks passed. The new CLI production dry run passed without `--apply`. Remote staging deployment, production writes, production login, merge and deployment remain unperformed.

Terminal fix validation: the offline npm helper passed a real Windows PowerShell pseudo-terminal session with visible approval and two hidden synthetic entries. Automated terminal regression tests cover CRLF/paste, exact-match retries, editing, hidden-input transitions, timeout, cancellation, EOF, and non-interactive rejection. All 35 focused terminal, recovery, authentication and operator tests passed, along with git diff --check. No production database reads or writes were needed for this terminal fix.
