# Main D1 schema

`DB` binds `sewak-db`. Ordered SQL is in `migrations/main`. This file describes the actual entity map in `worker/src/model.mjs`; regenerate with `node scripts/generate-d1-schema-doc.mjs`.

## Representation and integrity

Original Firebase document IDs remain immutable text primary keys for reconciliation. New Cloudflare accounts use random usr_ IDs and never adopt old Firebase Auth identities. Child keys combine session ID and child ID; the API exposes original child IDs. Each document table has `version`, `fields_present` and `extra_json`. Known queried/scalar fields use typed columns; unqueried historical extensions remain structured JSON, not whole opaque document blobs. Presence metadata preserves missing versus explicit NULL. UTC timestamp text preserves the source fractional precision. Boolean/JSON/rate/rating/role constraints enforce supported values. Relationships are deferred FKs, not inferred from names/emails. Caregiver service links are normalized in `caregiver_services`; legacy arrays remain for exact source reconstruction.

Partial skeleton imports require read-only maintenance. Main writes use parameterized statements and atomic batches with version guards for every authorization source read. Guards fail a concurrent change without committing partial writes. Updates clear removed indexed values instead of leaving stale ownership/status columns. Historical deleted services are preserved explicitly in legacy metadata with a NULL FK; other missing mandatory references fail migration.

Public records are allowlisted projections of current sources, never trusted from historical public copies. Main lists do not select media bytes. Main `profile_image_id` references use app-level ownership validation across separate databases.

## Entity tables

### users

Source: `users`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| uid | uid | TEXT |  |
| name | name | TEXT |  |
| email | email | TEXT |  |
| role | role | TEXT |  |
| phone | phone | TEXT |  |
| address | address | TEXT |  |
| city | city | TEXT |  |
| location | location | TEXT |  |
| profileComplete | profile_complete | INTEGER boolean |  |
| isApproved | is_approved | INTEGER boolean |  |
| isSuspended | is_suspended | INTEGER boolean |  |
| isBlacklisted | is_blacklisted | INTEGER boolean |  |
| organizationId | organization_id | TEXT | organizations |
| profile_image_id | profile_image_id | TEXT |  |
| tokensValidAfter | tokens_valid_after | REAL/INTEGER |  |

### organizations

Source: `organizations`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| organizationId | organization_id | TEXT |  |
| adminUid | admin_uid | TEXT | users |
| organizationName | organization_name | TEXT |  |
| adminName | admin_name | TEXT |  |
| adminEmail | admin_email | TEXT |  |
| businessPhone | business_phone | TEXT |  |
| businessAddress | business_address | TEXT |  |
| businessCity | business_city | TEXT |  |
| businessLicense | business_license | TEXT |  |
| commissionRate | commission_rate | REAL/INTEGER |  |
| verified | verified | INTEGER boolean |  |
| profileComplete | profile_complete | INTEGER boolean |  |
| role | role | TEXT |  |
| isApproved | is_approved | INTEGER boolean |  |
| isSuspended | is_suspended | INTEGER boolean |  |
| isBlacklisted | is_blacklisted | INTEGER boolean |  |

### organization_applications

Source: `organizationApplications`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| applicantId | applicant_id | TEXT | users |
| applicantName | applicant_name | TEXT |  |
| applicantEmail | applicant_email | TEXT |  |
| organizationName | organization_name | TEXT |  |
| businessPhone | business_phone | TEXT |  |
| businessAddress | business_address | TEXT |  |
| businessCity | business_city | TEXT |  |
| status | status | TEXT |  |

### caregivers

