import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,seed,call,booking} from './harness.mjs';

test('caregiver can block a slot; families cannot book it; only owner can remove the block',async()=>{
 const env=environment();await seed(env);
 const add=await call(env,'/api/care-schedule',{uid:'caregiver',method:'POST',
  json:{action:'block',day:'2090-01-01',start:'09:00',end:'17:00'}});
 assert.equal(add.status,200,JSON.stringify(add.data));
 assert.equal((await call(env,'/api/care-schedule',{uid:'caregiver'})).data.blocks.length,1);
 const check=await call(env,'/api/care-schedule?caregiverId=caregiver&day=2090-01-01&time=10:00&hours=4',{uid:'customer'});
 assert.equal(check.status,200,JSON.stringify(check.data));assert.equal(check.data.available,false);
 assert.equal((await call(env,'/api/care-schedule',{uid:'customer'})).status,403);
 assert.equal((await call(env,'/api/care-schedule',{uid:'other',method:'POST',json:{action:'unblock',id:add.data.id}})).status,403);
 const attempt=await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[booking()]}});
 assert.equal(attempt.status,409,JSON.stringify(attempt.data));
 const remove=await call(env,'/api/care-schedule',{uid:'caregiver',method:'POST',json:{action:'unblock',id:add.data.id}});
 assert.equal(remove.status,200);
 assert.equal((await call(env,'/api/care-schedule?caregiverId=caregiver&day=2090-01-01&time=10:00&hours=4',{uid:'customer'})).data.available,true);
 assert.equal((await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[booking()]}})).status,200);
});
