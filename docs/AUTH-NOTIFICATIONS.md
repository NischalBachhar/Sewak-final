# Sewak authentication and notifications

Feature branch only. No remote migration, secret, Cron Trigger, Google project,
sender-domain record, provider account, staging deployment or production deployment
is created by this implementation.

## Existing architecture and migration

Apply `migrations/main/0005_auth_notifications.sql` with the normal versioned D1
migration workflow **after staging validation and before deploying this code**.
It adds `cf_credentials.email_verified_at` (NULL for every existing account),
`cf_email_tokens`, `cf_oauth_states`, `cf_oauth_identities`, `notifications`,
`notification_outbox`, `notification_preferences`, `push_subscriptions`,
`email_quota`, `notification_jobs`, and `email_webhook_receipts`. It adds indexes,
one participant view, and transaction-local notification triggers. No application
records or existing bookings are deleted. This is a one-time versioned migration,
not a SQL script to run repeatedly.

Existing users retain their credentials and can sign in to a restricted verification
screen, correct an unverified address after password authentication, resend a link,
or recover a password. Existing saved non-Gmail addresses may be verified rather
than discarded. No migration pretends existing addresses were verified. Protected
API access requires ownership verification; a transaction also rechecks credentials
and verification before a session-backed domain write. Superadmin access retains
its existing controlled recovery and authorization process, without falsely marking
its email verified. Announce this change and configure email before rollout to avoid
locking legitimate users out of services while delivery is unavailable.

New customer/organization registrations require Gmail. Dots and plus tags are kept;
normalization trims and lowercases but does not collapse aliases into another account.
Organization business domains can be allowed using `ORGANIZATION_EMAIL_DOMAINS`, a
comma-separated exact-domain allowlist. Ownership is still required. The current
signup form presents Gmail; enabling business domains also requires updating that
form's policy copy and validation. The existing organization provisioning pathway
for caregivers/household workers is retained; there is no new independent provider
self-signup workflow or invented role. Their activated accounts also need email
ownership verification before accessing protected services.

Ordinary passwords accept 8–128 characters, retain scrypt parameters, and reject a
small local common-password list. This is not a comprehensive breached-password
database. Superadmin creation, activation and password changes retain 12 characters.
Operator recovery remains unchanged. Public reset excludes privileged roles both
when issuing and when consuming a token. Reset revokes sessions/invitations and
increments the credential version. Google-only users receive sign-in guidance,
not an unsolicited password.

Tokens use 256 bits of randomness, SHA-256 lookup hashes, 30-minute expiry,
credential-version binding, transactional single consumption and 60-second resend
cooldowns, plus the existing IP/email rate limits. The durable delivery payload is
encrypted using AES-GCM with an independent Worker secret and row-bound associated
data. It is erased after submission, suppression, permanent failure or expiry. Raw
tokens never appear in production API responses/logs. Link fragments are consumed
and removed from browser history before React initializes. The app loads no third
party scripts, uses same-origin CSP, and sends no referrer.

## Resend setup (owner action)

1. Create/retain a free Resend account. Verify a **Sewak-owned domain** or sending
   subdomain. Do not use `resend.dev` for real customer delivery. Keep existing MX
   records; add the SPF/DKIM records Resend specifies and publish a reviewed DMARC
   policy. Check alignment before enforcing a strict DMARC policy.
2. Create a restricted sending API key. Store `RESEND_API_KEY`,
   `OUTBOX_ENCRYPTION_KEY` and `RESEND_WEBHOOK_SECRET` as Cloudflare Worker secrets,
   using separate values in staging and production. Never put them in React env
   variables, Git, command arguments, logs or screenshots.
3. Generate a random 32-byte base64url encryption key in a trusted local terminal.
   Keep it securely backed up: changing it invalidates queued encrypted mail and
   push subscriptions. Drain pending messages before planned rotation and require
   device re-enrollment afterward. Do not silently drop unreadable queued work.
4. Configure `EMAIL_PROVIDER=resend`, `EMAIL_FROM=notifications@<owned-domain>`
   (a plain address), and `APP_BASE_URL=https://<exact-sewak-origin>` without path,
   query or fragment. Set `EMAIL_DAILY_CAP` <=100 and `EMAIL_MONTHLY_CAP` <=3000.
   Lower them if other applications or inbound email use the same Resend account.