Source: `vendors`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| uid | uid | TEXT |  |
| vendorId | vendor_id | TEXT |  |
| name | name | TEXT |  |
| email | email | TEXT |  |
| phone | phone | TEXT |  |
| location | location | TEXT |  |
| category | category | TEXT |  |
| workType | work_type | TEXT |  |
| shifts | shifts | TEXT JSON |  |
| servicesOffered | services_offered | TEXT JSON |  |
| hourlyRate | hourly_rate | REAL/INTEGER |  |
| experience | experience | REAL/INTEGER |  |
| bio | bio | TEXT |  |
| jobsCompleted | jobs_completed | REAL/INTEGER |  |
| rating | rating | REAL/INTEGER |  |
| reviewCount | review_count | REAL/INTEGER |  |
| verified | verified | INTEGER boolean |  |
| backgroundChecked | background_checked | INTEGER boolean |  |
| isCertified | is_certified | INTEGER boolean |  |
| isAvailable | is_available | INTEGER boolean |  |
| isApproved | is_approved | INTEGER boolean |  |
| isSuspended | is_suspended | INTEGER boolean |  |
| isBlacklisted | is_blacklisted | INTEGER boolean |  |
| organizationId | organization_id | TEXT | organizations |
| organizationName | organization_name | TEXT |  |
| isIndependent | is_independent | INTEGER boolean |  |
| allowZeroRate | allow_zero_rate | INTEGER boolean |  |
| profile_image_id | profile_image_id | TEXT |  |
| identityVerificationStatus | identity_verification_status | TEXT |  |
| phoneVerificationStatus | phone_verification_status | TEXT |  |
| trainingVerificationStatus | training_verification_status | TEXT |  |
| backgroundVerificationStatus | background_verification_status | TEXT |  |
| referencesVerificationStatus | references_verification_status | TEXT |  |

### services

Source: `services`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| label | label | TEXT |  |
| serviceName | service_name | TEXT |  |
| category | category | TEXT |  |
| description | description | TEXT |  |
| price | price | REAL/INTEGER |  |
| isActive | is_active | INTEGER boolean |  |
| organizationId | organization_id | TEXT | organizations |
| organizationName | organization_name | TEXT |  |
| createdBy | created_by | TEXT |  |

### bookings

Source: `bookings`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| userId | user_id | TEXT | users |
| caregiverId | caregiver_id | TEXT | caregivers |
| vendorId | vendor_id | TEXT |  |
| organizationId | organization_id | TEXT | organizations |
| serviceId | service_id | TEXT | services |
| status | status | TEXT |  |
| paymentMethod | payment_method | TEXT |  |
| paymentStatus | payment_status | TEXT |  |
| date | date | TEXT |  |
| time | time | TEXT |  |
| scheduleAt | schedule_at | TEXT timestamp |  |
| durationHours | duration_hours | REAL/INTEGER |  |
| recurrence | recurrence | TEXT |  |
| userName | user_name | TEXT |  |
| userPhone | user_phone | TEXT |  |
| userEmail | user_email | TEXT |  |
| address | address | TEXT |  |
| city | city | TEXT |  |
| careRecipient | care_recipient | TEXT |  |
| careNeeds | care_needs | TEXT |  |
| notes | notes | TEXT |  |
| serviceLabel | service_label | TEXT |  |
| caregiverName | caregiver_name | TEXT |  |
| organizationName | organization_name | TEXT |  |
| hourlyRate | hourly_rate | REAL/INTEGER |  |
| commissionRate | commission_rate | REAL/INTEGER |  |
| totalAmount | total_amount | REAL/INTEGER |  |
| platformCommission | platform_commission | REAL/INTEGER |  |
| vendorEarnings | vendor_earnings | REAL/INTEGER |  |
| amountDue | amount_due | REAL/INTEGER |  |
| requestedTimeWindows | requested_time_windows | TEXT JSON |  |
| requestFingerprint | request_fingerprint | TEXT |  |
| careSessionId | care_session_id | TEXT |  |
| schemaVersion | schema_version | REAL/INTEGER |  |

### care_sessions

Source: `careSessions`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| bookingId | booking_id | TEXT | bookings |
| caregiverId | caregiver_id | TEXT | caregivers |
| customerId | customer_id | TEXT | users |
| organizationId | organization_id | TEXT | organizations |
| scheduledDate | scheduled_date | TEXT |  |
| scheduledTime | scheduled_time | TEXT |  |
| scheduledDurationHours | scheduled_duration_hours | REAL/INTEGER |  |
| status | status | TEXT |  |
| actualCheckIn | actual_check_in | TEXT timestamp |  |
| actualCheckOut | actual_check_out | TEXT timestamp |  |

### care_tasks

Source: `careSessions/{sessionId}/tasks`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| sessionId | session_id | TEXT | care_sessions |
| label | label | TEXT |  |
| status | status | TEXT |  |
| createdBy | created_by | TEXT |  |
| completedBy | completed_by | TEXT |  |
| completedAt | completed_at | TEXT timestamp |  |

### care_updates

