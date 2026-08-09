# Sewak Firebase Functions

This folder is an isolated server-side foundation. It intentionally does not
rewire the existing client or make the current Firestore rules safe by itself.
Deploy the corresponding rules and client integrations before exposing these
callables in production.

## What it provides

- Claim-authorized callable provisioning for organization-admin accounts.
- Claim-authorized callable provisioning for super-admin accounts.
- Claim-authorized caregiver provisioning for approved organization admins.
- Claim-authorized organization approval that issues the caregiver-provisioning
  claim only after server-side validation.
- Claim-authorized conversion of a pending organization application into an
  approved organization-admin account.
- A one-time, operator-run bootstrap script for the first super-admin claim.
- A Fonepay verification scaffold that fails closed and never marks a client
  payment as paid.

The privilege source is the Firebase Authentication custom claim
platformRole, not a browser-writeable Firestore role field. The Firestore role
field remains a compatibility mirror for the existing client and must be made
immutable by Firestore rules.

## Local setup

No dependencies were installed as part of this change. From this folder, run:

~~~powershell
npm install
npm run lint
~~~

The production runtime is Node 20. Firebase CLI must target the existing
care-53593 project defined in the repository .firebaserc file.

## Bootstrap the first super admin

Create the intended administrator in Firebase Authentication first. Then, from
an operator-controlled machine with a service-account credential outside this
repository:

~~~powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\secure\care-53593-service-account.json'
$env:FIREBASE_PROJECT_ID = 'care-53593'
node .\scripts\grant-platform-role.js --email admin@example.com --role superadmin --confirm-superadmin
~~~

The script never creates a default account or password. It can grant only the
superadmin claim, writes an audit record, and requires an explicit confirmation
flag. The administrator must sign in again or refresh their Firebase ID token
before calling the provisioning functions.

## Callable contracts

All callables require Firebase Authentication and Firebase App Check.
provisionOrganizationAccount and provisionSuperAdminAccount additionally
require:

~~~text
request.auth.token.platformRole === "superadmin"
~~~

provisionCaregiverAccount additionally requires both:

~~~text
request.auth.token.platformRole === "orgadmin"
request.auth.token.organizationApproved === true
~~~

Set organizationApproved only through a trusted Admin SDK approval operation
after the organization has completed verification. Do not treat the current
browser-writeable organizations.isApproved field as authorization until the
Firestore rules lock it down.

applyAccountSafetyAction additionally requires a super-admin claim and App
Check. It accepts only:

~~~json
{
  "targetType": "customer",
  "targetId": "existing-document-id",
  "reason": "Concise safety reason",
  "reportId": "optional-pending-blacklist-report-id"
}
~~~

targetType is exactly organization, caregiver, or customer; targetId must be
the matching organization document ID, caregiver/vendor UID, or customer UID.
reportId is accepted only for a customer and must identify that customer's
pending blacklist report. In that case, the callable validates the report,
suspends and blacklists the account, creates its deterministic blacklist entry,
and marks the report approved in one Firestore transaction.

The function rejects mismatched records, unknown request fields, non-superadmin
targets, and stale record identities. It atomically marks the relevant private
record(s) suspended and blacklisted, records the reason and an admin audit
event, and writes a deterministic blacklist record. Caregiver actions also
make the vendor unavailable and remove its publicCaregivers projection.
Organization actions immediately suspend the organization and its admin account.
For teams that fit within Firestore's transaction limit, affiliated caregivers
are included in that atomic transaction. Larger teams are suspended in bounded,
idempotent batches after the parent safety block; deployed Rules use that parent
state to block new bookings and active-care actions during the cascade.

After the Firestore transaction, the function removes platformRole and
organizationApproved from the target's Firebase Auth custom claims, disables
the Auth user, and revokes refresh tokens while preserving unrelated claims.
Auth and Firestore cannot share one transaction, so the Firestore block is
committed first and the audit record reports complete, partial, or not-found
Auth revocation. A partial result is still fail-closed for new bookings and
caregiver provisioning when the matching Firestore rules and callable DB check
are deployed. For a large organization, only the bounded transactional set is
sent to Firebase Auth in the request; staff work access remains blocked by the
organization and vendor state while the server-side data cascade completes.

The caregiver-provisioning callable independently rechecks that the
organization is approved, verified, not suspended, and not blacklisted. That
database check prevents a previously issued orgadmin token from provisioning a
caregiver after an organization safety action.

approveOrganizationAccount accepts only:

~~~json
{
  "organizationId": "existing-organization-document-id"
}
~~~

