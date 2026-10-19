import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,seed,put} from './harness.mjs';
import {scheduledBookingReminders} from '../../worker/src/notifications.ts';

test('cron issues private, idempotent upcoming care reminders to both participants only',async()=>{
 const env=environment();await seed(env);
 const now=new Date(),scheduled=new Date(now.getTime()+2*3600000).toISOString();
 await put(env,'bookings/next123',{userId:'customer',caregiverId:'caregiver',organizationId:'org',status:'accepted',
   date:scheduled.slice(0,10),time:'12:00',scheduleAt:scheduled,durationHours:2,paymentMethod:'cash'});
 await scheduledBookingReminders(env); await scheduledBookingReminders(env);
 const rows=await env.DB.prepare("SELECT recipient_id AS recipientId,title,body FROM care_notifications WHERE event_type='booking-reminder'").all();
 assert.equal(rows.results.length,2);
 assert.deepEqual(rows.results.map(x=>x.recipientId).sort(),['caregiver','customer']);
 assert.ok(rows.results.every(x=>!x.body.includes('private')&&!x.body.includes('customer@example')));
 env.APP_WRITES_ENABLED='false';await scheduledBookingReminders(env);
 assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM care_notifications WHERE event_type='booking-reminder'").first()).n,2);
});