Source: `careSessions/{sessionId}/updates`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| sessionId | session_id | TEXT | care_sessions |
| caregiverId | caregiver_id | TEXT | caregivers |
| type | type | TEXT |  |
| message | message | TEXT |  |

### reviews

Source: `reviews`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| bookingId | booking_id | TEXT | bookings |
| caregiverId | caregiver_id | TEXT | caregivers |
| customerId | customer_id | TEXT | users |
| rating | rating | REAL/INTEGER |  |
| comment | comment | TEXT |  |
| isVerifiedReview | is_verified_review | INTEGER boolean |  |
| isHidden | is_hidden | INTEGER boolean |  |

### blacklist_reports

Source: `blacklistReports`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| bookingId | booking_id | TEXT | bookings |
| userId | user_id | TEXT | users |
| userType | user_type | TEXT |  |
| userName | user_name | TEXT |  |
| reportedBy | reported_by | TEXT | caregivers |
| reportedByName | reported_by_name | TEXT |  |
| reportedByOrgId | reported_by_org_id | TEXT |  |
| reason | reason | TEXT |  |
| description | description | TEXT |  |
| status | status | TEXT |  |

### report_receipts

Source: `reportReceipts`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| bookingId | booking_id | TEXT | bookings |
| reportedBy | reported_by | TEXT | caregivers |
| reason | reason | TEXT |  |
| status | status | TEXT |  |

### report_locks

Source: `reportLocks`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| reportId | report_id | TEXT |  |
| reportedBy | reported_by | TEXT | caregivers |

### blacklist

Source: `blacklist`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| userId | user_id | TEXT |  |
| userType | user_type | TEXT |  |
| targetId | target_id | TEXT |  |
| targetType | target_type | TEXT |  |
| organizationId | organization_id | TEXT |  |
| reason | reason | TEXT |  |
| blacklistedBy | blacklisted_by | TEXT |  |

### organization_blacklist

Source: `organizationBlacklist`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| organizationId | organization_id | TEXT | organizations |
| caregiverId | caregiver_id | TEXT |  |
| userId | user_id | TEXT |  |
| reason | reason | TEXT |  |

### legacy_caregiver_reports

Source: `caregiverReports`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| bookingId | booking_id | TEXT |  |
| userId | user_id | TEXT |  |
| caregiverId | caregiver_id | TEXT |  |
| reportedBy | reported_by | TEXT |  |
| status | status | TEXT |  |

### organization_safety_cascades

Source: `organizationSafetyCascades`. Server-only; no generic client access.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| organizationId | organization_id | TEXT |  |
| requesterUid | requester_uid | TEXT |  |
| reason | reason | TEXT |  |
| status | status | TEXT |  |
| cursor | cursor | TEXT |  |
| processedCaregiverCount | processed_caregiver_count | REAL/INTEGER |  |

### admin_audit_logs

Source: `adminAuditLogs`. Server-only; no generic client access.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| action | action | TEXT |  |
| actorUid | actor_uid | TEXT |  |
| targetUid | target_uid | TEXT |  |
| targetId | target_id | TEXT |  |
| targetType | target_type | TEXT |  |
| targetRole | target_role | TEXT |  |
| organizationId | organization_id | TEXT |  |
| status | status | TEXT |  |

### legacy_admin_password_resets

Source: `adminPasswordResets`. Server-only; no generic client access.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| actorUid | actor_uid | TEXT |  |
| targetUid | target_uid | TEXT |  |
| status | status | TEXT |  |

### settings

Source: `settings`.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| rate | rate | REAL/INTEGER |  |
| updatedBy | updated_by | TEXT |  |

### legacy_public_caregivers

Source: `publicCaregivers`. Historical reconciliation only; runtime public projections use current source rows.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| caregiverId | caregiver_id | TEXT |  |

### legacy_public_services

Source: `publicServices`. Historical reconciliation only; runtime public projections use current source rows.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| serviceId | service_id | TEXT |  |

### legacy_public_reviews

Source: `publicReviews`. Historical reconciliation only; runtime public projections use current source rows.

| API field | SQL column | Type | Reference |
|---|---|---|---|
| createdAt | created_at | TEXT timestamp |  |
| updatedAt | updated_at | TEXT timestamp |  |
| caregiverId | caregiver_id | TEXT |  |

## Operational tables

