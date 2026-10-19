import test from 'node:test';import assert from 'node:assert/strict';
import {environment,seed,call} from './harness.mjs';

test('approved caregiver application notifies only the job owner',async()=>{
 const env=environment();await seed(env);
 const posted=await call(env,'/api/care-jobs',{uid:'customer',method:'POST',json:{
  title:'Afternoon household care',description:'Seeking reliable afternoon help with daily home routines.',
  category:'household',city:'Hetauda',schedule:'flexible',hourlyBudget:null}});
 assert.equal(posted.status,200,JSON.stringify(posted.data));
 const applied=await call(env,'/api/care-jobs/'+posted.data.id+'/apply',{uid:'caregiver',method:'POST',json:{message:'I can provide thoughtful afternoon household care and have relevant experience.'}});
 assert.equal(applied.status,200,JSON.stringify(applied.data));
 const owner=await call(env,'/api/care-notifications',{uid:'customer'});
 assert.equal(owner.data.unread,1);
 assert.equal(owner.data.items[0].eventType,'care-job-applied');
 assert.equal((await call(env,'/api/care-notifications',{uid:'other'})).data.unread,0);
});
