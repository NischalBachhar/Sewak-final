import { active, ApiError, badInput, canonicalCategory, nowISO, onlyKeys, pick, requireThat, textField, type Actor, type Data } from './types.ts';
import { parseResource, Repository, requireActive, requireActor, requireAdmin, type Write } from './repository.ts';
import { entities, decodeRecord } from './model.mjs';

export async function organizationActive(repo: Repository, id: string, approved = true) {
  if (!id) return true;
  const org = await repo.data(`organizations/${id}`);
  return active(org) && (!approved || org!.isApproved === true);
}
export async function caregiverActive(repo: Repository, uid: string, approved = true) {
  const vendor = await repo.data(`vendors/${uid}`);
  const user = await repo.data(`users/${uid}`);
  return active(vendor) && (!user || active(user)) && (!approved || vendor!.isApproved === true) && await organizationActive(repo, vendor!.organizationId || '', approved);
}
export async function canRead(repo: Repository, actor: Actor | null, path: string) {
  const { name, id, parent, spec } = parseResource(path);
  if (spec.projection) return;
  const user = requireActor(actor);
  requireThat(!spec.serverOnly, 'This record is server-only.');
  if (user.role === 'superadmin' && active(user.profile)) return;
  if (['users', 'organizations', 'organizationApplications', 'blacklist'].includes(name)) { requireThat(id === user.uid); return; }
  requireActive(user);
  const data = await repo.data(path);
  if (name === 'vendors') {
    requireThat(id === user.uid || (user.role === 'orgadmin' && data?.organizationId === user.uid && await organizationActive(repo, user.uid, false))); return;
  }
  if (name === 'settings') return;
  if (['services', 'organizationBlacklist'].includes(name)) {
    requireThat(user.role === 'orgadmin' && data?.organizationId === user.uid && await organizationActive(repo, user.uid, false)); return;
  }
  if (name === 'reportReceipts' && data?.reportedBy === user.uid) return;
  if (['bookings', 'careSessions', 'tasks', 'updates', 'reviews', 'reportReceipts', 'reportLocks'].includes(name)) {
    const bookingId = name === 'bookings' ? id : parent || data?.bookingId || id;
    const booking = await repo.data(`bookings/${bookingId}`);
    if (!booking && name === 'bookings' && id.startsWith(`${user.uid}_`)) return;
    const isReporter = ['reportReceipts', 'reportLocks'].includes(name);
    requireThat(booking && ((!isReporter && booking.userId === user.uid) ||
      (booking.caregiverId === user.uid && await caregiverActive(repo, user.uid, false)) ||
      (!isReporter && name === 'bookings' && user.role === 'orgadmin' && booking.organizationId === user.uid && await organizationActive(repo, user.uid, false))));
    return;
  }
  requireThat(false);
}

