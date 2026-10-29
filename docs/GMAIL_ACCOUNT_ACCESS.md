# Gmail access, password recovery and email updates

This change adds Gmail-based Google sign-in, email ownership verification, password reset links and optional email delivery of existing Sewak notifications. It does not read users' Gmail inboxes or request Gmail API permissions. Existing passwords and all four D1 account roles remain supported.

## Account behavior

- **Continue with Google** uses the server authorization-code flow with PKCE, a browser-bound HttpOnly state cookie and a single-use ten-minute D1 state record. The Worker verifies Google's RS256 signature, issuer, client audience, authorized party, expiry, issued time, nonce, stable subject and verified Gmail address. It stores the Google subject; it never stores Google access/refresh tokens.
- New Google accounts start as ordinary incomplete customer identities. The existing registration flow collects their Customer, Caregiver or Organization application. Existing approval and authorization checks remain in force. Google does not grant administrator privileges.
- Existing password accounts sign in first, then select **Connect Google** in Notifications. They must choose the exact Gmail address registered with Sewak. There is no anonymous account linking by email alone. Invited accounts must complete their original account setup first. Reserved owner setup cannot be claimed through Google registration.
- Password accounts receive a verification email on registration when email sending is configured. They can request another from Notifications. Verification requires an explicit button press, so email link scanners do not consume it.
- **Forgot password?** sends an eligible password account a 30-minute link. Known/unknown/ineligible addresses receive the same response. In the deployed Worker, provider delivery runs through `waitUntil` so provider latency does not reveal account existence. Operational send failures are logged without addresses or links. A generic acknowledgment does not guarantee inbox delivery.
- Reset/verification tokens are random, hashed in D1, expiring, credential-version-bound and single-use. Links put the token in the URL fragment, then remove it from browser history. Reset atomically invalidates all prior Sewak sessions and recovery invitations; it does not change the Google account password.
- Google-only accounts use Google recovery. The Sewak reset form explains this and does not create a password for an unactivated or Google-only identity.

## Email delivery and consent

Transactional messages are sent through Resend to Gmail or another existing verified account address. A Gmail inbox can receive these emails without granting Sewak mailbox access. Gmail-only Google login does not disable existing non-Gmail password accounts.

Email care updates default to **off**. Users verify their account email and explicitly enable **Send care updates to my email** in Notifications. Appointment reminders retain their independent preference. The existing 15-minute cron delivers new messages, booking lifecycle updates, approval notices and other in-app notifications, up to 20 eligible notifications per run. Backlog/provider failures can delay delivery. No historical notification flood occurs on enablement.

Emails contain a general update and an authenticated Sewak link. Medical details, message bodies, names and private addresses stay inside Sewak. Disabled/suspended recipients and suspended organization caregivers are excluded. Delivery uses a leased D1 record, a stable provider idempotency key and at most five attempts within 24 hours. `accepted_at` means accepted by the email provider, not proof of inbox delivery. Bounces, spam filtering and sender reputation still require operator monitoring in Resend.

## Required production configuration

The implementation remains unavailable until its provider configuration is present. Do not paste secrets into chats, source files, client-side `REACT_APP_*` variables, screenshots or logs.

1. In Google Cloud / Google Auth Platform, configure Sewak branding, audience, support contact and consent. Create an OAuth **Web application** client. Add this exact authorized redirect URI:
   `https://sewak-final.nischalbachhar9.workers.dev/api/auth/google/callback`
   Publish the audience for intended users after testing; a testing audience only permits Google test users. Follow Google's domain/brand verification requirements, using an owned custom domain if required.
2. Create/configure a Resend account and verify an owned sending domain with its required DNS records. Choose a sender such as `Sewak <care@YOUR_VERIFIED_DOMAIN>`. The sender cannot be an arbitrary personal `@gmail.com` address. Check quotas in the selected plan; do not enable paid billing automatically.
3. Select the Sewak Cloudflare account `860970f755498a4fe10e16c2fa99ce55`. The production Worker is `sewak-final`; use `wrangler.production.toml`, never the separate staging bindings or the Shoe Doctor account.
4. Set these server bindings securely using Wrangler's interactive secret prompts (from the repository root):

   ```sh
   npx --prefix worker wrangler secret put GOOGLE_CLIENT_ID --config wrangler.production.toml
   npx --prefix worker wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.production.toml
   npx --prefix worker wrangler secret put RESEND_API_KEY --config wrangler.production.toml
   npx --prefix worker wrangler secret put EMAIL_FROM --config wrangler.production.toml
   ```

   `APP_ORIGIN` is already pinned to `https://sewak-final.nischalbachhar9.workers.dev` in the production config. Google client ID and sender are public metadata but may safely use secret bindings. Do not replace the existing verification encryption key or any other production secrets.

## Migration and release

Migration `0013_google_email.sql` adds nullable Google/email verification columns, token/state tables, email preference columns and delivery tracking. Existing account data is preserved. The deployment guard requires this journaled migration before uploading the new Worker. The migration planner permits only the four exact reviewed `ADD COLUMN` statements alongside additive CREATE statements. It rejects drift and partial or unjournaled states.

Use the existing reviewed operator workflow in [Cloudflare Auth](CLOUDFLARE_AUTH.md) and [marketplace migration operator](../scripts/migrate-marketplace.mjs): refresh D1 integrity, registration-based Auth QA and verified backups first. `node scripts/migrate-marketplace.mjs` shows the read-only plan. Apply with the documented `--apply --auth-qa PATH` option only after its evidence checks pass. It compares every preexisting row and column before/after, while allowing the newly added columns. Keep application traffic controlled during the migration's snapshot check so unrelated live writes do not invalidate the comparison. Do not clear rate limits, reuse stale evidence or bypass guards.

Then refresh the required release evidence, build and run the guarded deployment:

```sh
npm run typecheck
npm run test:d1
npm run test:unit -- --silent
npm run lint
npm run test:browser -- gmail-account-access.spec.cjs
npm run build:release
npm run deploy:cloudflare -- --worker sewak-final --dry-run
node scripts/scan-release.mjs
npm run deploy:cloudflare -- --worker sewak-final --validation PATH_TO_FRESH_D1_REPORT --auth-qa PATH_TO_FRESH_PASSING_AUTH_REPORT
```

Use the production canonical origin environment variable for the release build as in the existing deployment instructions. Preserve all three production databases, PasswordHasher, cron, application writes and disconnected automatic Workers Builds. Staging must be migrated separately and use separate OAuth/sender credentials if enabled.

## Live acceptance checks

- New Gmail user: Google consent, choose account, complete the intended role's registration, refresh, sign out and sign back in. Test caregiver/organization approval boundaries and existing superadmin access.
- Existing password user: password login, connect matching Gmail, sign out, Google login. A different Gmail and an anonymous attempt to claim an existing password account must fail.
- Cancel Google sign-in; test expired callback state and unavailable provider configuration. The UI should offer a clear retry path.
- New password user: receive verification, confirm once, reject reuse. Enable email updates and verify the independent reminder setting.
- Password recovery: real inbox receipt, expired/single-use link behavior, new password works, old password and old sessions fail. Google-only recovery stays with Google.
- Trigger one synthetic booking update/message and verify opt-in delivery and opt-out. Confirm private details are absent from email. Inspect provider acceptance/bounce status. Clean up synthetic identities and records.
- Confirm the active Cloudflare version is serving 100% of traffic and `/api/health` is healthy. A locally passing mock-provider test is not proof of live Google consent or inbox delivery.

References: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
