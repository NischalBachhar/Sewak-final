import assert from 'node:assert/strict';
import {targets,SEWAK_ACCOUNT} from './deployment-policy.mjs';
export async function assertVerificationReady(worker,cloudflare){
 const target=targets[worker];assert.ok(target,'Unknown release target');
 const settings=await cloudflare(`/accounts/${SEWAK_ACCOUNT}/workers/scripts/${worker}/settings`);
 assert.equal(settings.bindings.filter(b=>b.name==='VERIFICATION_ENCRYPTION_KEY'&&b.type==='secret_text').length,1,'Configure the dedicated verification encryption secret before deployment');
 for(const [binding,required]of [['DB',['verification_records','verification_submissions','verification_evidence','verification_decisions','verification_audit','verification_notifications','verification_public_status']],['EVIDENCE_DB',['evidence_blobs','evidence_capacity','evidence_tombstones','evidence_no_resurrection','evidence_capacity_insert','evidence_capacity_delete','evidence_immutable']]]){
  const result=await cloudflare(`/accounts/${SEWAK_ACCOUNT}/d1/database/${target[binding][1]}/query`,{method:'POST',json:{sql:'SELECT name FROM sqlite_master WHERE name IN ('+required.map(()=>'?').join(',')+')',params:required}});
  assert.equal(result[0]?.success,true,binding+' schema query failed');
  assert.deepEqual(result[0].results.map(r=>r.name).sort(),[...required].sort(),binding+' verification schema is incomplete');
 }
 return {secretPresent:true,schemaReady:true};
}