const userEditable = ['name', 'phone', 'address', 'city', 'location', 'businessPhone', 'businessAddress', 'businessCity', 'profileComplete', 'updatedAt'];
const orgEditable = ['organizationName', 'businessPhone', 'businessAddress', 'businessCity', 'businessLicense', 'profileComplete', 'updatedAt'];
const vendorEditable = ['name', 'phone', 'location', 'category', 'workType', 'shifts', 'hourlyRate', 'experience', 'bio', 'isAvailable', 'updatedAt'];
const vendorAdmin = [...vendorEditable, 'servicesOffered', 'isApproved', 'approvedAt', 'approvedBy', 'allowZeroRate', 'verified', 'backgroundChecked', 'isCertified', 'identityVerificationStatus', 'phoneVerificationStatus', 'trainingVerificationStatus', 'backgroundVerificationStatus', 'referencesVerificationStatus'];
const serviceEditable = ['label', 'serviceName', 'category', 'description', 'price', 'isActive', 'updatedAt'];
function same(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b); }
function changes(old: Data, data: Data) { return Object.keys({ ...old, ...data }).filter((key) => !same(old[key], data[key])); }
function limited(old: Data, data: Data, allowed: string[]) { requireThat(changes(old, data).every((key) => allowed.includes(key)), 'Protected fields cannot be changed.'); }
function validFields(data: Data, spec: any) {
  for (const [key, value] of Object.entries(data)) {
    badInput(!['__proto__', 'constructor', 'prototype'].includes(key), 'Invalid field.');
    if (value === null) continue;
    const kind = spec.fields[key]?.type;
    if (kind === 's' || kind === 't') badInput(typeof value === 'string', `${key} must be text.`);
    if (kind === 'n') badInput(typeof value === 'number' && Number.isFinite(value), `${key} must be a number.`);
    if (typeof value === 'string') badInput(value.length <= (['notes', 'description'].includes(key) ? 2000 : key === 'bio' || key === 'careNeeds' ? 1000 : 600), `${key} is too long.`);
    if (typeof value === 'number') badInput(Number.isFinite(value) && Math.abs(value) <= 1e12, `${key} is invalid.`);
    if (key.startsWith('is') || ['verified', 'backgroundChecked', 'profileComplete', 'allowZeroRate'].includes(key)) badInput(typeof value === 'boolean', `${key} must be a boolean.`);
    if (key.endsWith('VerificationStatus')) badInput(['verified', 'pending', 'not_verified', 'unavailable'].includes(value), 'Invalid verification status.');
  }
  for (const key of ['name', 'organizationName', 'location', 'phone', 'address', 'city', 'email', 'bio','businessPhone','businessAddress','businessCity','businessLicense','updatedBy','approvedBy']) if (key in data) badInput(typeof data[key] === 'string', `${key} must be text.`);
  if ('hourlyRate' in data) badInput(typeof data.hourlyRate === 'number' && data.hourlyRate >= 0 && data.hourlyRate <= 1000000, 'Invalid hourly rate.');
  if ('experience' in data) badInput(Number.isInteger(data.experience) && data.experience >= 0 && data.experience <= 100, 'Invalid experience.');
  if ('category' in data) badInput(['caregiver', 'vendor', 'household', 'both'].includes(data.category), 'Invalid category.');
  if ('workType' in data) badInput(['parttime', 'fulltime', 'part_time', 'full_time'].includes(data.workType), 'Invalid work type.');
  if ('shifts' in data) badInput(Array.isArray(data.shifts) && data.shifts.length <= 4 && new Set(data.shifts).size === data.shifts.length && data.shifts.every((x: unknown) => ['morning','day','evening','night'].includes(x as string)), 'Invalid shifts.');
  if ('servicesOffered' in data) badInput(Array.isArray(data.servicesOffered) && data.servicesOffered.length <= 20 && new Set(data.servicesOffered).size === data.servicesOffered.length && data.servicesOffered.every((x: unknown) => typeof x === 'string' && x.length <= 160 && !x.includes('/')), 'Invalid services.');
  if ('commissionRate' in data) badInput(typeof data.commissionRate === 'number' && data.commissionRate >= 0 && data.commissionRate <= 100, 'Invalid commission.');
}
function resolvePatch(value: Data, previous: Data, now: string) {
  const resolved: Data = {};
  for (const [key, item] of Object.entries(value)) {
    if (item && typeof item === 'object' && !Array.isArray(item) && item.__op) {
      badInput(Object.keys(item).length === 1 && ['serverTimestamp', 'delete'].includes(item.__op), 'Invalid field operation.');
      if (item.__op === 'serverTimestamp') resolved[key] = now;
    } else resolved[key] = item;
  }
  return resolved;
}
export interface Mutation { path: string; kind: 'set' | 'update' | 'delete'; data?: Data; merge?: boolean }
export async function commitClient(repo: Repository, actor: Actor | null, body: Data) {
  const user = requireActor(actor);
  onlyKeys(body, ['writes', 'preconditions']);
  badInput(!body.preconditions || Array.isArray(body.preconditions) && body.preconditions.length <= 10, 'Too many preconditions.');
  badInput(Array.isArray(body.writes) && body.writes.length > 0 && body.writes.length <= 10, 'Submit 1–10 changes at a time.');
  const now = nowISO();
  const writes: Write[] = [];
  const planned = new Map<string, Data | null>();
  for (const mutation of body.writes as Mutation[]) {
    onlyKeys(mutation, ['path','kind','data','merge']);
    badInput(['set','update','delete'].includes(mutation.kind), 'Invalid mutation.');
    const { key, spec } = parseResource(mutation.path);
    badInput(key && !planned.has(mutation.path), 'Invalid or duplicate record.');
    requireThat(!spec.projection && !spec.serverOnly, 'This resource is managed by the server.');
    const old = await repo.data(mutation.path);
    if (mutation.kind === 'update') requireThat(old, 'The record no longer exists.', 404, 'not-found');
    let data: Data | null = null;
    if (mutation.kind !== 'delete') {
      badInput(mutation.data && typeof mutation.data === 'object' && !Array.isArray(mutation.data), 'Invalid data.');
      const base = mutation.merge || mutation.kind === 'update' ? { ...old } : {};
      for (const [key, value] of Object.entries(mutation.data!)) if (value?.__op === 'delete') delete base[key];
      data = { ...base, ...resolvePatch(mutation.data!, old || {}, now) };
      // Images can only be linked by the binary media endpoint, including admins.
      requireThat(same(data.profile_image_id, old?.profile_image_id) && same(data.profilePicture, old?.profilePicture) && same(data.profileImage, old?.profileImage), 'Upload profile images through the image endpoint.');
      validFields(pick(data, changes(old || {}, data)), spec);
    }
    planned.set(mutation.path, data);
    writes.push({ path: mutation.path, data });
  }
  for (const condition of body.preconditions || []) {
    onlyKeys(condition, ['path','version']);
    badInput(Number.isInteger(condition.version) && condition.version >= 0, 'Invalid version.');
    await canRead(repo, user, condition.path);
    requireThat((await repo.get(condition.path)).version === condition.version, 'This record changed. Refresh and retry.', 409, 'aborted');
  }
  const after = async (path: string) => planned.has(path) ? planned.get(path)! : repo.data(path);
  for (const write of writes) await authorizeWrite(repo, user, write, after, now);
  if (user.role === 'superadmin' || writes.some((w) => w.path.startsWith('services/'))) {
    writes.push({ path: `adminAuditLogs/${crypto.randomUUID()}`, data: { actorUid: user.uid, action: 'records_updated', paths: writes.map((w) => w.path), createdAt: now } });
  }
  await repo.commit(writes);
  return { committed: true };
}

