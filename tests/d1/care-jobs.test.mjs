import test from 'node:test';import assert from 'node:assert/strict';
import {environment,seed,call} from './harness.mjs';
const data={title:'Evening senior care needed',description:'Seeking reliable evening help with everyday care at home.',category:'caregiver',city:'Hetauda',schedule:'recurring',hourlyBudget:500};
test('family posts job, caregiver applies and family alone sees applicants',async()=>{
 const env=environment();await seed(env);
 assert.equal((await call(env,'/api/care-jobs',{method:'POST',json:data})).status,401);
 assert.equal((await call(env,'/api/care-jobs',{uid:'caregiver',method:'POST',json:data})).status,403);
 const created=await call(env,'/api/care-jobs',{uid:'customer',method:'POST',json:data});assert.equal(created.status,200,JSON.stringify(created.data));
 const id=created.data.id;
 assert.equal((await call(env,'/api/care-jobs',{uid:'customer'})).data.jobs.length,1);
 const feed=await call(env,'/api/care-jobs',{uid:'caregiver'});
 assert.equal(feed.data.jobs.length,1);assert.equal(feed.data.jobs[0].customerId,undefined);
 const applied=await call(env,'/api/care-jobs/'+id+'/apply',{uid:'caregiver',method:'POST',json:{message:'I have experience in providing safe and caring home support.'}});
 assert.equal(applied.status,200,JSON.stringify(applied.data));
 assert.equal((await call(env,'/api/care-jobs/'+id+'/apply',{uid:'caregiver',method:'POST',json:{message:'I have experience in providing safe and caring home support.'}})).status,409);
 assert.equal((await call(env,'/api/care-jobs/'+id+'/applications',{uid:'other'})).status,403);
 assert.equal((await call(env,'/api/care-jobs/'+id+'/applications',{uid:'customer'})).data.applications.length,1);
 assert.equal((await call(env,'/api/care-jobs/'+id+'/withdraw',{uid:'caregiver',method:'POST',json:{}})).status,200);
 assert.equal((await call(env,'/api/care-jobs/'+id+'/close',{uid:'customer',method:'POST',json:{}})).status,200);
 assert.equal((await call(env,'/api/care-jobs',{uid:'caregiver'})).data.jobs.length,0);
});
test('job description rejects exposed private contact information',async()=>{
 const env=environment();await seed(env);
 const result=await call(env,'/api/care-jobs',{uid:'customer',method:'POST',json:{...data,description:'Contact 9841234567 about this care opportunity.'}});
 assert.equal(result.status,400);
});
