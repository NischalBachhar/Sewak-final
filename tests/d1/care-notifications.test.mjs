import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,seed,call,booking} from './harness.mjs';

test('new booking atomically delivers customer receipt, caregiver request and team notification',async()=>{
 const env=environment();await seed(env);
 const created=await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[booking()]}});
 assert.equal(created.status,200,JSON.stringify(created.data));
 const customer=await call(env,'/api/care-notifications',{uid:'customer'});
 const caregiver=await call(env,'/api/care-notifications',{uid:'caregiver'});
 const org=await call(env,'/api/care-notifications',{uid:'org'});
 assert.equal(customer.status,200);
 assert.equal(caregiver.status,200);
 assert.equal(customer.data.unread,1);assert.equal(caregiver.data.unread,1);
 assert.equal(org.data.unread,1);
 assert.equal(customer.data.items[0].eventType,'booking-received');
 assert.equal(caregiver.data.items[0].eventType,'booking-requested');
 assert.equal(customer.data.items[0].link.startsWith('/user/bookings/'),true);
 const id=caregiver.data.items[0].id;
 assert.equal((await call(env,'/api/care-notifications',{uid:'other'})).data.unread,0);
 assert.equal((await call(env,'/api/care-notifications',{uid:'other',method:'POST',json:{action:'read',id}})).status,200);
 assert.equal((await call(env,'/api/care-notifications',{uid:'caregiver'})).data.unread,1);
 assert.equal((await call(env,'/api/care-notifications',{uid:'caregiver',method:'POST',json:{action:'read',id}})).status,200);
 assert.equal((await call(env,'/api/care-notifications',{uid:'caregiver'})).data.unread,0);
 assert.equal((await call(env,'/api/care-notifications',{uid:'customer',method:'POST',json:{action:'read-all'}})).status,200);
 assert.equal((await call(env,'/api/care-notifications',{uid:'customer'})).data.unread,0);
 assert.equal((await call(env,'/api/care-notifications')).status,401);
});
test('failed booking never emits phantom notifications',async()=>{
 const env=environment();await seed(env);
 const input=booking();input.data.caregiverId='nonexistent';
 const result=await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[input]}});
 assert.notEqual(result.status,200);
 assert.equal((await call(env,'/api/care-notifications',{uid:'customer'})).data.unread,0);
});