5. Disable provider link/open tracking for authentication emails. Test delivery only
   to an explicitly authorized owner/test inbox; never use customer addresses as
   test recipients. The automated tests stub outbound fetch and send no email.
6. Configure Resend webhooks for delivered, bounced, failed and complained events at
   `https://<origin>/api/email/webhook`. Set its signing secret in the Worker. Signed
   payloads require a timestamp within five minutes and deduplicate event IDs.
   API submission records `accepted`; only an authenticated delivery webhook records
   `delivered`. A callback arriving before acknowledgement returns 503 for retry.

Official limits checked October 11, 2026: [Resend free quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
are 100 emails per UTC day and 3,000 per month, including inbound messages. The
implementation reserves up to 20 daily and 200 monthly submissions for authentication
and security. Attempts count conservatively, even after uncertain provider failures.
It never upgrades a plan or enables billable overage. Quota exhaustion defers email;
in-app records remain available. Monitor account-wide provider usage separately.

## Google OIDC setup (owner action)

Create a Google Cloud OAuth web application client and configure the consent screen,
test users/publishing status and exact allowed origins. Register the exact redirect
URI `https://<APP_BASE_URL-origin>/api/auth/google/callback`. Store
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Worker configuration/secrets. Configure
staging separately. No Firebase auth dependency is required or restored.

The button is hidden when credentials/origin are absent. The authorization-code flow
uses browser-bound HttpOnly state, nonce and S256 PKCE. `jose` validates Google's
JWKS signature, RS256, issuer, audience, issued time, expiry, nonce and verified email.
Accounts are indexed by the stable Google subject. An existing matching email is a
conflict, never an implicit link; users must keep using their existing sign-in
method. An authenticated account-linking UI is not implemented. New Google users
complete the existing customer/organization onboarding flow; no privileged role is
granted. Caregiver Google enrollment/linking is not added to the provisioning flow.
See [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect).

## Durable notifications and scheduling

Booking requests, authorized acceptance, cancellation/decline, session start/end,
care milestones, review invitations, new verified reviews, organization applications
and decisions, provider applications/approval changes, password changes and selected
existing administrator security audit events create notifications. Triggers run in
the same D1 transaction as the domain mutation and initial outbox. Failure rolls all
three back. Unique event keys deduplicate repeated writes. Messages use generic
wording; notes, patient/child details, addresses, documents and payment data are never
copied. Deep links retain the existing API resource authorization.

The current state machine uses `cancelled` for declines and cancellations, so alerts
say "cancelled or declined". There is no rescheduling action, information-request
application workflow, independent-provider self-application process, or recurring
occurrence generator to attach to. Those remain product work, not fabricated events.
Reminders use the real stored schedule for hourly, shift and recurring requests;
future recurring visits need explicit occurrences before they can be reminded.
Arbitrary care notes do not trigger external alerts; milestones do. There is no new
suspicious-login detector or incident-management system.

`scheduled()` recovers delivery work from D1 and creates 24-hour/1-hour reminders and
one pending escalation after `PENDING_ESCALATION_HOURS` (default 6). Reminders check
current eligibility again at delivery. Presentation uses Asia/Kathmandu. In-app,
email and push preferences apply by category; security in-app/email cannot be muted.
`ne` can be stored as the future language preference, but messages currently remain
English. Quiet hours are not implemented.

Before enabling scheduling, inspect the actual account's Workers/D1 limits and
existing Cron Trigger count. This session does not enable Queues or Cron. After
owner-authorized staging deployment and load validation, add a cron such as:

```toml
[triggers]
crons = ["* * * * *"]
```

Set `NOTIFICATION_PROCESSING_ENABLED=true` only after integrations are ready.
`APP_WRITES_ENABLED` must also be true for processing/domain mutation. D1 is the
durable queue; no paid Queue dependency is required. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
and [Queues limits](https://developers.cloudflare.com/queues/platform/limits/) must be
checked against the actual account before activation. Free Queues' 24-hour retention
is why D1 remains authoritative if acceleration is added later.

A short global lease throttles processing to two delivery jobs per minute. Claims
have individual leases and recover after crashes. Transient failures back off up to
one hour, while authentication sorts first. Retries use the same encrypted request
and [Resend idempotency key](https://resend.com/docs/dashboard/emails/idempotency-keys).
The retry window stops before the provider's 24-hour idempotency retention to avoid
unsafe late replay. Email and push are at-least-once, not universally exactly-once.
Terminal failures remain visible to operators. Token delivery expires after 30
minutes, ordinary email work after seven days, and push after one day. Read inbox
history is bounded to 90 days once associated delivery work is terminal. D1 reads,
writes, storage and cron CPU need staging load measurement; no paid capacity was
activated. This conservative processor is intended for low volume, not mass mail.

Operator observability (run only against the intended DB):

```sql
SELECT channel,status,last_error_code,COUNT(*) FROM notification_outbox
GROUP BY channel,status,last_error_code;
SELECT MIN(created_at),COUNT(*) FROM notification_outbox
WHERE status IN ('pending','processing','temporary_failure','deferred_quota');
SELECT bucket,used FROM email_quota ORDER BY bucket DESC;
```

Do not dump encrypted payloads or endpoint credentials into logs. No public endpoint
exposes the outbox or provider references. No mass retry button bypasses quota or
idempotency retention. Correct configuration, let eligible retries run, and ask users
to request fresh expired authentication links.

## Web Push (owner action)

Generate a VAPID P-256 keypair using a trusted Web Push utility. Store the base64url
private key in `VAPID_PRIVATE_KEY`, its uncompressed public key in `VAPID_PUBLIC_KEY`,
and a valid contact URI such as `mailto:<owner-contact>` in `VAPID_SUBJECT`. Use
separate staging credentials. Subscription credentials are AES-GCM encrypted, with
hashed endpoint uniqueness and explicit ownership checks; enrollment never moves a
device from another user. Users can list/revoke devices or unsubscribe this browser.
Password changes/account restrictions revoke subscriptions; 404/410 retires endpoints.

The service worker caches no private responses. Permission is requested only after
the user clicks Enable in notification settings. Denial/unsupported browsers keep
the inbox. Lock-screen content is generic and click navigation opens the authorized
app. Chrome/Edge/Firefox/Safari use standard Push APIs. [iOS/iPadOS Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
requires a compatible installed web app (iOS/iPadOS 16.4+); ordinary tabs are not
promised equivalent support. No Apple Developer subscription is required for standard
Web Push. Physical-device delivery still needs configured VAPID keys and owner tests.

## Optional Forms and Apps Script

Create separate non-sensitive feedback/partnership Forms. Tell respondents not to
submit medical details, identity documents, care notes or booking/payment details.
Set `GOOGLE_FEEDBACK_FORM_URL` and/or `GOOGLE_PARTNERSHIP_FORM_URL` to actual HTTPS
Google Forms URLs. Unconfigured links are hidden. Links appear in the account menu,
open with no referrer, and include no automatic user/booking prefill. Verified reviews
continue to use Sewak's existing review records.

Use `docs/examples/google-form-alert.gs` in the linked response Sheet. Configure the
Script Properties described there, including the fixed status column, and install
an authorized Sheets on-form-submit trigger. Restrict Sheet access to appropriate
admins. The email says only that a response exists; it never forwards form contents.
Check [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
and `MailApp.getRemainingDailyQuota()` (consumer accounts commonly allow 100 daily
recipients; Workspace limits differ). Quota exhaustion records a deferred marker.
Do not publish it as a public relay. A general Apps Script email-provider adapter is
not included: MailApp lacks provider idempotency and is not used for auth delivery.
Automated WhatsApp and SMS are not enabled and have no dependency here.

## Release sequence and remaining validation

1. Review/merge only with separate authorization. Retain this feature branch until then.
2. Configure an isolated staging sender, origin, OAuth client, VAPID keys and secrets.
3. Back up staging D1; apply migration 0005 once and verify integrity.
4. Deploy staging through the existing guarded workflow; enable only authorized staging writes.
5. Verify real email submission/webhook delivery, Gmail ownership, reset replay,
   Google consent/callback/account conflicts, and real desktop/Android/iPhone push.
6. Inspect quotas and cron availability, then enable staging scheduling and measure CPU/queries.
7. Review accessibility, mobile behavior, security checks and migration results.
8. Seek separate production authorization. Configure production before enforcement;
   announce verification requirements to existing users. Do not silently enable paid plans.

Automated local validation is recorded in `AUTH-NOTIFICATIONS-REPORT.md`. Passing local
tests does not establish live email delivery, Google consent approval, DNS alignment,
physical-device push delivery or production activation.
