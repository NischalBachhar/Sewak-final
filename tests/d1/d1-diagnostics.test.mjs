import test from 'node:test';
import assert from 'node:assert/strict';
import { traceD1, safeD1Category } from '../../worker/src/d1-diagnostics.ts';
import { environment } from './harness.mjs';
import { createWorker } from '../../worker/src/index.ts';

test('diagnostic logs only a fixed stage and classified code, not private error details',async()=>{
  const secret='user.person@example.com-PRIVATE-PASSWORD-swK';
  const old=console.error,events=[];
  console.error=(...args)=>events.push(args);
  const reason=new Error('D1_ERROR: no such column: '+secret);
  try {
    await assert.rejects(traceD1('auth.login.credentials',async()=>{throw reason}),e=>e===reason);
    assert.equal(events.length,1);
    assert.equal(events[0][0],'Sewak DB operation failed');
    assert.deepEqual(events[0][1],{stage:'auth.login.credentials',category:'sql-schema'});
    assert.ok(!JSON.stringify(events).includes(secret));
  } finally {console.error=old;}
});
test('arbitrary stage and SQL payload strings are never logged',async()=>{
  const old=console.error,events=[];
  console.error=(...args)=>events.push(args);
  try {
    await assert.rejects(traceD1('secret-user-unique-token',async()=>{throw Error('D1_ERROR: SQL SELECT private_email')}));
    assert.deepEqual(events[0][1],{stage:'unknown-stage',category:'d1-other'});
    assert.ok(!JSON.stringify(events).includes('private_email'));
    assert.ok(!JSON.stringify(events).includes('secret-user-unique-token'));
  } finally {console.error=old;}
});
test('error categories are finite; no raw SQL or credential data are surfaced',()=>{
  for(const [raw,category] of [
    ['D1_ERROR: SQLITE_FULL: quota exceeded','resource-limit'],
    ['D1_ERROR: no such column foo@example.com','sql-schema'],
    ['D1_ERROR: UNIQUE constraint failed: users.email','constraint'],
    ['D1_ERROR: SQLITE_BUSY database is locked','db-contention'],
    ['Cloudflare 7403 not authorized','access-denied'],
    ['D1_ERROR: other opaque issue','d1-other'],
    ['secret only','unclassified'],
  ]) assert.equal(safeD1Category(new Error(raw)),category);
});
test('healthy D1 calls do not emit logs or change result',async()=>{
  const old=console.error,events=[];console.error=(...args)=>events.push(args);
  try {assert.equal(await traceD1('auth.session.lookup',async()=>42),42);assert.equal(events.length,0);}
  finally {console.error=old;}
});
test('failed real login rate upsert logs the exact fixed SQL stage and still returns generic HTTP error',async()=>{
  const env=environment();
  const original=env.DB.prepare.bind(env.DB);
  env.DB.prepare=(sql)=>{
    if(sql.startsWith('INSERT INTO cf_auth_limits(bucket,hits')) return {bind:()=>({first:async()=>{throw Error('D1_ERROR: no such column never-log@example.test')}})};
    return original(sql);
  };
  const events=[],log=console.error;console.error=(...args)=>events.push(args);
  try {
    const response=await createWorker().fetch(new Request('https://sewak.test/auth/login',{
      method:'POST',headers:{'Content-Type':'application/json',Origin:'https://sewak.test'},
      body:JSON.stringify({email:'test@example.test',password:'Synthetic-password-123!',sessionMode:'cookie'})
    }),env);
    assert.equal(response.status,503);
    assert.equal((await response.json()).error.code,'unavailable');
    assert.ok(events.some(x=>x[1]?.stage==='auth.rate.ip-upsert'&&x[1]?.category==='sql-schema'));
    assert.ok(!JSON.stringify(events).includes('never-log@example.test'));
    assert.ok(!JSON.stringify(events).includes('Synthetic-password-123!'));
  } finally {console.error=log;}
});
