-- Sewak application schema. Images belong ONLY in MEDIA_DB.
CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "uid" TEXT,
  "name" TEXT,
  "email" TEXT,
  "role" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "city" TEXT,
  "location" TEXT,
  "profile_complete" INTEGER CHECK("profile_complete" IS NULL OR "profile_complete" IN (0,1)),
  "is_approved" INTEGER CHECK("is_approved" IS NULL OR "is_approved" IN (0,1)),
  "is_suspended" INTEGER CHECK("is_suspended" IS NULL OR "is_suspended" IN (0,1)),
  "is_blacklisted" INTEGER CHECK("is_blacklisted" IS NULL OR "is_blacklisted" IN (0,1)),
  "organization_id" TEXT REFERENCES organizations(id) DEFERRABLE INITIALLY DEFERRED,
  "profile_image_id" TEXT,
  "tokens_valid_after" REAL,
  CHECK(role IS NULL OR role IN ('user','caregiver','orgadmin','superadmin'))
);

CREATE TABLE organizations (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "organization_id" TEXT,
  "admin_uid" TEXT REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
  "organization_name" TEXT,
  "admin_name" TEXT,
  "admin_email" TEXT,
  "business_phone" TEXT,
  "business_address" TEXT,
  "business_city" TEXT,
  "business_license" TEXT,
  "commission_rate" REAL,
  "verified" INTEGER CHECK("verified" IS NULL OR "verified" IN (0,1)),
  "profile_complete" INTEGER CHECK("profile_complete" IS NULL OR "profile_complete" IN (0,1)),
  "role" TEXT,
  "is_approved" INTEGER CHECK("is_approved" IS NULL OR "is_approved" IN (0,1)),
  "is_suspended" INTEGER CHECK("is_suspended" IS NULL OR "is_suspended" IN (0,1)),
  "is_blacklisted" INTEGER CHECK("is_blacklisted" IS NULL OR "is_blacklisted" IN (0,1)),
  CHECK(commission_rate IS NULL OR commission_rate BETWEEN 0 AND 100)
);

CREATE TABLE organization_applications (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "applicant_id" TEXT REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
  "applicant_name" TEXT,
  "applicant_email" TEXT,
  "organization_name" TEXT,
  "business_phone" TEXT,
  "business_address" TEXT,
  "business_city" TEXT,
  "status" TEXT
);

CREATE TABLE caregivers (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "uid" TEXT,
  "vendor_id" TEXT,
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "location" TEXT,
  "category" TEXT,
  "work_type" TEXT,
  "shifts" TEXT CHECK("shifts" IS NULL OR json_valid("shifts")),
  "services_offered" TEXT CHECK("services_offered" IS NULL OR json_valid("services_offered")),
  "hourly_rate" REAL,
  "experience" REAL,
  "bio" TEXT,
  "jobs_completed" REAL,
  "rating" REAL,
  "review_count" REAL,
  "verified" INTEGER CHECK("verified" IS NULL OR "verified" IN (0,1)),
  "background_checked" INTEGER CHECK("background_checked" IS NULL OR "background_checked" IN (0,1)),
  "is_certified" INTEGER CHECK("is_certified" IS NULL OR "is_certified" IN (0,1)),
  "is_available" INTEGER CHECK("is_available" IS NULL OR "is_available" IN (0,1)),
  "is_approved" INTEGER CHECK("is_approved" IS NULL OR "is_approved" IN (0,1)),
  "is_suspended" INTEGER CHECK("is_suspended" IS NULL OR "is_suspended" IN (0,1)),
  "is_blacklisted" INTEGER CHECK("is_blacklisted" IS NULL OR "is_blacklisted" IN (0,1)),
  "organization_id" TEXT REFERENCES organizations(id) DEFERRABLE INITIALLY DEFERRED,
  "organization_name" TEXT,
  "is_independent" INTEGER CHECK("is_independent" IS NULL OR "is_independent" IN (0,1)),
  "allow_zero_rate" INTEGER CHECK("allow_zero_rate" IS NULL OR "allow_zero_rate" IN (0,1)),
  "profile_image_id" TEXT,
  "identity_verification_status" TEXT,
  "phone_verification_status" TEXT,
  "training_verification_status" TEXT,
  "background_verification_status" TEXT,
  "references_verification_status" TEXT,
  CHECK(hourly_rate IS NULL OR hourly_rate BETWEEN 0 AND 1000000),
  CHECK(rating IS NULL OR rating BETWEEN 0 AND 5)
);

