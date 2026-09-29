> Historical migration evidence. Firebase Auth was superseded by Cloudflare-only D1 Auth on 2026-09-29. The current deployment and verification state is in [FIREBASE_TO_D1_MIGRATION.md](FIREBASE_TO_D1_MIGRATION.md) and [CLOUDFLARE_AUTH.md](CLOUDFLARE_AUTH.md). Do not run old signing/key-creation instructions.

# Sewak Firebase audit

Repository inspected on 2026-09-21 before cutover. This is a source inventory; live counts and image sizes must come from the export/validation reports, never from fixtures.

The application is a Create React App SPA with four roles: customer (`user`), caregiver, organization admin, and superadmin. There was no Wrangler configuration or Cloudflare backend in the checkout. `firebase.json` configures Firebase Hosting, Functions, Storage and the `(default)` Firestore database in `asia-south1`, project `care-53593`. The existing repository was clean.

## Collections and relationships

| Collection | Record shape / authority | Reads and writes |
|---|---|---|
| `users/{uid}` | Firebase UID, name/email/phone/address/city, role, profile completion, approval/suspension/blacklist, organization affiliation, optional profilePicture and audit fields | AuthContext, customer profile, admin; registration creates only customer role; privileged roles were provisioned by Functions |
| `organizations/{id}` | Usually admin UID as ID; adminUid, organizationName, business contact/license text, commissionRate, caregivers array, totals, approval/verification/safety metadata | Organization profile/dashboard, admin; account approval and restrictions via Functions |
| `organizationApplications/{uid}` | Applicant UID/name/email, organization name/contact, pending/approval status and approval operation metadata | Registration, superadmin application approval |
| `vendors/{uid}` | Caregiver UID/vendorId, private contacts, location/category/workType/shifts, servicesOffered IDs, rate, experience/bio, organization ID, approval/availability, trust flags, earnings/review summaries | Caregiver, owning organization, superadmin; never public contacts |
| `services/{id}` | Label/serviceName, category, description, price, active state, organization/creator metadata | Organization and superadmin service management; authoritative booking terms |
| `publicCaregivers/{id}` | Allowlisted public display/trust/rate fields and caregiver routing ID; no private contacts | Browse, detail, booking quote; previously Functions and superadmin trial publication |
| `publicServices/{id}` | Public label/category/description/price | Browse, caregiver service selection, booking; previously batch/Function projection |
| `bookings/{id}` | Customer/caregiver/organization/service IDs, contact and care information, schedule and recurrence, immutable quote/payment snapshots, controlled status, attempt fingerprint | Customer, assigned caregiver, owning organization, superadmin; cash booking, cancellation, acceptance and session transitions |
| `careSessions/{bookingId}` | One booking-linked session; participants, schedule, actual check-in/out, status | Booking detail and caregiver workflow; atomic booking/session changes |
| `careSessions/{id}/tasks/{taskId}` | Label, pending/completed state, creator and completion UID/timestamps | Participants read; active assigned caregiver writes |
| `careSessions/{id}/updates/{updateId}` | Caregiver UID, note/milestone, message, createdAt | Participants read; active assigned caregiver creates |
| `reviews/{bookingId}` | Customer/caregiver/booking IDs, rating, comment, verified-review flag and timestamp | Booking participants; one customer review only after completed care |
| `publicReviews/{bookingId}` | Review display fields with customer UID removed | Public caregiver detail; previously Function projection |
| `blacklistReports/{bookingId}` | Customer and reporter identity, organization, reason, description, moderation status and private moderator fields | Caregiver creates, superadmin reads/moderates |
| `reportReceipts/{reportId}` | Only bookingId, reportedBy, reason, status, createdAt | Reporter-safe copy; atomic with original report |
| `reportLocks/{bookingId}` | Original report ID and reporter UID | Prevents duplicate reports; participant lookup only |
| `blacklist/{uid}` | Target role/account, reason, restriction and audit metadata | Own account/superadmin; trusted safety action writes |
| `organizationBlacklist/{id}` | Organization/caregiver reference and safety metadata | Owning organization and superadmin |
| `caregiverReports/{id}` | Legacy moderator reports; flexible historical fields | No active create flow; private legacy preservation |
| `organizationSafetyCascades/{orgId}` | Cursor, requester, reason, processed count and retry status | Server-only continuation for Firebase credential revocation |
| `adminAuditLogs/{id}` | Actor, action, target, timestamps, operation outcomes | Server-only audit trail |
| `settings/commission` | Rate and editor/timestamp | Signed-in settings read, superadmin write; organization commission remains authoritative for booking |
| `adminPasswordResets/{id}` | Legacy server-only records; no active browser flow | Preserve non-secret metadata only; export flags any password/secret fields as exceptions |

Only the two care-session subcollections are used in source. Export recursively enumerates every live collection and subcollection, including descendants of missing documents. Unknown collections are reported and block a complete migration instead of being dropped.

