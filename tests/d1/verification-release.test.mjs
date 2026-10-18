import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {targets,SEWAK_ACCOUNT,assertDeploymentConfig,assertLiveBindings} from '../../scripts/deployment-policy.mjs';
import {assertVerificationReady} from '../../scripts/verification-release-readiness.mjs';
test('verification release pins distinct evidence databases and requires the live binding after deployment',()=>{
 for(const worker of ['sewak','sewak-final']){
  const target=targets[worker],config=readFileSync(target.config,'utf8'),env={CLOUDFLARE_ACCOUNT_ID:SEWAK_ACCOUNT};
  assertDeploymentConfig(worker,config,env);
  assert.throws(()=>assertDeploymentConfig(worker,config.replace(target.EVIDENCE_DB[1],target.DB[1]),env),/database ID/);
  const bindings=['DB','MEDIA_DB','EVIDENCE_DB'].map(name=>({type:'d1',name,id:target[name][1]}));
  bindings.push({name:'AUTH_AUDIENCE',text:target.audience},{name:'APP_WRITES_ENABLED',text:String(worker==='sewak-final')});
  assertLiveBindings(worker,bindings,worker==='sewak-final',{requireEvidence:true});
  assert.throws(()=>assertLiveBindings(worker,bindings.filter(b=>b.name!=='EVIDENCE_DB'),worker==='sewak-final',{requireEvidence:true}));
  assert.throws(()=>assertLiveBindings(worker,[...bindings,{name:'UNREVIEWED',type:'d1',id:'other'}],worker==='sewak-final',{requireEvidence:true}));
 }
 assert.notEqual(targets.sewak.EVIDENCE_DB[1],targets['sewak-final'].EVIDENCE_DB[1]);
});
test('verification readiness rejects missing secrets and incomplete schema before upload',async()=>{
 const api=async(path,options)=>path.endsWith('/settings')?{bindings:[{name:'VERIFICATION_ENCRYPTION_KEY',type:'secret_text'}]}:[{success:true,results:options.json.params.map(name=>({name}))}];
 assert.deepEqual(await assertVerificationReady('sewak-final',api),{secretPresent:true,schemaReady:true});
 await assert.rejects(()=>assertVerificationReady('sewak-final',async(path,options)=>path.endsWith('/settings')?{bindings:[]}:api(path,options)),/encryption secret/);
 await assert.rejects(()=>assertVerificationReady('sewak-final',async(path,options)=>path.endsWith('/settings')?api(path,options):[{success:true,results:[]}]),/schema is incomplete/);
});
