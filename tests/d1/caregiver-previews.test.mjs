import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, seed, put, call, booking } from './harness.mjs';

const search = env => call(env, '/api/query', { method: 'POST', json: { path: 'publicCaregivers', search: {}, limit: 3 } });
test('preview page is bounded, uses actual public services and redacts all private fields', async () => {
  const env = environment(), records = await seed(env);
  for (let i = 0; i < 5; i++) await put(env, `vendors/preview-${i}`, { ...records['vendors/caregiver'], name: `Preview ${i}`, phone: 'PRIVATE', email: 'PRIVATE', address: 'PRIVATE', privateNotes: 'PRIVATE', rating: 5, reviewCount: 999 });
  const result = await search(env);
  assert.equal(result.status, 200); assert.equal(result.data.items.length, 3); assert.equal(result.data.total, 6); assert.ok(result.data.nextCursor);
  for (const { data } of result.data.items) {
    assert.equal(data.isAvailable, true); assert.equal(data.isApproved, true);
    assert.deepEqual(data.servicesOffered, ['care']);
    assert.equal(data.reviewCount, 0); assert.equal(data.rating, 0);
    assert.ok(!JSON.stringify(data).includes('PRIVATE'));
  }
});

test('all restricted caregiver, user and organization states are excluded from preview and direct profiles', async () => {
  for (const sql of [
    'UPDATE caregivers SET is_approved=0', 'UPDATE caregivers SET is_suspended=1', 'UPDATE caregivers SET is_blacklisted=1',
    "UPDATE users SET is_suspended=1 WHERE id='caregiver'", "UPDATE users SET is_blacklisted=1 WHERE id='caregiver'",
    'UPDATE organizations SET is_approved=0', 'UPDATE organizations SET is_suspended=1', 'UPDATE organizations SET is_blacklisted=1',
  ]) {
    const env = environment(); await seed(env); env.DB.database.exec(sql);
    assert.equal((await search(env)).data.items.length, 0, sql);
    assert.equal((await call(env, '/api/records/publicCaregivers/caregiver')).data.items.length, 0, sql);
  }
});

test('unavailable and missing availability remain distinguishable on public profiles; search and booking fail closed', async () => {
  for (const availability of [false, undefined]) {
    const env = environment(), records = await seed(env);
    const profile = { ...records['vendors/caregiver'], isAvailable: availability };
    if (availability === undefined) delete profile.isAvailable;
    await put(env, 'vendors/caregiver', profile);
    assert.equal((await search(env)).data.items.length, 0);
    const publicProfile = (await call(env, '/api/records/publicCaregivers/caregiver')).data.items[0].data;
    // Preserve the legacy/mobile boolean contract while allowing web UX to
    // distinguish a confirmed negative from missing information.
    assert.equal(publicProfile.isAvailable, false);
    assert.equal(publicProfile.availabilityConfirmed, availability === false);
    assert.equal((await call(env, '/api/commit', { uid: 'customer', method: 'POST', json: { writes: [booking()] } })).status, 403);
    assert.equal(env.DB.database.prepare('SELECT COUNT(*) n FROM bookings').get().n, 0);
  }
});

test('availability changing after preview and during commit rejects stale booking without writes', async () => {
  const env = environment(); await seed(env); assert.equal((await search(env)).data.items.length, 1);
  await call(env, '/api/commit', { uid: 'caregiver', method: 'POST', json: { writes: [{ path: 'vendors/caregiver', kind: 'update', data: { isAvailable: false } }] } });
  assert.equal((await call(env, '/api/commit', { uid: 'customer', method: 'POST', json: { writes: [booking()] } })).status, 403);
  await call(env, '/api/commit', { uid: 'caregiver', method: 'POST', json: { writes: [{ path: 'vendors/caregiver', kind: 'update', data: { isAvailable: true } }] } });
  const original = env.DB.batch.bind(env.DB);
  env.DB.batch = async statements => {
    env.DB.database.exec("UPDATE caregivers SET is_available=0, version=version+1 WHERE id='caregiver'");
    return original(statements);
  };
  assert.equal((await call(env, '/api/commit', { uid: 'customer', method: 'POST', json: { writes: [booking()] } })).status, 409);
  assert.equal(env.DB.database.prepare('SELECT COUNT(*) n FROM bookings').get().n, 0);
});
