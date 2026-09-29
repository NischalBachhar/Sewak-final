import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readOnlyRules,assertNoDeployedFunctions,verifySourceWriters} from '../../scripts/firebase-to-d1/freeze.mjs';
test('maintenance rules retain original read conditions while removing every write grant',()=>{
 for(const file of ['firestore.rules','storage.rules']){
  const source=readFileSync(file,'utf8'),frozen=readOnlyRules(source);
  assert.ok(frozen.includes('allow write: if false;'));
  assert.doesNotMatch(frozen,/allow\s+(create|update|delete):/);
  const reads=source.match(/allow (read|get|list):[^;]+;/g)||[];
  for(const read of reads)assert.ok(frozen.includes(read));
 }
 assert.match(readOnlyRules('allow read, write: if request.auth != null;'),/allow read: if request.auth != null;/);
});
test('source freeze rejects partial or failed Functions inventory',()=>{
 for(const listing of [{functions:[{name:'writer'}]},{nextPageToken:'more'},{unreachable:['asia-south1']},{error:{code:403}},null,[],{functions:{}},{unreachable:'unknown'}])assert.throws(()=>assertNoDeployedFunctions(listing));
 assert.doesNotThrow(()=>assertNoDeployedFunctions({}));
 assert.doesNotThrow(()=>assertNoDeployedFunctions({functions:[],unreachable:[]}));
});
test('disabled Functions require owner confirmation and independent service/billing evidence',async()=>{
 const disabled=Object.assign(new Error('disabled'),{status:403,reason:'SERVICE_DISABLED',service:'cloudfunctions.googleapis.com'});
 const read=({state='DISABLED',billingEnabled=false,error=disabled}={})=>async url=>{
  if(url.startsWith('https://cloudfunctions.'))throw error;
  if(url.startsWith('https://serviceusage.'))return {state};
  if(url.startsWith('https://cloudbilling.'))return {billingEnabled};
  throw new Error('Unexpected request');
 };
 await assert.rejects(verifySourceWriters('care-53593',{google:read()}),/Confirm/);
 for(const google of [read({state:'ENABLED'}),read({billingEnabled:true}),read({error:Object.assign(new Error('permission'),{status:403,reason:'IAM_PERMISSION_DENIED'})}),async()=>({unreachable:['asia-south1']})])await assert.rejects(verifySourceWriters('care-53593',{google,noServerWritersConfirmed:true}));
 const result=await verifySourceWriters('care-53593',{google:read(),noServerWritersConfirmed:true});
 assert.equal(result.billingEnabled,false);assert.equal(result.functionsApi,'DISABLED');assert.equal(result.noServerWritersConfirmed,true);
 const listed=await verifySourceWriters('care-53593',{google:async()=>({functions:[]}),noServerWritersConfirmed:true});
 assert.equal(listed.verification,'functions-inventory-and-owner-confirmation');
});
