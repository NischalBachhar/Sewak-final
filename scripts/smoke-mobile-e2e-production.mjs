// Controlled production mobile lifecycle smoke.
// Creates only run-scoped synthetic identities/fixtures, drives the same Worker
// APIs used by mobile, then deletes those exact rows and verifies application
// data returns to its pre-run hash.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openTarget } from './d1-target.mjs';
import { encodeRecord, entities, insertSQL } from '../worker/src/model.mjs';

const APPLY_FLAG = '--apply-controlled-mobile-e2e';
assert.ok(process.argv.includes(APPLY_FLAG), `Explicit ${APPLY_FLAG} flag required`);

const origin = 'https://sewak-final.nischalbachhar9.workers.dev';
const accountId = '860970f755498a4fe10e16c2fa99ce55';
const mainId = '36fa1df1-aa5d-43a1-ad0e-a4e310c513c3';
const mediaId = 'c3721e25-4fb2-4a0d-b350-518ec9abbea2';
const config = readFileSync('wrangler.production.toml', 'utf8');

assert.match(config, /name = "sewak-final"/);
assert.match(config, /APP_WRITES_ENABLED = "true"/);
assert.ok(config.includes(mainId) && config.includes(mediaId), 'Exact production D1 bindings required');

// Mandatory no-mutation gate. If production is read-only, stop before creating
// an account or opening the remote D1 operator.
const healthResponse = await fetch(origin + '/api/health', {
  signal: AbortSignal.timeout(15000),
  cache: 'no-store',
});
assert.equal(healthResponse.status, 200, 'Production health must return HTTP 200');
const health = await healthResponse.json();
assert.equal(
  health.writesEnabled,
  true,
  'Production writes are disabled. No synthetic E2E data was created.',
);

assert.equal(
  process.env.CLOUDFLARE_ACCOUNT_ID,
  accountId,
  'Exact CLOUDFLARE_ACCOUNT_ID required',
);
assert.ok(
  process.env.CLOUDFLARE_API_TOKEN,
  'CLOUDFLARE_API_TOKEN is required for deterministic fixture setup/cleanup',
);

const run = randomUUID();
const password = randomBytes(32).toString('base64url') + '!Aa9';
const customerEmail = `mobile-e2e-customer-${run}@example.invalid`;
const caregiverEmail = `mobile-e2e-caregiver-${run}@example.invalid`;
const orgId = `org_mobile_e2e_${run}`;
const serviceId = `service_mobile_e2e_${run}`;
const taskId = `task_${randomUUID()}`;
const updateId = `update_${randomUUID()}`;

const reportDir = '.local-tools/mobile-e2e';
mkdirSync(reportDir, { recursive: true });
const reportPath = `${reportDir}/production-${run}.json`;
const report = {
  run,
  origin,
  startedAt: new Date().toISOString(),
  pass: false,
  steps: [],
};

const mark = (name, extra = {}) => {
  report.steps.push({ name, at: new Date().toISOString(), ...extra });
};

async function request(path, {
  body,
  headers = {},
  method = body ? 'POST' : 'GET',
  expected = 200,
  label = path,
} = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(45000),
  });

  const type = response.headers.get('Content-Type') || '';
  const data = type.startsWith('application/json')
    ? await response.json()
    : await response.text();

  assert.equal(
    response.status,
    expected,
    `${label}: expected HTTP ${expected}, got ${response.status} ${data?.error?.code || ''}`,
  );
  mark(label, { status: response.status });
  return { response, data };
}

const auth = (user) => ({ Authorization: `Bearer ${user.token}` });
const serverTimestamp = () => ({ __op: 'serverTimestamp' });

