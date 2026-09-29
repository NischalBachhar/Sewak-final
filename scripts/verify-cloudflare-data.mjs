// Cloudflare is authoritative. No source-system credentials or comparisons.
import assert from 'node:assert/strict';import {writeFileSync,mkdirSync} from 'node:fs';
import {cloudflare} from './cloudflare-operator.mjs';import {openTarget} from './d1-target.mjs';import {SEWAK_ACCOUNT,targets,assertLiveBindings} from './deployment-policy.mjs';
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,SEWAK_ACCOUNT);
const worker='sewak-final',root=`/accounts/${SEWAK_ACCOUNT}/workers/scripts/${worker}`,health=await(await fetch(`https://${worker}.nischalbachhar9.workers.dev/api/health`)).json();assert.equal(health.healthy,true);assert.equal(health.auth,'cloudflare-d1');
assertLiveBindings(worker,(await cloudflare(root+'/settings')).bindings,health.writesEnabled);
const deployment=(await cloudflare(root+'/deployments')).deployments[0];assert.equal(deployment.versions.length,1);assert.equal(deployment.versions[0].percentage,100);const version=deployment.versions[0].version_id;assertLiveBindings(worker,(await cloudflare(root+'/versions/'+version)).resources.bindings,health.writesEnabled);
const target=await openTarget({remote:true,mainId:targets[worker].DB[1],mediaId:targets[worker].MEDIA_DB[1]}),checks={};
try{for(const name of ['DB','MEDIA_DB']){const db=target[name],integrity=(await db.prepare('PRAGMA quick_check').all()).results,foreignKeys=(await db.prepare('PRAGMA foreign_key_check').all()).results;assert.ok(integrity.every(r=>r.quick_check==='ok'));assert.deepEqual(foreignKeys,[]);checks[name]={integrity:'ok',foreignKeyViolations:0};}assert.equal((await target.DB.prepare('SELECT COUNT(*) n FROM cf_sessions s LEFT JOIN cf_credentials c ON c.user_id=s.user_id WHERE c.user_id IS NULL').first()).n,0);}
finally{await target.close();}
const report={pass:true,backend:'cloudflare-d1',worker,version,checkedAt:new Date().toISOString(),health,checks};mkdirSync('.local-tools/cloudflare-auth',{recursive:true});writeFileSync('.local-tools/cloudflare-auth/cloudflare-data-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
