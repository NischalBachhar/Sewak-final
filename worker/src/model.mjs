// Only indexed/scalar application fields become columns. Unqueried legacy
// extension fields remain structured JSON; image bytes are never accepted here.
const common = 'createdAt:t updatedAt:t';
const safety = 'isApproved:b isSuspended:b isBlacklisted:b';
const fields = (text) => Object.fromEntries(text.trim().split(/\s+/).filter(Boolean).map((entry) => {
  const [name, type = 's'] = entry.split(':');
  return [name, { column: name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), type }];
}));
const entity = (table, text, options = {}) => ({ table, fields: fields(`${common} ${text}`), ...options });
export const entities = {
  users: entity('users', `uid name email role phone address city location profileComplete:b ${safety} organizationId profile_image_id tokensValidAfter:n`, { relations: { organizationId: 'organizations' } }),
  organizations: entity('organizations', `organizationId adminUid organizationName adminName adminEmail businessPhone businessAddress businessCity businessLicense commissionRate:n verified:b profileComplete:b role ${safety}`, { relations: { adminUid: 'users' } }),
  organizationApplications: entity('organization_applications', 'applicantId applicantName applicantEmail organizationName businessPhone businessAddress businessCity status', { relations: { applicantId: 'users' } }),
  vendors: entity('caregivers', `uid vendorId name email phone location category workType shifts:j servicesOffered:j hourlyRate:n experience:n bio jobsCompleted:n rating:n reviewCount:n verified:b backgroundChecked:b isCertified:b isAvailable:b ${safety} organizationId organizationName isIndependent:b allowZeroRate:b profile_image_id identityVerificationStatus phoneVerificationStatus trainingVerificationStatus backgroundVerificationStatus referencesVerificationStatus`, { relations: { organizationId: 'organizations' } }),
  services: entity('services', 'label serviceName category description price:n isActive:b organizationId organizationName createdBy', { relations: { organizationId: 'organizations' } }),
  bookings: entity('bookings', 'userId caregiverId vendorId organizationId serviceId status paymentMethod paymentStatus date time scheduleAt:t durationHours:n recurrence userName userPhone userEmail address city careRecipient careNeeds notes serviceLabel caregiverName organizationName hourlyRate:n commissionRate:n totalAmount:n platformCommission:n vendorEarnings:n amountDue:n requestedTimeWindows:j requestFingerprint careSessionId schemaVersion:n', { relations: { userId: 'users', caregiverId: 'caregivers', organizationId: 'organizations', serviceId: 'services' } }),
  careSessions: entity('care_sessions', 'bookingId caregiverId customerId organizationId scheduledDate scheduledTime scheduledDurationHours:n status actualCheckIn:t actualCheckOut:t', { relations: { bookingId: 'bookings', caregiverId: 'caregivers', customerId: 'users', organizationId: 'organizations' } }),
  tasks: entity('care_tasks', 'sessionId label status createdBy completedBy completedAt:t', { child: true, relations: { sessionId: 'care_sessions' } }),
  updates: entity('care_updates', 'sessionId caregiverId type message', { child: true, relations: { sessionId: 'care_sessions', caregiverId: 'caregivers' } }),
  reviews: entity('reviews', 'bookingId caregiverId customerId rating:n comment isVerifiedReview:b isHidden:b', { relations: { bookingId: 'bookings', caregiverId: 'caregivers', customerId: 'users' } }),
  blacklistReports: entity('blacklist_reports', 'bookingId userId userType userName reportedBy reportedByName reportedByOrgId reason description status', { relations: { bookingId: 'bookings', userId: 'users', reportedBy: 'caregivers' } }),
  reportReceipts: entity('report_receipts', 'bookingId reportedBy reason status', { relations: { bookingId: 'bookings', reportedBy: 'caregivers' } }),
  reportLocks: entity('report_locks', 'reportId reportedBy', { relations: { reportedBy: 'caregivers' } }),
  blacklist: entity('blacklist', 'userId userType targetId targetType organizationId reason blacklistedBy', {}),
  organizationBlacklist: entity('organization_blacklist', 'organizationId caregiverId userId reason', { relations: { organizationId: 'organizations' } }),
  caregiverReports: entity('legacy_caregiver_reports', 'bookingId userId caregiverId reportedBy status', { legacy: true }),
  organizationSafetyCascades: entity('organization_safety_cascades', 'organizationId requesterUid reason status cursor processedCaregiverCount:n', { serverOnly: true }),
  adminAuditLogs: entity('admin_audit_logs', 'action actorUid targetUid targetId targetType targetRole organizationId status', { serverOnly: true }),
  adminPasswordResets: entity('legacy_admin_password_resets', 'actorUid targetUid status', { serverOnly: true, legacy: true }),
  settings: entity('settings', 'rate:n updatedBy'),
  // Original public projections are retained for exact migration reconciliation.
  // Runtime reads derive safe views from private tables, never trust these copies.
  publicCaregivers: entity('legacy_public_caregivers', 'caregiverId', { projection: true }),
  publicServices: entity('legacy_public_services', 'serviceId', { projection: true }),
  publicReviews: entity('legacy_public_reviews', 'caregiverId', { projection: true }),
};
export const collections = Object.keys(entities).filter((key) => !entities[key].child);
export function resource(path) {
  const parts = path.split('/');
  const name = parts.length > 2 ? parts[2] : parts[0];
  const spec = Object.hasOwn(entities, name) ? entities[name] : null;
  if (!spec || (spec.child ? parts[0] !== 'careSessions' || parts.length < 3 || parts.length > 4 : parts.length > 2)) throw new Error('Unknown resource');
  if (parts.some((part) => !part || part.length > 160 || /[\u0000-\u001f]/.test(part) || ['.', '..'].includes(part))) throw new Error('Invalid resource ID');
  const isDocument = spec.child ? parts.length === 4 : parts.length === 2;
  return { name, spec, id: isDocument ? parts.at(-1) : null, key: isDocument ? (spec.child ? `${parts[1]}/${parts[3]}` : parts[1]) : null, parent: spec.child ? parts[1] : null, path };
}
export function encodeRecord(name, id, data, version = 1) {
  const spec = entities[name];
  const record = { id, version, fields_present: JSON.stringify(Object.keys(data)), extra_json: '{}' };
  // An upsert replaces a complete logical record. Explicit NULLs clear removed
  // indexed fields instead of leaving stale ownership/status values in SQL.
  for (const field of Object.values(spec.fields)) record[field.column] = null;
  const extra = {};
  for (const [key, value] of Object.entries(data)) {
    const field = spec.fields[key];
    if (!field) { extra[key] = value; continue; }
    record[field.column] = value == null || (spec.relations?.[key] && value === '') ? null :
      field.type === 'b' ? Number(value) : field.type === 'j' ? JSON.stringify(value) : value;
  }
  // Preserve explicit empty relation strings vs NULL in the original document.
  for (const key of Object.keys(spec.relations || {})) if (data[key] === '') extra[key] = '';
  record.extra_json = JSON.stringify(extra);
  return record;
}
export function decodeRecord(name, row) {
  if (!row) return null;
  const spec = entities[name];
  const data = JSON.parse(row.extra_json || '{}');
  for (const key of JSON.parse(row.fields_present || '[]')) {
    const field = spec.fields[key];
    if (!field || key in data) continue;
    const value = row[field.column];
    data[key] = value == null ? null : field.type === 'b' ? Boolean(value) : field.type === 'j' ? JSON.parse(value) : value;
  }
  return data;
}
export function insertSQL(name, record, mode = 'insert') {
  const table = entities[name].table;
  const columns = Object.keys(record);
  const update = columns.filter((c) => c !== 'id').map((c) => `"${c}"=excluded."${c}"`).join(',');
  return { sql: `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})${mode === 'upsert' ? ` ON CONFLICT(id) DO UPDATE SET ${update}` : ''}`, params: Object.values(record) };
}
