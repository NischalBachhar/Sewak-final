import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,seed,call,booking} from './harness.mjs';

test('weekly windows restrict booking searches, protect other accounts and can be removed',async()=>{
 const env=environment();await seed(env);
 const day='2090-01-01',weekday=new Date(day+'T00:00:00Z').getUTCDay();
 const input={action:'weekly-add',weekday,start:'09:00',end:'17:00'};
 const add=await call(env,'/api/care-schedule',{uid:'caregiver',method:'POST',json:input});
 assert.equal(add.status,200,JSON.stringify(add.data));
 const list=(await call(env,'/api/care-schedule',{uid:'caregiver'})).data.weeklyHours;
 assert.equal(list.length,1);assert.equal(list[0].weekday,weekday);
 const check=(date,time,hours)=>'/api/care-schedule?caregiverId=caregiver&day='+date+'&time='+time+'&hours='+hours;
 assert.equal((await call(env,check(day,'10:00',4),{uid:'customer'})).data.available,true);
 assert.equal((await call(env,check(day,'16:00',2),{uid:'customer'})).data.available,false);
 assert.equal((await call(env,check('2090-01-02','10:00',2),{uid:'customer'})).data.available,false);
 assert.equal((await call(env,'/api/care-schedule',{uid:'customer',method:'POST',json:{action:'weekly-remove',id:list[0].id}})).status,403);
 const created=await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[booking()]}});
 assert.equal(created.status,200,JSON.stringify(created.data));
 const removed=await call(env,'/api/care-schedule',{uid:'caregiver',method:'POST',json:{action:'weekly-remove',id:list[0].id}});
 assert.equal(removed.status,200);
 assert.equal((await call(env,check('2090-01-02','10:00',2),{uid:'customer'})).data.available,true);
});
test('weekly hours are validated in the same atomic transaction as booking requests',async()=>{
 const env=environment();await seed(env);
 const day='2090-01-01',weekday=new Date(day+'T00:00:00Z').getUTCDay();
 const set=await call(env,'/api/care-schedule',{uid:'caregiver',method:'POST',json:{action:'weekly-add',weekday,start:'15:00',end:'17:00'}});
 assert.equal(set.status,200,JSON.stringify(set.data));
 const result=await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[booking()]}});
 assert.equal(result.status,409,JSON.stringify(result.data));
 assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM bookings').first()).count,0);
 assert.equal((await call(env,'/api/care-notifications',{uid:'customer'})).data.items.length,0);
});