It requires a super-admin claim, verifies the organization record and linked
orgadmin user record, then marks both records approved and verified in a Firestore
transaction and writes an audit entry. It sets the linked Firebase Auth user's
platformRole to orgadmin and organizationApproved to true, preserving unrelated
custom claims. Firebase Auth custom-claim updates cannot be part of a Firestore
transaction, so the function performs Firestore first and rolls those approval
fields back if the custom-claim update fails. Until the claim succeeds, the
caregiver callable remains denied.

approveOrganizationApplication accepts only:

~~~json
{
  "applicationId": "pending-organization-application-document-id"
}
~~~

It requires a super-admin claim and App Check. The function reads a pending
organizationApplications record with applicantId, applicantName,
applicantEmail, organizationName, businessPhone, businessAddress, businessCity,
status, and createdAt. It verifies that the listed applicant is an enabled
Firebase Auth user with the same email, then creates or verifies the
organizations record, converts the users record to orgadmin, approves and
verifies those records, and marks the application approved in one Firestore
transaction with an audit entry. It preserves unrelated Firebase Auth custom
claims while setting platformRole to orgadmin and organizationApproved to true.

Firebase Auth and Firestore cannot share one transaction. If setting the Auth
claims fails, the function restores the application to pending and attempts to
roll back the fields/documents introduced by the approval, then writes a
claim-sync failure audit record. The application stays denied to caregiver
provisioning until the custom claim succeeds.

provisionOrganizationAccount accepts only:

~~~json
{
  "email": "partner@example.com",
  "displayName": "Partner Admin",
  "organizationName": "Example Care",
  "businessPhone": "+977...",
  "businessAddress": "Optional address",
  "businessCity": "Hetauda"
}
~~~

provisionSuperAdminAccount accepts only:

~~~json
{
  "email": "operations@example.com",
  "displayName": "Operations Lead"
}
~~~

provisionCaregiverAccount accepts only:

~~~json
{
  "email": "caregiver@example.com",
  "displayName": "Sushmita Shrestha",
  "phone": "+977...",
  "location": "Hetauda",
  "category": "caregiver",
  "workType": "parttime",
  "shifts": ["morning"],
  "servicesOffered": ["existing-service-document-id"],
  "hourlyRate": 500,
  "experience": 3
}
~~~

The server verifies that referenced service documents exist and derives the
organization identity from the authenticated organization-admin account. It
creates a caregiver claim plus users and vendors records in one Firestore
batch, records an audit event, and adds the caregiver ID to that organization.
The caregiver starts unapproved, unavailable, and explicitly not verified. It
sets no rating or satisfaction score; completed sessions and verified reviews
must populate those later.

Every account-provisioning callable creates a random, never-returned one-time
password and returns a Firebase password-reset link only to its authorized
caller. Send that link through an approved out-of-band channel; never log it or
store it in Firestore. Firebase Authentication Email/Password must be enabled
for the invitation link to work.

## Fonepay configuration and safety

Before deployment, set these Cloud Secret Manager values from the repository
root. Do not put them in frontend variables or commit them to a dotenv file:

~~~powershell
npx.cmd -y firebase-tools@latest functions:secrets:set FONEPAY_MERCHANT_CODE --project care-53593
npx.cmd -y firebase-tools@latest functions:secrets:set FONEPAY_SECRET --project care-53593
npx.cmd -y firebase-tools@latest functions:secrets:set FONEPAY_VERIFY_URL --project care-53593
~~~

verifyFonepayPayment accepts only a paymentReference. It rejects missing server
configuration and, even when configuration exists, returns unimplemented until
an official Fonepay server-to-server verification adapter is supplied. It does
not accept browser redirect status, amount, transaction ID, booking data, or
session storage as proof of payment. It does not write a paid status.

When implementing the adapter, first create a payment intent server-side; bind
it to the customer, booking, expected amount, and idempotency key. Verify the
gateway signature and amount on the server, then make one idempotent
transaction that records payment and updates downstream records.

## Required follow-up before deployment

1. Replace client-trusted role checks in Firestore rules with custom-claim
   authorization and lock role, approval, verification, ownership, payment,
   and earnings fields against client writes.
2. Move booking creation, assignment, cancellation/status transitions,
   caregiver provisioning, and payment completion to callables or trusted
   server endpoints.
3. Configure Firebase App Check for the web application before integrating
   these endpoints. Set the public `REACT_APP_FIREBASE_APPCHECK_SITE_KEY` from
   the repository `.env.example` in the deployed web environment.
4. Add a secure email-delivery provider or approved operations process for
   the returned password-reset links.
5. Deploy only after installing dependencies and testing in the Firebase
   Emulator Suite or a preview environment.