async function authorizeWrite(repo: Repository, user: Actor, write: Write, after: (path: string) => Promise<Data | null>, now: string) {
  const { name, id, parent } = parseResource(write.path);
  const old = await repo.data(write.path);
  const data = write.data;
  const admin = user.role === 'superadmin' && active(user.profile);
  if (name === 'users' && !old) {
    requireThat(id === user.uid && (!user.profile || active(user.profile)));
    badInput(data, 'A profile is required.');
    onlyKeys(data!, ['uid','name','email','role','phone','address','city','createdAt','isApproved','isSuspended','profileComplete']);
    requireThat(data!.uid === user.uid && data!.email === user.email.toLowerCase() && data!.role === 'user' && data!.isApproved === false && data!.isSuspended === false && data!.profileComplete === false && data!.createdAt === now);
    textField(data!.name, 'Name', 2, 120); return;
  }
  if (name === 'organizationApplications' && !old) {
    const profile = await after(`users/${user.uid}`);
    requireThat(id === user.uid && active(profile) && profile?.role === 'user' && data);
    onlyKeys(data!, ['applicantId','applicantName','applicantEmail','organizationName','businessPhone','businessAddress','businessCity','status','createdAt']);
    requireThat(data!.applicantId === user.uid && data!.applicantEmail === user.email.toLowerCase() && data!.status === 'pending' && data!.createdAt === now);
    textField(data!.organizationName, 'Organization name', 2, 160); textField(data!.applicantName, 'Name', 2, 120); return;
  }
  requireActive(user);
  requireThat(data, 'Deletion is not supported for this resource.');
  if (name === 'users') {
    requireThat(old && (id === user.uid || admin));
    limited(old!, data, admin ? [...userEditable, 'isApproved','organizationName','businessLicense','updatedBy'] : userEditable); return;
  }
  if (name === 'organizations') {
    requireThat(old && (admin || (id === user.uid && user.role === 'orgadmin' && active(old))));
    limited(old!, data, admin ? [...orgEditable,'adminName','adminEmail','email','commissionRate','updatedBy'] : orgEditable); return;
  }
  if (name === 'vendors') {
    requireThat(old && (admin || (id === user.uid && await caregiverActive(repo, id, false)) || (user.role === 'orgadmin' && old.organizationId === user.uid && await organizationActive(repo, user.uid))));
    limited(old!, data, admin ? vendorAdmin : vendorEditable);
    if (data.isApproved && !old!.isApproved) requireThat(active(old), 'Blocked caregivers cannot be approved.');
    if (!same(old!.servicesOffered, data.servicesOffered)) await validateServices(repo, data.servicesOffered || [], data.organizationId, data.category);
    return;
  }
  if (name === 'services') {
    requireThat(admin || (user.role === 'orgadmin' && (old?.organizationId || data.organizationId) === user.uid && await organizationActive(repo, user.uid)));
    if (old) limited(old, data, serviceEditable);
    else { onlyKeys(data, [...serviceEditable,'organizationId','organizationName','createdAt','createdBy']); requireThat(admin || data.createdBy === user.uid); data.createdAt = now; }
    textField(data.label || data.serviceName, 'Service name', 1, 160);
    if (data.price != null) badInput(typeof data.price === 'number' && data.price >= 0 && data.price <= 1000000, 'Invalid service price.');
    return;
  }
  if (name === 'bookings') {
    if (!old) { await validateNewBooking(repo, user, id, data, now); return; }
    limited(old, data, ['status','updatedAt','careSessionId']);
    requireThat(data.updatedAt === now, 'A server timestamp is required.');
    const prev = old.status === 'confirmed' ? 'accepted' : old.status;
    if (old.userId === user.uid && prev === 'pending' && data.status === 'cancelled') return;
    requireThat(old.caregiverId === user.uid && await caregiverActive(repo, user.uid));
    requireThat((prev === 'pending' && ['accepted','cancelled'].includes(data.status)) || (prev === 'accepted' && data.status === 'in_progress') || (prev === 'in_progress' && data.status === 'completed'), 'Invalid booking status transition.');
    if (data.status === 'accepted') requireThat(old.paymentMethod !== 'fonepay' || old.paymentStatus === 'paid', 'Payment has not been verified.');
    if (data.status === 'in_progress' || data.status === 'completed') {
      const session = await after(`careSessions/${id}`);
      requireThat(session && session.status === data.status && session.caregiverId === user.uid && (data.status !== 'in_progress' || data.careSessionId === id), 'Update the booking and care session together.');
    }
    return;
  }
  if (name === 'careSessions') {
    const booking = await repo.data(`bookings/${id}`);
    const nextBooking = await after(`bookings/${id}`);
    requireThat(booking?.caregiverId === user.uid && await caregiverActive(repo, user.uid));
    if (!old) {
      onlyKeys(data, ['bookingId','caregiverId','customerId','organizationId','scheduledDate','scheduledTime','scheduledDurationHours','status','actualCheckIn','createdAt','updatedAt']);
      requireThat(['accepted','confirmed'].includes(booking!.status) && data.bookingId === id && data.caregiverId === user.uid && data.customerId === booking!.userId && (data.organizationId || '') === (booking!.organizationId || '') && data.status === 'in_progress' && data.actualCheckIn === now && data.createdAt === now && nextBooking?.status === 'in_progress');
      requireThat(data.scheduledDate === (booking!.date || booking!.bookingDate || '') && data.scheduledTime === (booking!.time || booking!.startTime || '') && data.scheduledDurationHours === Number(booking!.durationHours || booking!.duration || 0));
    } else {
      limited(old, data, ['status','actualCheckOut','updatedAt']);
      requireThat(old.status === 'in_progress' && data.status === 'completed' && data.actualCheckOut === now && nextBooking?.status === 'completed');
    }
    requireThat(data.updatedAt === now); return;
  }
  if (name === 'tasks' || name === 'updates') {
    const session = await repo.data(`careSessions/${parent}`);
    requireThat(session && session.caregiverId === user.uid && session.status === 'in_progress' && await caregiverActive(repo, user.uid));
    if (name === 'updates') {
      requireThat(!old); onlyKeys(data, ['caregiverId','type','message','createdAt']);
      requireThat(data.caregiverId === user.uid && data.createdAt === now && ['note','milestone'].includes(data.type)); textField(data.message, 'Update', 1, 500);
    } else if (!old) {
      onlyKeys(data, ['label','status','createdBy','createdAt']); requireThat(data.createdBy === user.uid && data.status === 'pending' && data.createdAt === now); textField(data.label, 'Task', 1, 120);
    } else {
      limited(old, data, ['status','completedAt','completedBy']);
      requireThat((old.status === 'pending' && data.status === 'completed' && data.completedBy === user.uid && data.completedAt === now) || (old.status === 'completed' && data.status === 'pending' && !('completedBy' in data) && !('completedAt' in data)));
    }
    return;
  }
  if (name === 'reviews') {
    const booking = await repo.data(`bookings/${id}`);
    requireThat(!old && booking?.userId === user.uid && booking.status === 'completed');
    onlyKeys(data, ['bookingId','caregiverId','customerId','rating','comment','isVerifiedReview','createdAt']);
    requireThat(data.bookingId === id && data.caregiverId === booking!.caregiverId && data.customerId === user.uid && data.isVerifiedReview === true && data.createdAt === now);
    badInput(Number.isInteger(data.rating) && data.rating >= 1 && data.rating <= 5, 'Choose a rating from 1 to 5.'); textField(data.comment, 'Review', 0, 600); return;
  }
  if (['blacklistReports','reportReceipts','reportLocks'].includes(name)) {
    if (old) {
      requireAdmin(user);
      if (name === 'blacklistReports') {
        limited(old, data, ['status','rejectedAt','rejectedBy']);
        requireThat(old.status === 'pending' && data.status === 'rejected' && data.rejectedAt === now && data.rejectedBy === user.uid && (!(await repo.data(`reportReceipts/${id}`)) || (await after(`reportReceipts/${id}`))?.status === 'rejected'));
      } else { requireThat(name === 'reportReceipts'); limited(old, data, ['status']); requireThat((await after(`blacklistReports/${id}`))?.status === data.status); }
      return;
    }
    const booking = await repo.data(`bookings/${id}`);
    requireThat(booking?.caregiverId === user.uid && await caregiverActive(repo, user.uid));
    const report = await after(`blacklistReports/${id}`);
    const receipt = await after(`reportReceipts/${id}`);
    const lock = await after(`reportLocks/${id}`);
    requireThat(!(await repo.data(`reportLocks/${id}`)) && !(await repo.data(`blacklistReports/${id}`)) && report && receipt && lock, 'Submit the report and its receipt together.');
    requireThat(report!.bookingId === id && report!.userId === booking!.userId && report!.reportedBy === user.uid && report!.userName === booking!.userName && (report!.reportedByOrgId || '') === (booking!.organizationId || '') && report!.status === 'pending' && report!.createdAt === now && report!.userType === 'user');
    onlyKeys(report!, ['bookingId','userId','userType','userName','reportedBy','reportedByName','reportedByOrgId','reason','description','status','createdAt']);
    badInput(['Non-payment','Abusive behavior','Safety concerns','Cancellation without notice','Inappropriate requests','Other'].includes(report!.reason), 'Invalid report reason.');
    textField(report!.description, 'Report description', 1, 2000);
    requireThat(same(receipt, pick(report!, ['bookingId','reportedBy','reason','status','createdAt'])) && same(lock, { reportId: id, reportedBy: user.uid }));
    return;
  }
  if (name === 'settings') { requireAdmin(user); requireThat(id === 'commission'); onlyKeys(data, ['rate','updatedAt','updatedBy']); badInput(typeof data.rate === 'number' && data.rate >= 0 && data.rate <= 100, 'Commission must be between 0 and 100.'); return; }
  throw new ApiError(403, 'permission-denied', 'This change requires an authorized administrative workflow.');
}

