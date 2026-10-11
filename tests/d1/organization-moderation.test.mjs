import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, seed, put, call } from './harness.mjs';
import { Repository } from '../../worker/src/repository.ts';

const action = (env, uid, operation, json) => call(env, '/api/actions/' + operation, { uid, method: 'POST', json });

test('reject only pending organizations, persist a distinct review status and deny repeat actions', async () => {
  const env = environment();
  await seed(env);
  const approved = await action(env, 'admin', 'applyAccountSafetyAction', {
    targetType: 'organization', targetId: 'org', reason: 'Verification failed', disposition: 'rejected',
  });
  assert.equal(approved.status, 409);

  await env.DB.prepare('UPDATE organizations SET is_approved=0 WHERE id=?').bind('org').run();
  const rejected = await action(env, 'admin', 'applyAccountSafetyAction', {
    targetType: 'organization', targetId: 'org', reason: 'Verification failed', disposition: 'rejected',
  });
  assert.equal(rejected.status, 200, JSON.stringify(rejected.data));
  const repo = new Repository(env);
  const org = await repo.data('organizations/org');
  assert.equal(org.reviewStatus, 'rejected');
  assert.equal(org.isApproved, false);
  assert.equal(org.isBlacklisted, true);
  assert.equal(org.isSuspended, true);
  assert.equal((await repo.data('users/org')).isSuspended, true);

  assert.equal((await action(env, 'admin', 'applyAccountSafetyAction', {
    targetType: 'organization', targetId: 'org', reason: 'Again', disposition: 'rejected',
  })).status, 409);
  assert.equal((await action(env, 'admin', 'approveOrganizationAccount', { organizationId: 'org' })).status, 403);
  const audit = await env.DB.prepare("SELECT id FROM admin_audit_logs WHERE action='account_safety_action_applied' LIMIT 1").first();
  assert.ok(audit);
});

test('delete requires superadmin, blocked organization and exact name; retains linked care history', async () => {
  const env = environment();
  await seed(env);
  await put(env, 'bookings/synthetic_booking', {
    userId: 'customer', caregiverId: 'caregiver', vendorId: 'caregiver',
    organizationId: 'org', serviceId: 'care', status: 'completed',
  });
  const deletion = { organizationId: 'org', confirmation: 'Test Organization' };
  assert.equal((await action(env, 'customer', 'deleteOrganizationAccount', deletion)).status, 403);
  assert.equal((await action(env, 'admin', 'deleteOrganizationAccount', deletion)).status, 409);

  const blocked = await action(env, 'admin', 'applyAccountSafetyAction', {
    targetType: 'organization', targetId: 'org', reason: 'Safety review', disposition: 'blacklisted',
  });
  assert.equal(blocked.status, 200, JSON.stringify(blocked.data));
  assert.equal((await action(env, 'admin', 'deleteOrganizationAccount', { ...deletion, confirmation: 'Wrong name' })).status, 400);
  const ok = await action(env, 'admin', 'deleteOrganizationAccount', deletion);
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.deleted, true);
  assert.equal(ok.data.deletionMode, 'soft');

  const repo = new Repository(env);
  const org = await repo.data('organizations/org');
  assert.equal(org.reviewStatus, 'deleted');
  assert.ok(org.deletedAt);
  assert.equal(org.deletedBy, 'admin');
  assert.equal(org.isSuspended, true);
  assert.equal((await repo.data('users/org')).isSuspended, true);
  assert.ok(await repo.data('bookings/synthetic_booking'));
  assert.ok(await repo.data('vendors/caregiver'));
  assert.equal((await action(env, 'admin', 'deleteOrganizationAccount', deletion)).status, 409);
  assert.equal((await action(env, 'admin', 'approveOrganizationAccount', { organizationId: 'org' })).status, 403);
  assert.equal((await action(env, 'admin', 'applyAccountSafetyAction', {
    targetType: 'organization', targetId: 'org', reason: 'Repeat',
  })).status, 403);
  assert.ok(await env.DB.prepare("SELECT id FROM admin_audit_logs WHERE action='organization_deleted' LIMIT 1").first());
});

test('legacy organization restrictions can be safely deleted without inferring a historical rejection', async () => {
  const env = environment();
  await seed(env);
  const response = await action(env, 'admin', 'applyAccountSafetyAction', {
    targetType: 'organization', targetId: 'org', reason: 'Existing restriction',
  });
  assert.equal(response.status, 200);
  const before = await new Repository(env).data('organizations/org');
  assert.equal(before.reviewStatus, 'blacklisted');
  const deleted = await action(env, 'admin', 'deleteOrganizationAccount', {
    organizationId: 'org', confirmation: 'Test Organization',
  });
  assert.equal(deleted.status, 200, JSON.stringify(deleted.data));
});
