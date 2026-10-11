import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { environment, seed, put, call } from './harness.mjs';
import { createWorker } from '../../worker/src/index.ts';
import { Repository } from '../../worker/src/repository.ts';
import { organizationFields, organizationTypes } from '../../worker/src/onboarding.ts';
import { ORGANIZATION_TYPES } from '../../src/organizationTypes.mjs';

const combined = 'Caregiver & Household Staffing Agency';
const selected = ['catalog_elderly_care', 'catalog_personal_care_assistance', 'catalog_housekeeping', 'catalog_cooking_meal_preparation'];
const details = { selectedRole: 'orgadmin', organizationName: 'Combined Support', organizationType: combined, businessPhone: '9800000000', businessAddress: 'Test street 12', businessCity: 'Hetauda', servicesOffered: selected };
async function register(env, extra = {}) {
  const response = await createWorker().fetch(new Request('http://localhost/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'combined@example.test', password: 'Synthetic-password-2026!', name: 'Combined Owner', sessionMode: 'bearer', ...details, ...extra }) }), env);
  return { status: response.status, data: await response.json() };
}
const update = (env, uid, path, data) => call(env, '/api/commit', { uid, method: 'POST', json: { writes: [{ path, kind: 'update', data }] } });
const search = (env, criteria) => call(env, '/api/query', { method: 'POST', json: { path: 'publicCaregivers', search: criteria } });

test('shared UI, Worker and API organization types retain every legacy value and order', async () => {
  const expected = ['Caregiver Agency', 'Home Care Service Provider', 'Household Staffing Agency', combined, 'Nursing / Home Healthcare Provider', 'Other'];
  assert.deepEqual(ORGANIZATION_TYPES, expected);
  assert.equal(organizationTypes, ORGANIZATION_TYPES);
  const api = JSON.parse(readFileSync(new URL('../../docs/openapi.json', import.meta.url), 'utf8'));
  assert.deepEqual(api.paths['/auth/register'].post.requestBody.content['application/json'].schema.properties.organizationType.enum, expected);
  const env = environment();
  for (const organizationType of expected) {
    const result = await organizationFields(new Repository(env), { ...details, organizationType, organizationTypeOther: 'Community Support', servicesOffered: [] }, 'owner');
    assert.equal(result.organizationType, organizationType);
    assert.deepEqual(result.servicesOffered, []);
  }
});

test('combined registration persists exact selections in profile, application and D1 mappings through approval and edits', async () => {
  const env = environment(); await seed(env);
  const result = await register(env); assert.equal(result.status, 200, JSON.stringify(result.data));
  const uid = result.data.user.uid;
  assert.equal(result.data.user.role, 'orgadmin');
  const read = path => new Repository(env).data(path + '/' + uid);
  for (const path of ['organizations', 'organizationApplications']) {
    const record = await read(path);
    assert.equal(record.organizationType, combined);
    assert.deepEqual(record.servicesOffered, selected);
  }
  assert.equal((await read('organizations')).isApproved, false);
  assert.equal((await read('organizationApplications')).status, 'pending');
  const mappings = () => env.DB.database.prepare('SELECT service_id FROM organization_services WHERE organization_id=? ORDER BY service_id').all(uid).map(row => row.service_id);
  assert.deepEqual(mappings(), [...selected].sort());
  assert.equal(JSON.parse(env.DB.database.prepare('SELECT extra_json FROM organizations WHERE id=?').get(uid).extra_json).organizationType, combined);
  const pending = await call(env, '/api/query', { uid: 'admin', method: 'POST', json: { path: 'organizationApplications', filters: [{ field: 'status', op: '==', value: 'pending' }] } });
  assert.equal(pending.data.items.find(item => item.id === uid).data.organizationType, combined);
  assert.equal((await call(env, '/api/actions/approveOrganizationApplication', { uid, method: 'POST', json: { applicationId: uid } })).status, 403);
  assert.equal((await call(env, '/api/actions/approveOrganizationApplication', { uid: 'admin', method: 'POST', json: { applicationId: uid } })).status, 200);
  assert.equal((await read('organizations')).organizationType, combined);
  assert.deepEqual((await read('organizations')).servicesOffered, selected);
  assert.equal((await read('organizationApplications')).status, 'approved');
  assert.deepEqual(mappings(), [...selected].sort());
  assert.equal((await call(env, '/api/records/organizations/' + uid, { uid: 'org' })).status, 403);
  assert.equal((await update(env, 'org', 'organizations/' + uid, { servicesOffered: [] })).status, 403);
  const retained = ['catalog_elderly_care', 'catalog_housekeeping'];
  assert.equal((await update(env, uid, 'organizations/' + uid, { servicesOffered: retained, profileComplete: true })).status, 200);
  assert.deepEqual((await read('organizations')).servicesOffered, retained);
  assert.deepEqual(mappings(), [...retained].sort());
  assert.equal((await update(env, uid, 'organizations/' + uid, { organizationType: 'Household Staffing Agency' })).status, 200);
  assert.deepEqual(mappings(), [...retained].sort());
  assert.equal((await update(env, uid, 'organizations/' + uid, { organizationType: combined, servicesOffered: [] })).status, 200);
  assert.deepEqual(mappings(), []);
  assert.deepEqual(env.DB.database.prepare('PRAGMA foreign_key_check').all(), []);
});

test('combined type does not auto-assign services and rejects unknown, duplicate, inactive, medical and cross-tenant IDs atomically', async () => {
  for (const ids of [[], undefined]) {
    const env = environment();
    const result = await register(env, { servicesOffered: ids }); assert.equal(result.status, 200);
    assert.deepEqual((await new Repository(env).data('organizations/' + result.data.user.uid)).servicesOffered, []);
    assert.equal(env.DB.database.prepare('SELECT COUNT(*) n FROM organization_services').get().n, 0);
  }
  for (const invalid of [{ organizationType: 'Caregiver and Household Staffing Agency' }, ...[['missing'], [selected[0], selected[0]], ['catalog_home_nursing'], ['care'], ['inactive'], Array(21).fill(selected[0])].map(servicesOffered => ({ servicesOffered }))]) {
    const env = environment(); await seed(env);
    await put(env, 'services/inactive', { label: 'Inactive Support', category: 'household', isActive: false });
    const result = await register(env, invalid); assert.notEqual(result.status, 200, JSON.stringify(invalid));
    assert.equal(env.DB.database.prepare("SELECT COUNT(*) n FROM users WHERE email='combined@example.test'").get().n, 0);
    assert.equal(env.DB.database.prepare('SELECT COUNT(*) n FROM organization_applications').get().n, 0);
    assert.equal(env.DB.database.prepare('SELECT COUNT(*) n FROM organization_services').get().n, 0);
  }
});

test('public listings and category/service filters use actual caregiver assignments under a combined organization', async () => {
  const env = environment(); const records = await seed(env);
  const result = await register(env); assert.equal(result.status, 200);
  const uid = result.data.user.uid;
  for (const [id, category, servicesOffered] of [['combined-care', 'caregiver', [selected[0]]], ['combined-house', 'household', ['catalog_housekeeping']], ['combined-both', 'both', [selected[0], 'catalog_housekeeping']], ['combined-empty', 'both', []]]) {
    await put(env, 'vendors/' + id, { ...records['vendors/caregiver'], uid: id, vendorId: id, organizationId: uid, name: id, category, servicesOffered });
  }
  assert.equal((await search(env, { text: 'combined-' })).data.total, 0);
  assert.equal((await call(env, '/api/actions/approveOrganizationApplication', { uid: 'admin', method: 'POST', json: { applicationId: uid } })).status, 200);
  for (const [category, serviceId, expected] of [['caregiver', selected[0], ['combined-both', 'combined-care']], ['household', 'catalog_housekeeping', ['combined-both', 'combined-house']]]) {
    const results = await search(env, { text: 'combined-', category, serviceId });
    assert.equal(results.status, 200); assert.deepEqual(results.data.items.map(item => item.id).sort(), expected);
    assert.ok(results.data.items.every(item => item.data.organizationName === details.organizationName && item.data.servicesOffered.includes(serviceId)));
  }
  assert.equal((await search(env, { text: 'combined-', serviceId: 'catalog_cooking_meal_preparation' })).data.total, 0);
  assert.equal((await search(env, { serviceId: 'care' })).data.total, 1, 'legacy organization stays discoverable');
  assert.equal((await call(env, '/api/actions/applyAccountSafetyAction', { uid: 'admin', method: 'POST', json: { targetType: 'organization', targetId: uid, reason: 'Synthetic test suspension' } })).status, 200);
  assert.equal((await search(env, { text: 'combined-' })).data.total, 0);
});