CREATE TABLE services (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "label" TEXT,
  "service_name" TEXT,
  "category" TEXT,
  "description" TEXT,
  "price" REAL,
  "is_active" INTEGER CHECK("is_active" IS NULL OR "is_active" IN (0,1)),
  "organization_id" TEXT REFERENCES organizations(id) DEFERRABLE INITIALLY DEFERRED,
  "organization_name" TEXT,
  "created_by" TEXT
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "user_id" TEXT REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
  "caregiver_id" TEXT REFERENCES caregivers(id) DEFERRABLE INITIALLY DEFERRED,
  "vendor_id" TEXT,
  "organization_id" TEXT REFERENCES organizations(id) DEFERRABLE INITIALLY DEFERRED,
  "service_id" TEXT REFERENCES services(id) DEFERRABLE INITIALLY DEFERRED,
  "status" TEXT,
  "payment_method" TEXT,
  "payment_status" TEXT,
  "date" TEXT,
  "time" TEXT,
  "schedule_at" TEXT,
  "duration_hours" REAL,
  "recurrence" TEXT,
  "user_name" TEXT,
  "user_phone" TEXT,
  "user_email" TEXT,
  "address" TEXT,
  "city" TEXT,
  "care_recipient" TEXT,
  "care_needs" TEXT,
  "notes" TEXT,
  "service_label" TEXT,
  "caregiver_name" TEXT,
  "organization_name" TEXT,
  "hourly_rate" REAL,
  "commission_rate" REAL,
  "total_amount" REAL,
  "platform_commission" REAL,
  "vendor_earnings" REAL,
  "amount_due" REAL,
  "requested_time_windows" TEXT CHECK("requested_time_windows" IS NULL OR json_valid("requested_time_windows")),
  "request_fingerprint" TEXT,
  "care_session_id" TEXT,
  "schema_version" REAL,
  UNIQUE(user_id, request_fingerprint, id),
  CHECK(total_amount IS NULL OR total_amount >= 0)
);

CREATE TABLE care_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "booking_id" TEXT REFERENCES bookings(id) DEFERRABLE INITIALLY DEFERRED,
  "caregiver_id" TEXT REFERENCES caregivers(id) DEFERRABLE INITIALLY DEFERRED,
  "customer_id" TEXT REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
  "organization_id" TEXT REFERENCES organizations(id) DEFERRABLE INITIALLY DEFERRED,
  "scheduled_date" TEXT,
  "scheduled_time" TEXT,
  "scheduled_duration_hours" REAL,
  "status" TEXT,
  "actual_check_in" TEXT,
  "actual_check_out" TEXT,
  UNIQUE(booking_id)
);

CREATE TABLE care_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "session_id" TEXT REFERENCES care_sessions(id) DEFERRABLE INITIALLY DEFERRED,
  "label" TEXT,
  "status" TEXT,
  "created_by" TEXT,
  "completed_by" TEXT,
  "completed_at" TEXT
);

