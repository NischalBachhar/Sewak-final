# Authentication and notifications implementation

## Audited baseline (2026-10-11)

- Clean checkout on `feature/secure-superadmin-recovery`; origin is `NischalBachhar/Sewak-final`.
- React Router, shared AuthContext and cookie auth; native mobile uses bearer sessions.
- Worker/D1 is authoritative. Existing scrypt Durable Object, CSRF, rate limits, credential versions, transaction guards and privileged operator recovery are retained.
- Migrations 0001–0004; no existing email verification, ordinary recovery, OIDC, durable notifications or web service worker.
- Customer/organization self-registration is atomic. Caregiver and household worker accounts are provisioned by an authorized organization; no independent self-registration contract exists. Combined organizations use the existing organization type and service model.
- Booking states: pending -> accepted -> in_progress -> completed. Customer cancellation is pending-only; caregiver decline is cancelled. Only the assigned authorized caregiver accepts. Payments and authorization remain unchanged.
- Hourly/shift/recurring requests store a scheduleAt. There is no authorized reschedule action or recurring occurrence generator: notifications must not invent these business operations.
- Care tasks, updates, completion and verified reviews already enforce ownership. Organization and superadmin permissions come from D1.
- Existing bell count is local completed-booking state, not an inbox. d1Client already uses visibility/focus refresh.
- Google Forms, OAuth and email providers are absent. PWA manifest exists; no push service worker.
- APP_WRITES_ENABLED blocks domain mutations. Staging is read-only; production config currently says true. Neither configuration nor remote state will be activated by this task.
- Existing workflows check mobile/Worker and read production health; no new deployment workflow will be introduced.

## Execution checklist

- [x] Add additive auth/token/OIDC, notification/outbox/preferences/subscription migration.
- [x] Require ownership verification; preserve restricted sign-in for existing users and privileged recovery.
- [x] Add ordinary 8–128 character password policy, confirmation and recovery UI.
- [x] Add configured-only OIDC with stable subject, state/nonce/PKCE, no email auto-linking.
- [x] Shared encrypted transactional outbox, real Resend adapter, quota reservation, leases/retries and accurate status.
- [x] Atomic notifications for supported booking/care/review/application/security mutations.
- [x] Durable reminders and pending escalation using existing schedules.
- [x] Accessible common dashboard inbox and preferences.
- [x] Encrypted user-owned subscriptions, Web Push, explicit permission UI, iPhone guidance.
- [x] Optional safe Forms links and sample quota-aware submission script.
- [x] Regression tests, build, lint, typecheck, migration/real-workerd checks and security scan; audit/mobile limitations recorded in the report.
- [x] Setup/limitations report and isolated feature delivery prepared; commit/push status is recorded in the final delivery response. No merge or production deployment.

Optional Apps Script mail relay is deferred unless it can meet the same replay/idempotency guarantees. The Forms submission example is separate from authentication delivery.
