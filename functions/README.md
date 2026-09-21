# Sewak Firebase Functions

The client integrates these existing callables with strict Firestore rules. This is not an unconnected foundation. Read [the release and verification report](../docs/SEWAK-FIX-REPORT.md) before any separately authorized release.

## Authorization and capabilities

All callable exports retain Firebase Authentication and App Check enforcement. Privileged requests require the appropriate `platformRole` claim and a current private `users/{uid}` record with a matching role that is neither suspended nor blacklisted. Caregiver provisioning additionally requires `organizationApproved: true` and a currently active private parent organization. The server validates service IDs, category and organization ownership.

- `provisionOrganizationAccount`, `provisionSuperAdminAccount`: superadmin-only, random never-returned passwords and authorized reset-link delivery.
- `approveOrganizationAccount`, `approveOrganizationApplication`: superadmin-only, current safety checks, operation-owned rollback, no unsuspension. Concurrent safety changes remain authoritative.
- `provisionCaregiverAccount`: approved organization-admin only; new caregivers remain unapproved until reviewed.
- `applyAccountSafetyAction`: superadmin-only, target identity checks, transactional private safety state, audit events and report status/receipt updates. Parent organization blocking is immediate while larger credential-revocation cascades continue.
- Public caregiver/service projection triggers reread current private records transactionally; stale event payloads cannot republish old state. Backfill functions remain bounded and authorized.
- `verifyFonepayPayment`: disabled scaffold; fails closed and never records browser callback claims as paid. Do not configure payment secrets or enable payment UI for this change.

The caller must handle a missing invitation link explicitly. Account creation may succeed even when link generation fails. Use the existing secure reset flow or an authorized operator process. No delivery provider has been added, and real inbox delivery was not tested.

## Local testing

The declared deployment runtime is Node 20. Root and Functions lockfiles are included. From the repository root:

```powershell
npm.cmd ci
npm.cmd --prefix functions ci
npm.cmd run lint
node scripts/test-emulators.cjs
```

Tests use synthetic data with the actual Firestore rules and Auth emulator, never production credentials. Backend tests exercise exported business operations with the demo Admin SDK. `npm --prefix functions test` deliberately requires the emulator environment; running it without that environment fails instead of silently discovering zero tests.

## Claims, App Check and legacy accounts

Browser role fields are immutable compatibility mirrors. Legacy Firestore role fallback is retained in rules/UI; privileged callables require real claims. Do not bulk-grant claims from arbitrary historical role values. A reviewed operator inventory must verify UID, role, organization membership, approval and safety state first.

`scripts/grant-platform-role.js` is an existing operator bootstrap for a reviewed superadmin. It is not a general migration tool and has not been run in this task. Organization/caregiver roles should use the authorized provisioning/approval flow. Refresh ID tokens after approval; use the existing safety action to remove privileged claims, disable affected Auth accounts and revoke refresh tokens. Firestore safety checks cover already-issued tokens while revocation takes effect.

Configure the public `REACT_APP_FIREBASE_APPCHECK_SITE_KEY`, authorized domains and registered web app before using deployed callables. Verify valid-token success and missing/invalid-token rejection in an authorized preview. Do not disable App Check or expose private collections for compatibility. Trial deployments without existing callable infrastructure continue to reject privileged operations and do not enable billing.
