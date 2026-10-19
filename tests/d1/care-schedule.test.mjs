import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,seed,call,booking} from './harness.mjs';

test('caregiver can block a slot; families cannot book it; only owner can remove the block',async()=>{
 const env=environment();await seed(env);
 const day=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 const add=await call(env,'/api/care-schedule',{uid:'caregiver',method:'POST',
  json:{action:'block',day,start:'09:00',end:'17:00'}});
 assert.equal(add.status,200,JSON.stringify(add.data));
 assert.equal((await call(env,'/api/care-schedule',{uid:'caregiver'})).data.blocks.length,1);
 const check=await call(env,'/api/care-schedule?caregiverId=caregiver&day='+day+'&time=10:00&hours=4',{uid:'customer'});
 assert.equal(check.status,200,JSON.stringify(check.data));assert.equal(check.data.available,false);
 assert.equal((await call(env,'/api/care-schedule',{uid:'customer'})).status,403);
 assert.equal((await call(env,'/api/care-schedule',{uid:'other',method:'POST',json:{action:'unblock',id:add.data.id}})).status,403);
 const remove=await call(env,'/api/care-schedule',{uid:'caregiver',method:'POST',json:{action:'unblock',id:add.data.id}});
 assert.equal(remove.status,200);
 assert.equal((await call(env,'/api/care-schedule?caregiverId=caregiver&day=2090-01-01&time=10:00&hours=4',{uid:'customer'})).data.available,true);
 // A past/far-future test fixture can still exercise the atomic booking guard.
 await env.DB.prepare('INSERT INTO caregiver_time_off(id,caregiver_id,day,start_min,end_min,created_at) VALUES(?,?,?,?,?,?)').bind('fixture','caregiver','2090-01-01',540,1020,new Date().toISOString()).run();
 const blocked=await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[booking()]}});
 assert.equal(blocked.status,409,JSON.stringify(blocked.data));
 await env.DB.prepare('DELETE FROM caregiver_time_off WHERE id=?').bind('fixture').run();
 assert.equal((await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[booking()]}})).status,200);
});

test('an unavailability block prevents later acceptance, not only new requests',async()=>{
 const env=environment();await seed(env);
 const request=booking();
 const created=await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[request]}});
 assert.equal(created.status,200,JSON.stringify(created.data));
 // A new block is permissible before caregiver acceptance, but acceptance itself
 // must fail against the block under the same D1 commit guard.
 await env.DB.prepare('INSERT INTO caregiver_time_off(id,caregiver_id,day,start_min,end_min,created_at) VALUES(?,?,?,?,?,?)')
  .bind('blocked-fixture','caregiver','2090-01-01',540,1020,new Date().toISOString()).run();
 const decision=await call(env,'/api/commit',{uid:'caregiver',method:'POST',json:{writes:[{
  path:request.path,kind:'update',data:{status:'accepted',updatedAt:{__op:'serverTimestamp'}},
 }]}});
 assert.equal(decision.status,409,JSON.stringify(decision.data));
 const saved=await env.DB.prepare('SELECT status FROM bookings WHERE id=?').bind(request.path.split('/')[1]).first();
 assert.equal(saved.status,'pending');
 assert.equal((await call(env,'/api/care-notifications',{uid:'customer'})).data.items.filter(x=>x.eventType==='booking-accepted').length,0);
});
