import test from 'node:test';
import assert from 'node:assert/strict';
import {qaFailureDetail} from '../../scripts/qa-failure-detail.mjs';
test('synthetic QA shows safe API validation message for diagnosis', () => {
  assert.equal(qaFailureDetail({
    label:'create synthetic user', status:400,
    error:{code:'invalid-argument', message:'Request contains unsupported fields.'},
    password:'SECRET'
  }), 'create synthetic user: HTTP 400 invalid-argument — Request contains unsupported fields.');
});
test('synthetic QA redacts credentials and arbitrary email in failure text', () => {
  const detail=qaFailureDetail({
    label:'synthetic user', status:400, password:'StrongPrivatePassword',
    error:{code:'invalid-argument', message:'StrongPrivatePassword qa-user@example.invalid swk_0123456789abcdef0123456789abcdef0123456789abc'}
  });
  assert.ok(!detail.includes('StrongPrivatePassword'));
  assert.ok(!detail.includes('qa-user@example.invalid'));
  assert.ok(!detail.includes('swk_0123456789abcdef'));
});
