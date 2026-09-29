import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {openTarget} from '../../scripts/d1-target.mjs';

test('remote operator batches keep each statement and its own parameter array',async()=>{
 const priorFetch=globalThis.fetch,priorAccount=process.env.CLOUDFLARE_ACCOUNT_ID,priorToken=process.env.CLOUDFLARE_API_TOKEN;let sent;
 try{
  process.env.CLOUDFLARE_ACCOUNT_ID='unit-test-account';process.env.CLOUDFLARE_API_TOKEN='unit-test-only';globalThis.fetch=async(_url,options)=>{sent=JSON.parse(options.body);return Response.json({success:true,result:[{success:true},{success:true}]});};
  const target=await openTarget({remote:true,mainId:'unit-main',mediaId:'unit-media'});
  await target.DB.batch([target.DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind('synthetic-id'),target.DB.prepare('DELETE FROM users WHERE id=? AND email=?').bind('synthetic-id','test@example.invalid')]);
  assert.deepEqual(sent,{batch:[{sql:'DELETE FROM cf_sessions WHERE user_id=?',params:['synthetic-id']},{sql:'DELETE FROM users WHERE id=? AND email=?',params:['synthetic-id','test@example.invalid']}]});
 }finally{globalThis.fetch=priorFetch;if(priorAccount===undefined)delete process.env.CLOUDFLARE_ACCOUNT_ID;else process.env.CLOUDFLARE_ACCOUNT_ID=priorAccount;if(priorToken===undefined)delete process.env.CLOUDFLARE_API_TOKEN;else process.env.CLOUDFLARE_API_TOKEN=priorToken;}
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
  assert.equal(maintenance.status,1);assert.match(maintenance.stderr,/Freeze old structured-data writes/);
 }finally{unlinkSync(config);rmdirSync(directory);}
});
