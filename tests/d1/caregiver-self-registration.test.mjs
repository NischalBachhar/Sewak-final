import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, call } from './harness.mjs';

test('independent caregiver can register but starts pending, invisible and unverified', async () => {
  const env = environment();
  const registration = await call(env, '/api/auth/register', {
    method: 'POST',
    json: {
      sessionMode: 'bearer', name: 'Independent Caregiver',
      email: 'selfcare@example.test', password: 'Safe-demo-Password-987!',
      selectedRole: 'caregiver',
    },
  });
  assert.equal(registration.status, 200, JSON.stringify(registration.data));
  assert.equal(registration.data.user.role, 'caregiver');
  const uid = registration.data.user.uid;
  const row = await env.DB.prepare('SELECT role, is_approved AS approved, profile_complete AS complete FROM users WHERE id=?').bind(uid).first();
  assert.equal(row.role, 'caregiver');
  assert.equal(row.approved, 0);
  assert.equal(row.complete, 0);
  const vendor = await env.DB.prepare('SELECT is_approved AS approved, is_available AS available, verified, is_independent AS independent, organization_id AS organizationId FROM caregivers WHERE id=?').bind(uid).first();
  assert.ok(vendor);
  assert.equal(vendor.approved, 0);
  assert.equal(vendor.available, 0);
  assert.equal(vendor.verified, 0);
  assert.equal(vendor.independent, 1);
  assert.equal(vendor.organizationId, null);
  const publicResult = await call(env, '/api/query', { method: 'POST', json: { path: 'publicCaregivers', limit: 50 } });
  assert.equal(publicResult.status, 200, JSON.stringify(publicResult.data));
  assert.ok(!publicResult.data.items.some(item => item.id === uid));
  const invalidRole = await call(env, '/api/auth/complete-registration', {
    uid, method: 'POST', json: { name: 'Independent Caregiver', selectedRole: 'orgadmin', organizationName: 'Exploit' },
  });
  assert.equal(invalidRole.status, 403, JSON.stringify(invalidRole.data));
  const validRole = await call(env, '/api/auth/complete-registration', {
    uid, method: 'POST', json: { name: 'Independent Caregiver', selectedRole: 'caregiver', organizationName: '' },
  });
  assert.equal(validRole.status, 200, JSON.stringify(validRole.data));
});
