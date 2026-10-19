import test from 'node:test';import assert from 'node:assert/strict';
import {environment,seed,call} from './harness.mjs';
const post={title:'Overnight household support',description:'Seeking a trustworthy helper for household routines.',category:'household',city:'Hetauda',schedule:'flexible',hourlyBudget:null};
test('conversation stays private to job owner and the actual applicant',async()=>{
 const env=environment();await seed(env);
 const created=await call(env,'/api/care-jobs',{uid:'customer',method:'POST',json:post});assert.equal(created.status,200,JSON.stringify(created.data));
 const id=created.data.id;
 const waiting=await call(env,'/api/care-messages?kind=job&contextId='+id+'&caregiverId=caregiver',{uid:'customer'});assert.equal(waiting.status,404);
 const applied=await call(env,'/api/care-jobs/'+id+'/apply',{uid:'caregiver',method:'POST',json:{message:'I am available and can support household needs every evening.'}});assert.equal(applied.status,200);
 const payload={kind:'job',contextId:id,caregiverId:'caregiver',body:'What time would you prefer to begin?'};
 const sent=await call(env,'/api/care-messages',{uid:'customer',method:'POST',json:payload});assert.equal(sent.status,200,JSON.stringify(sent.data));
 const viewed=await call(env,'/api/care-messages?kind=job&contextId='+id+'&caregiverId=caregiver',{uid:'caregiver'});
 assert.equal(viewed.status,200);assert.equal(viewed.data.messages.length,1);assert.equal(viewed.data.messages[0].body,payload.body);
 const wrong=await call(env,'/api/care-messages?kind=job&contextId='+id+'&caregiverId=caregiver',{uid:'other'});
 assert.equal(wrong.status,404);
 assert.equal((await call(env,'/api/care-messages',{method:'POST',json:payload})).status,401);
 assert.equal((await call(env,'/api/care-messages',{uid:'other',method:'POST',json:payload})).status,404);
 const withdrawn=await call(env,'/api/care-jobs/'+id+'/withdraw',{uid:'caregiver',method:'POST',json:{}});
 assert.equal(withdrawn.status,200);
 assert.equal((await call(env,'/api/care-messages?kind=job&contextId='+id+'&caregiverId=caregiver',{uid:'customer'})).status,404);
});
test('rejects overlong messages and unverified context IDs',async()=>{
 const env=environment();await seed(env);
 const result=await call(env,'/api/care-messages',{uid:'customer',method:'POST',json:{kind:'job',contextId:'../wrong',caregiverId:'caregiver',body:'hello'}});
 assert.equal(result.status,400);
});

test('an application withdrawn during message submission cannot receive a message or notification',async()=>{
 const env=environment();await seed(env);
 const created=await call(env,'/api/care-jobs',{uid:'customer',method:'POST',json:post});
 const id=created.data.id;
 assert.equal((await call(env,'/api/care-jobs/'+id+'/apply',{uid:'caregiver',method:'POST',json:{message:'Synthetic caregiver application for this care request.'}})).status,200);
 const batch=env.DB.batch.bind(env.DB);
 env.DB.batch=async statements=>{
   await env.DB.prepare("UPDATE care_job_applications SET status='withdrawn' WHERE job_id=? AND caregiver_id=?").bind(id,'caregiver').run();
   return batch(statements);
 };
 const result=await call(env,'/api/care-messages',{uid:'customer',method:'POST',json:{kind:'job',contextId:id,caregiverId:'caregiver',body:'Synthetic concurrent message'}});
 assert.equal(result.status,409);
 assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM care_messages').first()).n,0);
 assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM care_notifications WHERE event_type='care-message'").first()).n,0);
});
