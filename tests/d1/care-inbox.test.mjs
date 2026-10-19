import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, seed, call } from './harness.mjs';

const job = {
  title: 'Afternoon home care',
  description: 'Help a family member with daily household routines.',
  category: 'caregiver', city: 'Hetauda', schedule: 'flexible', hourlyBudget: null,
};

test('inbox lists only active customer/caregiver conversation threads', async () => {
  const env = environment(); await seed(env);
  const created = await call(env, '/api/care-jobs', { uid: 'customer', method: 'POST', json: job });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const jobId = created.data.id;
  const applied = await call(env, '/api/care-jobs/' + jobId + '/apply', {
    uid: 'caregiver', method: 'POST', json: { message: 'I have relevant home-care experience and afternoon availability.' },
  });
  assert.equal(applied.status, 200, JSON.stringify(applied.data));
  const payload = { kind: 'job', contextId: jobId, caregiverId: 'caregiver', body: 'Can we discuss availability?' };
  const sent = await call(env, '/api/care-messages', { uid: 'customer', method: 'POST', json: payload });
  assert.equal(sent.status, 200, JSON.stringify(sent.data));
  const customer = await call(env, '/api/care-inbox', { uid: 'customer' });
  const caregiver = await call(env, '/api/care-inbox', { uid: 'caregiver' });
  assert.equal(customer.status, 200, JSON.stringify(customer.data));
  assert.equal(caregiver.status, 200, JSON.stringify(caregiver.data));
  assert.equal(customer.data.conversations.length, 1);
  assert.equal(customer.data.conversations[0].kind, 'job');
  assert.equal(customer.data.conversations[0].contextId, jobId);
  assert.equal(customer.data.conversations[0].preview, payload.body);
  assert.equal(caregiver.data.conversations[0].partnerName, 'Test Customer');
  assert.equal((await call(env, '/api/care-inbox', { uid: 'other' })).data.conversations.length, 0);
  assert.equal((await call(env, '/api/care-inbox', { uid: 'admin' })).status, 403);
  assert.equal((await call(env, '/api/care-inbox')).status, 401);
  assert.equal((await call(env, '/api/care-inbox', { uid: 'customer', method: 'POST', json: {} })).status, 404);
  const withdrawn = await call(env, '/api/care-jobs/' + jobId + '/withdraw', { uid: 'caregiver', method: 'POST', json: {} });
  assert.equal(withdrawn.status, 200);
  assert.equal((await call(env, '/api/care-inbox', { uid: 'customer' })).data.conversations.length, 0);
  assert.equal((await call(env, '/api/care-inbox', { uid: 'caregiver' })).data.conversations.length, 0);
});
