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
- Legacy trial account records that omit `isSuspended` or `isBlacklisted` are
  treated as unblocked; an explicit `true` still blocks access. This avoids a
  missing optional field becoming a permission-evaluation error.
- A legacy organization owner may resolve the `orgadmin` role from its own
  immutable, superadmin-created organization record only when its `adminUid`
  equals the caller UID.
- Pending, non-blocked organization/caregiver accounts may read only their own
  operations records. Approval is still required for public listing, customer
  booking, or role-managed writes.

## Rule design

- Default policy remains deny.
- Public reads stay limited to active projection documents. Private vendor
  records remain owner/organization/superadmin-only.
- Superadmins may list every public projection solely to remove stale entries;
  public visitors still see only active projections.
- Organization and caregiver read rules remain scoped to matching owner IDs;
  the pending-read compatibility path does not authorize cross-organization
  data access or any status transition.
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
8. Cross-organization dashboard access: denied because the legacy fallback
   applies only to the organization document keyed by the caller and every
   organization data query still requires the caller's matching organization ID.
9. Pending account actions: denied where an active approval state is required;
   the compatibility rules grant read-only operational visibility, not booking,
   public-listing, or role-management authority.