No Realtime Database, favorites, chat/conversations, notifications collection, Cloud Messaging, identity-document upload, resume/PDF upload or file gallery implementation was found. Availability is a caregiver flag plus work type/shifts, not a separate calendar table. Requests are bookings. PaymentCallbackPage deliberately fails closed; Fonepay was already disabled pending a verified provider contract.

## Firebase services and dependencies

* `src/firebaseConfig.js` initialized Auth, Firestore, Functions, Storage and optional reCAPTCHA App Check. Public client Firebase configuration is not an Admin credential.
* Email/password registration, login/logout, password reset, persistence and reauthentication use Firebase Auth. No Google login flow was implemented. Custom claims route privileged accounts; D1 now authorizes roles and restrictions from server-controlled records on every request.
* Functions: provisionOrganizationAccount, provisionCaregiverAccount, provisionSuperAdminAccount; approveOrganizationAccount/application; applyAccountSafetyAction and organization cascade; public caregiver/organization/service/review triggers and backfills; disabled Fonepay verification. All active application calls are replaced by Worker endpoints. Original Functions sources and emulator tests remain as rollback/reference tooling, excluded from the Worker bundle.
* Firestore rules enforce protected roles/safety flags, tenant scope, pricing, schedule, session atomicity, review uniqueness and private report redaction. These policies must be preserved in Worker authorization, not merely hidden in the UI.

## Reads, writes and refreshes

All original Firebase operation locations are captured in `docs/FIREBASE_SOURCE_INVENTORY.md`. The operational modules include AuthContext, registrationService, bookingService, careSessionService, reportService, servicePublishing, CaregiverEditor, all four dashboards/profile pages and public caregiver pages. `getAggregateFromServer` supplies organization totals. Transactions protect registration, booking retries, reports and caregiver edits; batches link care sessions and booking status.

Realtime listeners existed in useCustomerBookings, useOrganizationBookings, CaregiverDashboardPage, BookingDetailPage and CaregiverShiftWorkflow. The replacement refreshes on mount, local mutation, focus and reconnect, with a visibility-aware 60-second refresh only for active care/booking history. It does not promise Firestore push latency. No paid realtime service is introduced.

## Profile images

UserProfilePage was the only uploader: accepted any `image/*` up to 2 MiB, used a temporary data URL preview, uploaded the original to `profile_pictures/{uid}_{Date.now()}.jpg`, then saved its download URL in `users.profilePicture` and Firebase Auth `photoURL`. The filename did not prove JPEG format. No compression or obsolete-version cleanup existed. Storage rules allowed owner create/get/delete, denied lists/other paths, and checked only image MIME and size. URLs with Firebase download tokens were effectively bearer URLs.

Caregiver cards expect `profileImage`; ActiveCareCard also reads photoURL/image aliases. The vendor rule allowlist and public projection did not include an upload field, so caregiver uploads were not implemented. D1 now supplies these display aliases from its media identifier. Source formats, average sizes and actual image counts are unknown until a live export and controlled media run. Migration discovers profile aliases on user/vendor and Auth records; it does not enumerate and migrate unrelated Storage objects.

Original Firebase data, Storage files, rules and Functions remain untouched by local source changes. Actual production cutover is gated by data/image reconciliation and a maintenance write freeze.

## Verified source checkpoint

Both the initial and fresh staging read-only exports found 18 documents: 8 users, 3 organizations, 2 vendors, 2 bookings, 1 care session and 2 publicCaregiver copies. No live task/update documents were found. There are 8 Auth accounts, none disabled, no custom claims and no user/vendor/Auth profile-image references. All 18 documents passed exact local and remote D1 reconciliation. One historical service reference is missing; both caregivers lack service assignments. These remain explicit warnings rather than invented replacement data.

The live Rules release inventory exposed Firestore only. Its rules were backed up and read-only variants prepared and audited locally, not deployed. Functions inventory returned `SERVICE_DISABLED`; Service Usage and billing reads confirmed the API and billing are disabled. The original firebase-adminsdk identity had no user-managed keys. The owner explicitly confirmed only the web app writes to the source. The freeze tool records that confirmation with independent API/billing evidence without enabling either. Read-only Cloudflare staging is deployed; production cutover is now blocked by Google's service-account key policy, not the source-writer question. See the current [runbook](FIREBASE_TO_D1_MIGRATION.md) and [validation](MIGRATION_VALIDATION.md).

Production `src` has no Firestore, Storage, Realtime Database or Functions SDK imports. The finite `d1Client` retains familiar collection/document/query/transaction method names to preserve UI contracts, but sends authenticated HTTP to the Worker. App/Auth SDK imports remain for sign-in/reset/session behavior. Original Firebase rules/indexes, Functions code, emulator/backend tests and old one-time migration tools remain outside the Worker bundle for rollback/reference. Their presence does not mean the app still reads Firestore.