| Table | Purpose |
|---|---|
| caregiver_services | Composite unique caregiver/service relation; FKs to both sources |
| commit_guards | Temporary CHECK(valid=1) optimistic guards; removed in the same batch |
| migration_records | Source path/hash and migration time, including pending reservations |
| auth_operations | Legacy rollback metadata; unused by Cloudflare authentication |
| auth_accounts | Legacy imported disabled/validSince rollback metadata; never authorizes a Cloudflare session |
| sewak_schema_migrations | Remote operator checksum/progress journal |

## Indexes

```sql
CREATE INDEX idx_caregiver_services_service ON caregiver_services(service_id,caregiver_id);
CREATE INDEX idx_auth_operations_pending ON auth_operations(status,id);
CREATE INDEX idx_caregivers_public ON caregivers(is_approved,is_suspended,is_blacklisted,id);
CREATE INDEX idx_caregivers_org ON caregivers(organization_id,id);
CREATE INDEX idx_caregivers_category ON caregivers(category,is_approved,id);
CREATE INDEX idx_caregivers_location ON caregivers(location,is_approved,id);
CREATE INDEX idx_services_org ON services(organization_id,id);
CREATE INDEX idx_services_active ON services(is_active,id);
CREATE INDEX idx_bookings_customer ON bookings(user_id,status,id);
CREATE INDEX idx_bookings_customer_id ON bookings(user_id,id);
CREATE INDEX idx_bookings_caregiver ON bookings(caregiver_id,status,id);
CREATE INDEX idx_bookings_caregiver_id ON bookings(caregiver_id,id);
CREATE INDEX idx_bookings_org ON bookings(organization_id,status,id);
CREATE INDEX idx_bookings_org_id ON bookings(organization_id,id);
CREATE INDEX idx_bookings_org_totals ON bookings(organization_id,status,total_amount,vendor_earnings);
CREATE INDEX idx_bookings_status ON bookings(status,id);
CREATE INDEX idx_care_tasks_session ON care_tasks(session_id,created_at,id);
CREATE INDEX idx_care_updates_session ON care_updates(session_id,created_at,id);
CREATE INDEX idx_reviews_caregiver ON reviews(caregiver_id,is_verified_review,id);
CREATE INDEX idx_reviews_customer ON reviews(customer_id,id);
CREATE INDEX idx_receipts_reporter ON report_receipts(reported_by,id);
CREATE INDEX idx_reports_status ON blacklist_reports(status,id);
CREATE INDEX idx_organization_blacklist_org ON organization_blacklist(organization_id,id);
CREATE INDEX idx_applications_status ON organization_applications(status,id);
CREATE INDEX idx_audit_created ON admin_audit_logs(created_at,id);
```

Primary/unique constraints also create SQLite indexes. Main booking participant FKs and verified-review uniqueness are authoritative; role, ownership, safety, pricing and workflow transitions are additionally checked server-side. No favorites/chat/notification tables were invented because those features do not exist in the source app.

## API surface

| Endpoint | Scope |
|---|---|
| GET /api/health | Database reachability and write-maintenance state |
| GET /api/records/:path | Finite known record resources; private ownership/role checks |
| POST /api/query | Allowlisted filters/orders, tenant scope, cursors, booking aggregates |
| POST /api/commit | Bounded validated transitions and optimistic transactional batches |
| POST /api/actions/:operation | Role-gated provisioning, approval, account safety and retries |
| PUT /api/profiles/:uid/image | Validated binary profile photo, own/authorized admin only |
| DELETE /api/profiles/:uid/image | Authorized unlink and current binary removal |
| GET /api/media/:id | Public eligible caregiver photo or authorized private owner view |
| PUT /api/migration/profiles/:uid/image | Temporary secret-gated maintenance-only image import |

Private requests verify opaque D1 session digests, audience, transport, expiry, idle time and credential version. Roles and restrictions come from current D1 rows, never client fields or Firebase claims. HttpOnly cookie requests require same-origin CSRF protection; native clients use Bearer sessions. No browser SQL endpoint exists. See CLOUDFLARE_AUTH.md and MOBILE_API.md.

## Cloudflare authentication tables

Migration 0003 adds cf_credentials (versioned scrypt password hashes), cf_sessions (opaque-token digests and expiry), cf_auth_limits (persistent rate windows), cf_invitations (hashed one-time activation/recovery) and cf_bootstrap (email-bound first-owner setup). Credentials and sessions are server-only and have no generic record API.