CREATE TABLE care_updates (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "session_id" TEXT REFERENCES care_sessions(id) DEFERRABLE INITIALLY DEFERRED,
  "caregiver_id" TEXT REFERENCES caregivers(id) DEFERRABLE INITIALLY DEFERRED,
  "type" TEXT,
  "message" TEXT
);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "booking_id" TEXT REFERENCES bookings(id) DEFERRABLE INITIALLY DEFERRED,
  "caregiver_id" TEXT REFERENCES caregivers(id) DEFERRABLE INITIALLY DEFERRED,
  "customer_id" TEXT REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
  "rating" REAL,
  "comment" TEXT,
  "is_verified_review" INTEGER CHECK("is_verified_review" IS NULL OR "is_verified_review" IN (0,1)),
  "is_hidden" INTEGER CHECK("is_hidden" IS NULL OR "is_hidden" IN (0,1)),
  UNIQUE(booking_id),
  CHECK(rating BETWEEN 1 AND 5)
);

CREATE TABLE blacklist_reports (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "booking_id" TEXT REFERENCES bookings(id) DEFERRABLE INITIALLY DEFERRED,
  "user_id" TEXT REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
  "user_type" TEXT,
  "user_name" TEXT,
  "reported_by" TEXT REFERENCES caregivers(id) DEFERRABLE INITIALLY DEFERRED,
  "reported_by_name" TEXT,
  "reported_by_org_id" TEXT,
  "reason" TEXT,
  "description" TEXT,
  "status" TEXT
);

CREATE TABLE report_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "booking_id" TEXT REFERENCES bookings(id) DEFERRABLE INITIALLY DEFERRED,
  "reported_by" TEXT REFERENCES caregivers(id) DEFERRABLE INITIALLY DEFERRED,
  "reason" TEXT,
  "status" TEXT
);

CREATE TABLE report_locks (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "report_id" TEXT,
  "reported_by" TEXT REFERENCES caregivers(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE blacklist (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "user_id" TEXT,
  "user_type" TEXT,
  "target_id" TEXT,
  "target_type" TEXT,
  "organization_id" TEXT,
  "reason" TEXT,
  "blacklisted_by" TEXT
);

CREATE TABLE organization_blacklist (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "organization_id" TEXT REFERENCES organizations(id) DEFERRABLE INITIALLY DEFERRED,
  "caregiver_id" TEXT,
  "user_id" TEXT,
  "reason" TEXT
);

CREATE TABLE legacy_caregiver_reports (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "booking_id" TEXT,
  "user_id" TEXT,
  "caregiver_id" TEXT,
  "reported_by" TEXT,
  "status" TEXT
);

CREATE TABLE organization_safety_cascades (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "organization_id" TEXT,
  "requester_uid" TEXT,
  "reason" TEXT,
  "status" TEXT,
  "cursor" TEXT,
  "processed_caregiver_count" REAL
);

CREATE TABLE admin_audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "action" TEXT,
  "actor_uid" TEXT,
  "target_uid" TEXT,
  "target_id" TEXT,
  "target_type" TEXT,
  "target_role" TEXT,
  "organization_id" TEXT,
  "status" TEXT
);

CREATE TABLE legacy_admin_password_resets (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "actor_uid" TEXT,
  "target_uid" TEXT,
  "status" TEXT
);

CREATE TABLE settings (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "rate" REAL,
  "updated_by" TEXT
);

CREATE TABLE legacy_public_caregivers (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "caregiver_id" TEXT
);

CREATE TABLE legacy_public_services (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "service_id" TEXT
);

CREATE TABLE legacy_public_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present)),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  "created_at" TEXT,
  "updated_at" TEXT,
  "caregiver_id" TEXT
);

CREATE TABLE caregiver_services (caregiver_id TEXT NOT NULL REFERENCES caregivers(id), service_id TEXT NOT NULL REFERENCES services(id), PRIMARY KEY(caregiver_id,service_id));
CREATE INDEX idx_caregiver_services_service ON caregiver_services(service_id,caregiver_id);
CREATE TABLE commit_guards (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid = 1));
CREATE TABLE migration_records (source_path TEXT PRIMARY KEY, source_hash TEXT NOT NULL, migrated_at TEXT NOT NULL);
CREATE TABLE auth_operations (id TEXT PRIMARY KEY, kind TEXT NOT NULL, target_uid TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','complete')), payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
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
