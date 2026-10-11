import test from 'node:test';
import assert from 'node:assert/strict';
import {controlledQaGmail,syntheticQaEmail} from '../../scripts/synthetic-qa-email.mjs';

const run='a1b2c3d4-e5f6-4758-9234-0123456789ab';
test('production QA needs operator-controlled Gmail base',()=>{
  for(const value of [undefined,'','not-email','qa@example.invalid','dummy+tag@gmail.com','x@gmail.com','foo..bar@gmail.com']) {
    assert.throws(()=>controlledQaGmail(value));
  }
  assert.equal(controlledQaGmail('  Sewak.QA2026@GMAIL.COM  '),'sewak.qa2026@gmail.com');
});
test('each production QA role receives a unique Gmail plus alias',()=>{
  const roles=['user','caregiver','orgadmin','superadmin','rate'];
  const emails=roles.map(role=>syntheticQaEmail({role,run,gmailBase:'sewak.qa2026@gmail.com'}));
  assert.equal(new Set(emails).size,roles.length);
  for(const email of emails) {
    assert.match(email,/^sewak\.qa2026\+swkq-[ucosr]-[a-f0-9]{24}@gmail\.com$/);
    assert.ok(email.split('@')[0].length<=64);
  }
});
test('staging QA retains isolated example.invalid identities',()=>{
  assert.equal(syntheticQaEmail({role:'user',run,staging:true}),`qa-user-${run}@example.invalid`);
});
test('run IDs change synthetic email addresses and guard malformed values',()=>{
  const base='sewak.qa2026@gmail.com';
  const first=syntheticQaEmail({role:'user',run,gmailBase:base});
  const second=syntheticQaEmail({role:'user',run:'a1b2c3d4-e5f6-4758-9234-0123456789ac',gmailBase:base});
  assert.notEqual(first,second);
  assert.throws(()=>syntheticQaEmail({role:'not-a-role',run,gmailBase:base}));
  assert.throws(()=>syntheticQaEmail({role:'user',run:'not-uuid',gmailBase:base}));
});
