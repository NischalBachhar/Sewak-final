import { writeFileSync, mkdirSync } from 'node:fs';
import { entities } from '../worker/src/model.mjs';
const constraints = {
  users: ["CHECK(role IS NULL OR role IN ('user','caregiver','orgadmin','superadmin'))"],
  organizations: ['CHECK(commission_rate IS NULL OR commission_rate BETWEEN 0 AND 100)'],
  caregivers: ['CHECK(hourly_rate IS NULL OR hourly_rate BETWEEN 0 AND 1000000)', 'CHECK(rating IS NULL OR rating BETWEEN 0 AND 5)'],
  reviews: ['UNIQUE(booking_id)', 'CHECK(rating BETWEEN 1 AND 5)'],
  care_sessions: ['UNIQUE(booking_id)'],
  bookings: ['UNIQUE(user_id, request_fingerprint, id)', 'CHECK(total_amount IS NULL OR total_amount >= 0)'],
};
let sql = '-- Sewak application schema. Images belong ONLY in MEDIA_DB.\n';
for (const spec of Object.values(entities)) {
  const columns = ['id TEXT PRIMARY KEY NOT NULL', 'version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0)', "fields_present TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(fields_present))", "extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json))"];
  for (const [key, { column, type }] of Object.entries(spec.fields)) {
    columns.push(`"${column}" ${type === 'b' ? 'INTEGER' : type === 'n' ? 'REAL' : 'TEXT'}${type === 'b' ? ` CHECK("${column}" IS NULL OR "${column}" IN (0,1))` : type === 'j' ? ` CHECK("${column}" IS NULL OR json_valid("${column}"))` : ''}${spec.relations?.[key] ? ` REFERENCES ${spec.relations[key]}(id) DEFERRABLE INITIALLY DEFERRED` : ''}`);
  }
  sql += `CREATE TABLE ${spec.table} (\n  ${[...columns, ...(constraints[spec.table] || [])].join(',\n  ')}\n);\n\n`;
}
sql += `CREATE TABLE caregiver_services (caregiver_id TEXT NOT NULL REFERENCES caregivers(id), service_id TEXT NOT NULL REFERENCES services(id), PRIMARY KEY(caregiver_id,service_id));
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
`;
mkdirSync('migrations/main', { recursive: true });
writeFileSync('migrations/main/0001_sewak.sql', sql);