export async function validateServices(repo: Repository, ids: string[], org: string, category: string) {
  // Maximum 20 offered services; one batch query keeps provisioning within Free.
  if (!ids.length) return;
  const columns = ['id','version','fields_present','extra_json', ...Object.values(entities.services.fields).map((field: any) => `"${field.column}"`)];
  const rows = await repo.env.DB.prepare(`SELECT ${columns.join(',')} FROM services WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(ids)).all<Data>();
  requireThat(rows.results.length === ids.length && rows.results.every((service) => service.is_active !== 0 && (!service.organization_id || service.organization_id === org) && (category === 'both' || service.category === 'both' || canonicalCategory(service.category) === canonicalCategory(category))), 'Selected services are not available for this caregiver.');
  for (const row of rows.results) {
    const path = `services/${row.id}`;
    requireThat(!repo.reads.has(path) || repo.reads.get(path)!.version === row.version, 'A service changed. Refresh and retry.', 409, 'aborted');
    repo.reads.set(path, { path, data: decodeRecord('services',row), version: row.version });
  }
}

async function validateNewBooking(repo: Repository, user: Actor, id: string, data: Data, now: string) {
  onlyKeys(data, ['schemaVersion','requestFingerprint','requestedTimeWindows','scheduleAt','commissionRate','userId','userName','userPhone','userEmail','address','city','date','time','durationHours','recurrence','notes','careRecipient','careNeeds','serviceId','serviceLabel','caregiverId','vendorId','organizationId','organizationName','caregiverName','caregiverLocation','caregiverWorkType','caregiverShifts','caregiverCategory','status','hourlyRate','totalAmount','platformCommission','vendorEarnings','paymentMethod','paymentStatus','amountDue','createdAt']);
  requireThat(id.startsWith(`${user.uid}_`) && /^[a-f0-9-]{36}$/.test(id.slice(user.uid.length + 1)) && data.userId === user.uid && data.userEmail === user.email && data.createdAt === now);
  badInput(data.schemaVersion === 2 && /^[a-f0-9]{64}$/.test(data.requestFingerprint), 'Invalid booking attempt.');
  requireThat(data.status === 'pending' && data.paymentMethod === 'cash' && data.paymentStatus === 'pending');
  const caregiver = await repo.data(`vendors/${textField(data.caregiverId, 'Caregiver ID', 1, 128)}`);
  requireThat(caregiver && caregiver.isAvailable === true && await caregiverActive(repo, data.caregiverId), 'This caregiver is no longer available.');
  const org = caregiver!.organizationId ? await repo.data(`organizations/${caregiver!.organizationId}`) : null;
  const service = await repo.data(`services/${textField(data.serviceId, 'Service ID', 1, 160)}`);
  requireThat(service && service.isActive !== false && caregiver!.servicesOffered?.includes(data.serviceId) && (!service.organizationId || service.organizationId === caregiver!.organizationId) && (caregiver!.category === 'both' || service.category === 'both' || canonicalCategory(service.category) === canonicalCategory(caregiver!.category)), 'This service is unavailable.');
  requireThat(data.vendorId === data.caregiverId && (data.organizationId || '') === (caregiver!.organizationId || '') && data.serviceLabel === (service!.label || service!.serviceName) && data.caregiverName === caregiver!.name && data.caregiverWorkType === caregiver!.workType && data.caregiverCategory === canonicalCategory(caregiver!.category));
  for (const [field, min, max] of [['userName',2,120],['careRecipient',2,120],['address',5,300],['city',2,100]] as const) textField(data[field], field, min, max);
  badInput(typeof data.userPhone === 'string' && /^\+[1-9]\d{7,14}$/.test(data.userPhone), 'Invalid contact phone.');
  badInput(Number.isInteger(data.durationHours) && data.durationHours >= 1 && data.durationHours <= 24 && ['one_time','recurring'].includes(data.recurrence), 'Invalid duration or recurrence.');
  const ends: Data = { morning: '12:00', day: '17:00', evening: '21:00', night: '23:59' };
  const windows = data.requestedTimeWindows;
  badInput(Array.isArray(windows) && windows.length <= 4 && new Set(windows).size === windows.length && windows.every((x) => typeof x === 'string' && Object.hasOwn(ends, x)), 'Invalid time windows.');
  badInput(/^\d{4}-\d{2}-\d{2}$/.test(data.date) && (/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time) || (data.time === '' && windows.length && ['parttime','part_time'].includes(caregiver!.workType))), 'Invalid schedule.');
  const time = data.time || windows.map((key: string) => ends[key]).sort().at(-1);
  const date = new Date(`${data.date}T${time}:00+05:45`);
  badInput(Number.isFinite(date.getTime()) && date > new Date(now) && new Date(date.getTime() + 345 * 60000).toISOString().slice(0, 10) === data.date && data.scheduleAt === date.toISOString(), 'Choose a valid future schedule in Asia/Kathmandu.');
  const rate = caregiver!.hourlyRate;
  const commission = org?.commissionRate ?? 15;
  requireThat(typeof rate === 'number' && rate >= 0 && rate <= 1000000 && (rate > 0 || caregiver!.allowZeroRate === true), 'The caregiver rate is not configured.');
  const total = Math.round(rate * 100) * data.durationHours;
  const fee = Math.round(total * commission / 100);
  requireThat(data.hourlyRate === Math.round(rate * 100) / 100 && data.commissionRate === commission && data.totalAmount === total / 100 && data.amountDue === total / 100 && data.platformCommission === fee / 100 && data.vendorEarnings === (total - fee) / 100, 'The booking quote changed. Refresh and confirm the new price.', 409, 'quote-changed');
}
