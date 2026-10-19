import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,seed,put,call,booking} from './harness.mjs';
import {scheduledBookingReminders} from '../../worker/src/notifications.ts';
import {nepalDay} from '../../worker/src/nepal-time.ts';

test('recipient reminder preferences persist without muting essential booking updates or another user',async()=>{
 const env=environment();await seed(env);
 assert.equal((await call(env,'/api/care-notifications',{uid:'customer'})).data.preferences.bookingReminders,true);
 const change=await call(env,'/api/care-notifications',{uid:'customer',method:'POST',json:{action:'preferences',bookingReminders:false}});
 assert.equal(change.status,200,JSON.stringify(change.data));
 assert.equal((await call(env,'/api/care-notifications',{uid:'customer'})).data.preferences.bookingReminders,false);
 assert.equal((await call(env,'/api/care-notifications',{uid:'caregiver'})).data.preferences.bookingReminders,true);
 assert.equal((await call(env,'/api/care-notifications',{uid:'other',method:'POST',json:{action:'preferences',bookingReminders:false,userId:'customer'}})).status,400);
 assert.equal((await call(env,'/api/care-notifications',{uid:'customer',method:'POST',json:{action:'preferences',bookingReminders:'false'}})).status,400);
 assert.equal((await call(env,'/api/care-notifications',{method:'POST',json:{action:'preferences',bookingReminders:false}})).status,401);
 assert.equal((await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[booking()]}})).status,200);
 assert.equal((await call(env,'/api/care-notifications',{uid:'customer'})).data.unread,1);
 const scheduleAt=new Date(Date.now()+7200000).toISOString();
 await put(env,'bookings/preference-reminder',{userId:'customer',caregiverId:'caregiver',status:'accepted',scheduleAt,date:scheduleAt.slice(0,10),time:'12:00',durationHours:1});
 await scheduledBookingReminders(env);
 const rows=await env.DB.prepare("SELECT recipient_id FROM care_notifications WHERE event_type='booking-reminder'").all();
 assert.deepEqual(rows.results.map(r=>r.recipient_id),['caregiver']);
 env.APP_WRITES_ENABLED='false';
 assert.equal((await call(env,'/api/care-notifications',{uid:'customer',method:'POST',json:{action:'preferences',bookingReminders:true}})).status,503);
});

test('Nepal schedule day changes at 18:15 UTC regardless of the server timezone',()=>{
 assert.equal(nepalDay(new Date('2026-10-19T18:14:59Z')),'2026-10-19');
 assert.equal(nepalDay(new Date('2026-10-19T18:15:00Z')),'2026-10-20');
 assert.equal(nepalDay(new Date('2026-12-31T18:15:00Z')),'2027-01-01');
});