function logicalDateTwoDaysAhead() {
  const target = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(target);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const target = await openTarget({ remote: true, mainId, mediaId });
const { DB, MEDIA_DB } = target;
let customer = null;
let caregiver = null;
let bookingId = null;
let beforeHash = null;
let setupStarted = false;

async function applicationHash() {
  const result = {};
  for (const table of [...new Set(Object.values(entities).map((entry) => entry.table))].sort()) {
    result[table] = (await DB.prepare(`SELECT * FROM "${table}" ORDER BY id`).all()).results;
  }
  result.media = (
    await MEDIA_DB
      .prepare('SELECT id,owner_id,owner_type,mime_type,file_size,width,height,digest,created_at,updated_at FROM media ORDER BY id')
      .all()
  ).results;
  return digest(result);
}

async function insertEntity(name, id, data) {
  const encoded = encodeRecord(name, id, data);
  const { sql, params } = insertSQL(name, encoded);
  await DB.prepare(sql).bind(...params).run();
}

async function record(path, user) {
  const result = await request('/api/records/' + path, {
    headers: auth(user),
    label: `read ${path}`,
  });
  const item = result.data?.items?.[0];
  assert.ok(item, `Missing record ${path}`);
  return { id: item.id, ...item.data };
}

try {
  beforeHash = await applicationHash();
  setupStarted = true;

  const register = async (email, name) => {
    const result = await request('/auth/register', {
      body: { email, password, name, sessionMode: 'bearer' },
      label: `register ${name}`,
    });
    assert.match(result.data.user.uid, /^usr_/);
    assert.match(result.data.token, /^swk_[\w-]{43}$/);
    return {
      uid: result.data.user.uid,
      email,
      token: result.data.token,
      sessionId: result.data.session.id,
    };
  };

  customer = await register(customerEmail, 'Mobile E2E Customer');
  caregiver = await register(caregiverEmail, 'Mobile E2E Caregiver');

  // Operator-only fixture setup. These records are synthetic and run-scoped;
  // the lifecycle itself is exercised exclusively through live Worker APIs.
  await DB.prepare(
    'UPDATE users SET role=?, profile_complete=1 WHERE id=? AND email=?',
  ).bind('caregiver', caregiver.uid, caregiver.email).run();

  const now = new Date().toISOString();
  await insertEntity('organizations', orgId, {
    organizationId: orgId,
    adminUid: null,
    organizationName: 'Synthetic Mobile E2E Organization',
    adminName: 'Synthetic E2E',
    adminEmail: caregiver.email,
    businessPhone: '+9779800000001',
    businessAddress: 'Synthetic E2E Address',
    businessCity: 'Hetauda',
    commissionRate: 15,
    verified: true,
    profileComplete: true,
    role: 'orgadmin',
    isApproved: true,
    isSuspended: false,
    isBlacklisted: false,
    createdAt: now,
    updatedAt: now,
  });

  await insertEntity('services', serviceId, {
    label: 'Synthetic Mobile E2E Care',
    serviceName: 'Synthetic Mobile E2E Care',
    category: 'caregiver',
    description: 'Temporary automated production E2E service.',
    price: 500,
    isActive: true,
    organizationId: orgId,
    organizationName: 'Synthetic Mobile E2E Organization',
    createdBy: caregiver.uid,
    createdAt: now,
    updatedAt: now,
  });

  await insertEntity('vendors', caregiver.uid, {
    uid: caregiver.uid,
    vendorId: caregiver.uid,
    name: 'Mobile E2E Caregiver',
    email: caregiver.email,
    phone: '+9779800000001',
    location: 'Hetauda',
    category: 'caregiver',
    workType: 'parttime',
    shifts: ['morning', 'day', 'night'],
    servicesOffered: [serviceId],
    hourlyRate: 500,
    experience: 3,
    bio: 'Synthetic production mobile E2E caregiver.',
    jobsCompleted: 0,
    rating: 0,
    reviewCount: 0,
    verified: true,
    backgroundChecked: true,
    isCertified: true,
    isAvailable: true,
    isApproved: true,
    isSuspended: false,
    isBlacklisted: false,
    organizationId: orgId,
    organizationName: 'Synthetic Mobile E2E Organization',
    isIndependent: false,
    allowZeroRate: false,
    identityVerificationStatus: 'verified',
    phoneVerificationStatus: 'verified',
    trainingVerificationStatus: 'verified',
    backgroundVerificationStatus: 'verified',
    referencesVerificationStatus: 'verified',
    createdAt: now,
    updatedAt: now,
  });

  const caregiverMe = await request('/auth/me', {
    headers: auth(caregiver),
    label: 'caregiver session reflects D1 role',
  });
  assert.equal(caregiverMe.data.user.role, 'caregiver');

  const publicCaregivers = await request('/api/query', {
    body: { path: 'publicCaregivers', limit: 50 },
    label: 'customer-facing caregiver discovery',
  });
  assert.ok(
    publicCaregivers.data.items.some((item) => item.id === caregiver.uid),
    'Synthetic approved caregiver was not visible in the public projection',
  );

  const date = logicalDateTwoDaysAhead();
  const time = '10:00';
  const scheduleAt = new Date(`${date}T${time}:00+05:45`).toISOString();
  bookingId = `${customer.uid}_${randomUUID()}`;
  const requestFingerprint = createHash('sha256')
    .update(`${run}:${bookingId}:synthetic-mobile-e2e`)
    .digest('hex');

  const booking = {
    schemaVersion: 2,
    requestFingerprint,
    requestedTimeWindows: [],
    scheduleAt,
    commissionRate: 15,
    userId: customer.uid,
    userName: 'Mobile E2E Customer',
    userPhone: '+9779800000000',
    userEmail: customer.email,
    address: 'Synthetic E2E Address, Ward 4',
    city: 'Hetauda',
    date,
    time,
    durationHours: 2,
    recurrence: 'one_time',
    notes: 'Synthetic mobile E2E only.',
    careRecipient: 'Synthetic Recipient',
    careNeeds: 'Synthetic care lifecycle verification.',
    serviceId,
    serviceLabel: 'Synthetic Mobile E2E Care',
    caregiverId: caregiver.uid,
    vendorId: caregiver.uid,
    organizationId: orgId,
    organizationName: 'Synthetic Mobile E2E Organization',
    caregiverName: 'Mobile E2E Caregiver',
    caregiverLocation: 'Hetauda',
    caregiverWorkType: 'parttime',
    caregiverShifts: ['morning', 'day', 'night'],
    caregiverCategory: 'caregiver',
    status: 'pending',
    hourlyRate: 500,
    totalAmount: 1000,
    platformCommission: 150,
    vendorEarnings: 850,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    amountDue: 1000,
    createdAt: serverTimestamp(),
  };

  await request('/api/commit', {
    headers: auth(customer),
    body: {
      writes: [{ path: `bookings/${bookingId}`, kind: 'set', data: booking }],
      preconditions: [],
    },
    label: 'customer creates booking',
  });

  let current = await record(`bookings/${bookingId}`, customer);
  assert.equal(current.status, 'pending');
  current = await record(`bookings/${bookingId}`, caregiver);
  assert.equal(current.caregiverId, caregiver.uid);

  await request('/api/commit', {
    headers: auth(caregiver),
    body: {
      writes: [{
        path: `bookings/${bookingId}`,
        kind: 'update',
        data: { status: 'accepted', updatedAt: serverTimestamp() },
      }],
      preconditions: [],
    },
    label: 'caregiver accepts booking',
  });
  assert.equal((await record(`bookings/${bookingId}`, customer)).status, 'accepted');

  await request('/api/commit', {
    headers: auth(caregiver),
    body: {
      writes: [
        {
          path: `careSessions/${bookingId}`,
          kind: 'set',
          data: {
            bookingId,
            caregiverId: caregiver.uid,
            customerId: customer.uid,
            organizationId: orgId,
            scheduledDate: date,
            scheduledTime: time,
            scheduledDurationHours: 2,
            status: 'in_progress',
            actualCheckIn: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        },
        {
          path: `bookings/${bookingId}`,
          kind: 'update',
          data: {
            status: 'in_progress',
            careSessionId: bookingId,
            updatedAt: serverTimestamp(),
          },
        },
      ],
      preconditions: [],
    },
    label: 'caregiver checks in',
  });
  assert.equal((await record(`bookings/${bookingId}`, customer)).status, 'in_progress');

  await request('/api/commit', {
    headers: auth(caregiver),
    body: {
      writes: [{
        path: `careSessions/${bookingId}/tasks/${taskId}`,
        kind: 'set',
        data: {
          label: 'Synthetic care task',
          status: 'pending',
          createdBy: caregiver.uid,
          createdAt: serverTimestamp(),
        },
      }],
      preconditions: [],
    },
    label: 'caregiver adds care task',
  });

  await request('/api/commit', {
    headers: auth(caregiver),
    body: {
      writes: [{
        path: `careSessions/${bookingId}/updates/${updateId}`,
        kind: 'set',
        data: {
          caregiverId: caregiver.uid,
          type: 'note',
          message: 'Synthetic family update from mobile E2E.',
          createdAt: serverTimestamp(),
        },
      }],
      preconditions: [],
    },
    label: 'caregiver sends family update',
  });

  const customerTasks = await request('/api/query', {
    headers: auth(customer),
    body: {
      path: `careSessions/${bookingId}/tasks`,
      order: { field: 'createdAt', direction: 'asc' },
      limit: 50,
    },
    label: 'customer sees care tasks',
  });
  assert.ok(customerTasks.data.items.some((item) => item.id === taskId));

  const customerUpdates = await request('/api/query', {
    headers: auth(customer),
    body: {
      path: `careSessions/${bookingId}/updates`,
      order: { field: 'createdAt', direction: 'desc' },
      limit: 50,
    },
    label: 'customer sees family update',
  });
  assert.ok(customerUpdates.data.items.some((item) => item.id === updateId));

  await request('/api/commit', {
    headers: auth(caregiver),
    body: {
      writes: [{
        path: `careSessions/${bookingId}/tasks/${taskId}`,
        kind: 'update',
        data: {
          status: 'completed',
          completedAt: serverTimestamp(),
          completedBy: caregiver.uid,
        },
      }],
      preconditions: [],
    },
    label: 'caregiver completes care task',
  });

  await request('/api/commit', {
    headers: auth(caregiver),
    body: {
      writes: [
        {
          path: `careSessions/${bookingId}`,
          kind: 'update',
          data: {
            status: 'completed',
            actualCheckOut: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        },
        {
          path: `bookings/${bookingId}`,
          kind: 'update',
          data: { status: 'completed', updatedAt: serverTimestamp() },
        },
      ],
      preconditions: [],
    },
    label: 'caregiver checks out',
  });
  assert.equal((await record(`bookings/${bookingId}`, customer)).status, 'completed');

  await request('/api/commit', {
    headers: auth(customer),
    body: {
      writes: [{
        path: `reviews/${bookingId}`,
        kind: 'set',
        data: {
          bookingId,
          caregiverId: caregiver.uid,
          customerId: customer.uid,
          rating: 5,
          comment: 'Synthetic verified mobile E2E review.',
          isVerifiedReview: true,
          createdAt: serverTimestamp(),
        },
      }],
      preconditions: [],
    },
    label: 'customer submits verified review',
  });

  const review = await record(`reviews/${bookingId}`, customer);
  assert.equal(review.rating, 5);
  assert.equal(review.isVerifiedReview, true);

  const publicReviews = await request('/api/query', {
    body: {
      path: 'publicReviews',
      filters: [{ field: 'caregiverId', op: '==', value: caregiver.uid }],
      order: { field: 'createdAt', direction: 'desc' },
      limit: 50,
    },
    label: 'verified review appears publicly',
  });
  assert.ok(
    publicReviews.data.items.some((item) => item.id === bookingId),
    'Verified completed-care review did not appear in public projection',
  );

  report.lifecyclePassed = true;
} catch (error) {
  report.failure = { name: error?.name || 'Error', message: error?.message || String(error) };
} finally {
  if (setupStarted) {
    try {
      // Delete children and dependent rows first. Every deletion is scoped to
      // this run's synthetic IDs; no broad production cleanup is permitted.
      if (bookingId) {
        await DB.prepare('DELETE FROM reviews WHERE id=? AND customer_id=?').bind(bookingId, customer?.uid || '').run();
        await DB.prepare('DELETE FROM care_tasks WHERE session_id=?').bind(bookingId).run();
        await DB.prepare('DELETE FROM care_updates WHERE session_id=?').bind(bookingId).run();
        await DB.prepare('DELETE FROM care_sessions WHERE id=? AND booking_id=?').bind(bookingId, bookingId).run();
        await DB.prepare('DELETE FROM bookings WHERE id=? AND user_id=?').bind(bookingId, customer?.uid || '').run();
      }

      if (caregiver?.uid) {
        await DB.prepare('DELETE FROM caregivers WHERE id=? AND email=?').bind(caregiver.uid, caregiver.email).run();
      }
      await DB.prepare('DELETE FROM services WHERE id=? AND created_by=?').bind(serviceId, caregiver?.uid || '').run();
      await DB.prepare('DELETE FROM organizations WHERE id=? AND organization_name=?').bind(orgId, 'Synthetic Mobile E2E Organization').run();

      for (const user of [caregiver, customer].filter(Boolean)) {
        await MEDIA_DB.prepare('DELETE FROM media WHERE owner_id=?').bind(user.uid).run();
        await DB.batch([
          DB.prepare('DELETE FROM cf_invitations WHERE user_id=?').bind(user.uid),
          DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind(user.uid),
          DB.prepare('DELETE FROM cf_credentials WHERE user_id=? AND email=?').bind(user.uid, user.email),
          DB.prepare('DELETE FROM users WHERE id=? AND email=?').bind(user.uid, user.email),
        ]);
      }

      const afterHash = await applicationHash();
      assert.equal(afterHash, beforeHash, 'Application/media data hash changed after E2E cleanup');
      report.cleanupVerified = true;
      report.applicationDataRestored = true;
    } catch (cleanupError) {
      report.cleanupFailure = {
        name: cleanupError?.name || 'Error',
        message: cleanupError?.message || String(cleanupError),
      };
    }
  }

  report.pass = Boolean(report.lifecyclePassed && report.cleanupVerified);
  report.completedAt = new Date().toISOString();
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  await target.close();

  console.log(JSON.stringify({
    pass: report.pass,
    lifecyclePassed: Boolean(report.lifecyclePassed),
    cleanupVerified: Boolean(report.cleanupVerified),
    steps: report.steps.length,
    report: reportPath,
    ...(report.failure ? { failure: report.failure } : {}),
    ...(report.cleanupFailure ? { cleanupFailure: report.cleanupFailure } : {}),
  }));

  if (!report.pass) process.exitCode = 1;
}
