# Firestore security audit

## Reviewed client collections and access patterns

- `users`: customer, organization, caregiver, and superadmin profiles. These documents include private contact details, so only their owner and a superadmin may read them.
- `organizations`: partner organization profile and operational counters.
- `vendors`: caregiver profile. The current legacy document mixes public discovery fields with private email and phone; public discovery should use only approved records and the UI must avoid displaying the private fields.
- `bookings`: customer/caregiver-owned service request and its status transitions.
- `careSessions/{bookingId}`, `tasks`, and `updates`: newly introduced live care data. Customers are read-only; only the assigned caregiver can create session activity.
- `reviews/{bookingId}`: one verified review per completed booking, written only by that booking's customer.
- Existing operational collections: `services`, `blacklist`, `blacklistReports`, `organizationBlacklist`, `settings`, `caregiverReports`, and `adminPasswordResets`.
- `adminAuditLogs`: server-only audit records written by the callable provisioning foundation; no client rule grants access.

## High-risk findings before this change

- A user could change their own `role` and become a superadmin.
- Any signed-in user could write any booking.
- A caregiver could self-approve, self-verify, or alter ratings/earnings.
- All signed-in users could list customer profiles that may contain private contact details.
- The browser payment callback trusted query parameters and could mark a payment as paid.

## Security model implemented in `firestore.rules`

- Default deny, immutable role/ownership fields, and owner-scoped profile edits. Existing superadmin records remain a compatibility authorization source; new server-provisioned accounts also receive a `platformRole` custom claim.
- No global `users` list; only a locked superadmin document can read operational collections.
- A booking can only be created by its customer, accepted/cancelled by its assigned caregiver, cancelled by its customer while pending, and moved through active/completed status as part of the care-session workflow.
- Care-session task and update writes are limited to the assigned caregiver; the assigned customer can read only their own session.
- Reviews are deterministic by booking ID and can only be submitted by the customer after completion.
- Public caregiver, service, and review data are served from PII-free projections; private `vendors` and `reviews` are no longer public collections.
- An active organization state is required for organization-admin private reads, caregiver active-care actions, and new bookings with organization-affiliated caregivers. This removes access immediately even if a previously issued Firebase Auth token has not yet refreshed.
- The trusted `applyAccountSafetyAction` callable can atomically suspend a customer and approve its pending blacklist report, or suspend a caregiver/organization and record a safety audit. Organization caregiver records are cascaded in bounded batches when the atomic transaction limit would be exceeded.

## Devil's-advocate checks performed locally

- **Self-elevation:** new browser user creation is limited to `role: user`; privileged claims and records require Admin SDK callables.
- **Cross-account booking changes:** booking writes are owner/assigned-caregiver transitions only, with field/schema validation and valid status paths.
- **Forged payment:** client booking creation accepts cash only; the Fonepay callback fails closed until a server verification flow exists.
- **Mixed-content exposure:** public reads target `publicCaregivers`, `publicServices`, and `publicReviews`; vendor contact data remains in the private collection.
- **Suspended organization token:** private organization reads now require live approved/not-suspended/not-blacklisted organization state, not only an Auth claim.
- **Suspended caregiver work:** active booking/session/task/update actions require live vendor and parent-organization state.
- **Unavailable caregiver deep link:** booking creation checks the live approved, available, non-suspended/non-blacklisted vendor record.
- **Report-only blacklist:** approving a report uses the server callable to update the account state, blacklist record, report status, and audit in one transaction.
- **Schema pollution:** owner updates validate the full post-update document and lock role, approval, verification, payout, and ownership fields.
- **Direct browser deletion:** high-risk user/vendor/organization/booking deletion is denied; account removal requires a trusted Admin SDK workflow that also handles Auth.

## Limits that need a server-side follow-up

- The new `functions/` foundation provisions organization and superadmin accounts with Admin SDK/custom claims and writes an audit record, but it must be deployed with App Check and the one-time trusted bootstrap procedure before its callables can be used.
- Payment provider callbacks, payout settlement, irreversible verification approval, and aggregate ratings should move to a Firebase Admin SDK/Cloud Function before production launch. The browser no longer treats a Fonepay return URL as proof of payment.
- Firebase Storage is used for profile photos but no Storage rules are tracked in this repository. Its deployed rules need a separate review before broad launch.
