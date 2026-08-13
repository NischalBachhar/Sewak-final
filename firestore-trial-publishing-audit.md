# Trial public caregiver publishing audit

Scope: Firebase Spark-plan replacement for the unavailable Cloud Functions
projection sync. A signed-in superadmin can publish only an allowlisted,
PII-free caregiver projection to `publicCaregivers` from the Admin dashboard.

## Data and query inventory

- Source: `vendors/{caregiverId}` (private profile; contains email/phone and is
  never readable by the public).
- Public output: `publicCaregivers/{caregiverId}`. Browse queries require
  `isApproved == true`, `isSuspended == false`, `isBlacklisted == false`, and
  `isOrganizationActive == true`.
- Writer: Admin dashboard only, authenticated as an existing superadmin. It
  copies a fixed safe-field list and removes stale projections for ineligible
  source records.

## Rule design

- Default policy remains deny.
- Public reads stay limited to active projection documents. Private vendor
  records remain owner/organization/superadmin-only.
- Creates and updates require a superadmin and the exact strict public schema:
  bounded strings, bounded lists, numeric ranges, timestamp, fixed active
  flags, and verified-rating invariant.
- Deletes require a superadmin. No customer, caregiver, or organization account
  gains write access to a projection.

## Red-team checks

1. Anonymous/private-vendor read: denied; this change has no `vendors` read
   change.
2. Self-publish by a caregiver/customer: denied; writer requires superadmin.
3. PII injection: denied; email, phone, address, earnings, and audit keys are
   outside the allowlist.
4. Update bypass: denied; create and update use the same public projection
   validator.
5. Fake rating: denied when `reviewCount` is zero; all ratings are range-bound.
6. Suspended/blacklisted projection: denied; all four public-eligibility flags
   must have safe values.
7. Arbitrary large values: bounded strings/lists and numeric ranges prevent
   projection storage abuse.
