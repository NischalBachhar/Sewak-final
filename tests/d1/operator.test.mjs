import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {openTarget} from '../../scripts/d1-target.mjs';
import {assertDeploymentConfig,assertLiveBindings,SEWAK_ACCOUNT} from '../../scripts/deployment-policy.mjs';

test('remote operator batches keep each statement and its own parameter array',async()=>{
 const priorFetch=globalThis.fetch,priorAccount=process.env.CLOUDFLARE_ACCOUNT_ID,priorToken=process.env.CLOUDFLARE_API_TOKEN;let sent;
 try{
  process.env.CLOUDFLARE_ACCOUNT_ID='unit-test-account';process.env.CLOUDFLARE_API_TOKEN='unit-test-only';globalThis.fetch=async(_url,options)=>{sent=JSON.parse(options.body);return Response.json({success:true,result:[{success:true},{success:true}]});};
  const target=await openTarget({remote:true,mainId:'unit-main',mediaId:'unit-media'});
  await target.DB.batch([target.DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind('synthetic-id'),target.DB.prepare('DELETE FROM users WHERE id=? AND email=?').bind('synthetic-id','test@example.invalid')]);
  assert.deepEqual(sent,{batch:[{sql:'DELETE FROM cf_sessions WHERE user_id=?',params:['synthetic-id']},{sql:'DELETE FROM users WHERE id=? AND email=?',params:['synthetic-id','test@example.invalid']}]});
 }finally{globalThis.fetch=priorFetch;if(priorAccount===undefined)delete process.env.CLOUDFLARE_ACCOUNT_ID;else process.env.CLOUDFLARE_ACCOUNT_ID=priorAccount;if(priorToken===undefined)delete process.env.CLOUDFLARE_API_TOKEN;else process.env.CLOUDFLARE_API_TOKEN=priorToken;}
});

test('deployment rejects renamed staging config, swapped DBs, audiences and CI overrides',()=>{
 const env={CLOUDFLARE_ACCOUNT_ID:SEWAK_ACCOUNT},read=name=>readFileSync(new URL('../../'+name,import.meta.url),'utf8');
 const staging=read('wrangler.toml'),production=read('wrangler.production.toml');
 assert.doesNotThrow(()=>assertDeploymentConfig('sewak',staging,env));assert.doesNotThrow(()=>assertDeploymentConfig('sewak-final',production,env));
 assert.throws(()=>assertDeploymentConfig('sewak-final',staging.replace('name = "sewak"','name = "sewak-final"'),env),/audience/);
 assert.throws(()=>assertDeploymentConfig('sewak-final',production.replace('36fa1df1-aa5d-43a1-ad0e-a4e310c513c3','764b3560-fc46-4273-9026-f049941ab4c3'),env),/database ID/);
 assert.throws(()=>assertDeploymentConfig('sewak-final',production.replace('sewak-production','sewak-staging'),env),/audience/);
 for(const overrides of [{WRANGLER_CI_OVERRIDE_NAME:'sewak-final'},{WORKERS_CI:'1'},{CLOUDFLARE_ENV:'production'}])assert.throws(()=>assertDeploymentConfig('sewak',staging,{...env,...overrides}));
 assert.throws(()=>assertLiveBindings('sewak-final',[{name:'DB',id:'764b3560-fc46-4273-9026-f049941ab4c3'}],false),/live database mismatch/);
});

test('unguarded Wrangler and connected-build entry points fail before deployment',()=>{
 const env={...process.env};delete env.SEWAK_REVIEWED_TARGET;
 const raw=spawnSync(process.execPath,['scripts/check-worker-entry.mjs','sewak'],{encoding:'utf8',env});assert.notEqual(raw.status,0);assert.match(raw.stderr,/direct Wrangler deployment is disabled/);
 const ci=spawnSync(process.execPath,['scripts/check-build-ci.cjs'],{encoding:'utf8',env:{...env,WORKERS_CI:'1',WRANGLER_CI_OVERRIDE_NAME:'sewak-final'}});assert.notEqual(ci.status,0);assert.match(ci.stderr,/Automatic Workers Builds are disabled/);
 const override=spawnSync(process.execPath,['scripts/deploy-worker.mjs','--name','sewak-final'],{encoding:'utf8',env});assert.notEqual(override.status,0);assert.match(override.stderr,/Unsupported deploy override/);
});

test('read-only staging cannot overwrite the existing production frontend',()=>{
 const directory=mkdtempSync(join(tmpdir(),'sewak-operator-test-'));
 const config=join(directory,'wrangler.toml');
 try{
  writeFileSync(config,'name = "sewak"\naccount_id = "860970f755498a4fe10e16c2fa99ce55"\n[vars]\nAPP_WRITES_ENABLED = "false"\n');
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../../scripts/deploy-worker.mjs',import.meta.url)),'--worker','sewak-final'],{cwd:directory,encoding:'utf8',env:{...process.env,CLOUDFLARE_ACCOUNT_ID:'860970f755498a4fe10e16c2fa99ce55'}});
  assert.equal(result.status,1);
  assert.match(result.stderr,/Keep the existing production frontend in place during staging/);
  const maintenance=spawnSync(process.execPath,[fileURLToPath(new URL('../../scripts/deploy-worker.mjs',import.meta.url)),'--worker','sewak-final','--cutover-maintenance'],{cwd:directory,encoding:'utf8',env:{...process.env,CLOUDFLARE_ACCOUNT_ID:'860970f755498a4fe10e16c2fa99ce55'}});
  assert.equal(maintenance.status,1);assert.match(maintenance.stderr,/Cloudflare D1 validation/);
 }finally{unlinkSync(config);rmdirSync(directory);}
});
