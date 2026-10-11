// Operator-only emergency recovery for the single verified October 11 outage.
// This does not modify standard deploy guards or database schema.
// Usage: node scripts/incident-recover-sewak-final.mjs --prepare
//        node scripts/incident-recover-sewak-final.mjs --execute --failed-qa <path>
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {cloudflare,assertFreeAccount} from './cloudflare-operator.mjs';
import {assertDeploymentConfig,assertLiveBindings,SEWAK_ACCOUNT,targets} from './deployment-policy.mjs';
import {controlledQaGmail} from './synthetic-qa-email.mjs';
import {assertIncidentRecovery,INCIDENT_VERSION} from './incident-recovery-contract.mjs';

const argv=process.argv.slice(2),action=argv[0];
assert.ok(['--prepare','--execute'].includes(action),'Use --prepare or --execute only.');
if(action==='--prepare')assert.equal(argv.length,1,'--prepare accepts no extra arguments.');
if(action==='--execute')assert.ok(argv.length===3&&argv[1]==='--failed-qa'&&argv[2]&&!argv[2].startsWith('--'),'Use --execute --failed-qa path/to/failing-report.json');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,SEWAK_ACCOUNT);
assert.ok(!process.env.GITHUB_ACTIONS&&!process.env.CI&&!process.env.WORKERS_CI,'Incident recovery must be explicitly run by the operator locally.');
assertDeploymentConfig('sewak-final',readFileSync('wrangler.production.toml','utf8'));
const config=readFileSync('wrangler.production.toml','utf8');
assert.match(config,/APP_WRITES_ENABLED\s*=\s*"true"/);
const root=`/accounts/${SEWAK_ACCOUNT}/workers/scripts/sewak-final`;
const statePath='.local-tools/sewak-incident-recovery.json';
const outdir='.local-tools/cloudflare-auth';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sha=git('rev-parse','HEAD');
assert.equal(git('status','--porcelain'),'','The working tree must be clean.');
assert.equal(sha,git('rev-parse','origin/main'),'Pull current GitHub main before recovery.');
assert.equal(spawnSync('git',['merge-base','--is-ancestor','fb610bcf5da3562f78fcf2df55c3a3cba72e3342',sha]).status,0,'Required diagnostic and UI fixes are missing.');
assert.match(git('remote','get-url','origin'),/^(?:https:\/\/github\.com\/|git@github\.com:)(?:NischalBachhar)\/Sewak-final(?:\.git)?$/i);
const run=(command,args)=>{const result=spawnSync(command,args,{stdio:'inherit',env:process.env,shell:process.platform==='win32'});if(result.status!==0)throw new Error('Required check failed: '+args.slice(0,3).join(' '));};
const npm=(...args)=>run(process.platform==='win32'?'npm.cmd':'npm',args);
async function liveVersion() {
 const deployment=(await cloudflare(root+'/deployments')).deployments[0];
 assert.equal(deployment.versions.length,1,'Cannot recover a mixed deployment.');
 assert.equal(deployment.versions[0].percentage,100,'Production must have one active version at 100%.');
 const id=deployment.versions[0].version_id;
 assert.equal(id,INCIDENT_VERSION,'The incident version has changed: stop without deploying.');
 const settings=(await cloudflare(root+'/settings')).bindings;
 assertLiveBindings('sewak-final',settings,true);
 assertLiveBindings('sewak-final',(await cloudflare(root+'/versions/'+id)).resources.bindings,true);
 return id;
}
function validation(){return JSON.parse(readFileSync(join(outdir,'cloudflare-data-check.json'),'utf8'));}
async function bookmarks(){
 const values={};
 for(const key of ['DB','MEDIA_DB']){
  const result=await cloudflare(`/accounts/${SEWAK_ACCOUNT}/d1/database/${targets['sewak-final'][key][1]}/time_travel/bookmark`);
  assert.ok(typeof result.bookmark==='string'&&result.bookmark.length>8,'D1 recovery bookmark unavailable for '+key);
  values[key]=result.bookmark;
 }
 return values;
}
async function smoke(){
 const origin='https://sewak-final.nischalbachhar9.workers.dev';
 const health=await fetch(origin+'/api/health',{cache:'no-store'});
 assert.equal(health.status,200,'New Worker health endpoint failed.');
 const payload=await health.json();assert.equal(payload.healthy,true);assert.equal(payload.auth,'cloudflare-d1');assert.equal(payload.writesEnabled,true);
 const anonymous=await fetch(origin+'/api/auth/me',{cache:'no-store'});
 assert.equal(anonymous.status,200,'Anonymous auth session endpoint failed.');
 assert.equal((await anonymous.json()).user,null);
 const expired=await fetch(origin+'/api/auth/me',{headers:{Cookie:'__Host-sewak_session=swk_'+'0'.repeat(43)},cache:'no-store'});
 assert.equal(expired.status,401,'Invalid cookie must return 401 rather than 503.');
 const browse=await fetch(origin+'/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'publicCaregivers',search:{text:'',category:'',serviceId:'',workType:'',shift:'',location:'',minimumExperience:0,minimumRating:0,verifiedOnly:false},limit:12})});
 assert.equal(browse.status,200,'Public caregiver search failed.');
 assert.ok(Array.isArray((await browse.json()).items),'Caregiver search response malformed.');
}
await liveVersion();
if(action==='--prepare'){
 console.log('Preparing pinned, clean Sewak production recovery; no deployment or D1 mutations.');
 npm('run','typecheck');
 npm('run','test:d1');
 npm('run','test:unit','--','--silent');
 npm('run','lint');
 npm('run','build:release');
 npm('run','deploy:cloudflare','--','--worker','sewak-final','--dry-run');
 run(process.execPath,['scripts/scan-release.mjs']);
 run(process.execPath,['scripts/verify-cloudflare-data.mjs']);
 const report=validation();assert.equal(report.pass,true);assert.equal(report.version,INCIDENT_VERSION);
 const points=await bookmarks();
 const state={worker:'sewak-final',gitSha:sha,version:INCIDENT_VERSION,preparedAt:new Date().toISOString(),bookmarks:points};
 mkdirSync('.local-tools',{recursive:true});
 writeFileSync(statePath,JSON.stringify(state,null,2),{mode:0o600});
 console.log(JSON.stringify({prepared:true,gitSha:sha,liveVersion:INCIDENT_VERSION,d1Validated:true,bookmarksSaved:true,statePath}));
 process.exit(0);
}
const qaEmail=controlledQaGmail(process.env.SEWAK_QA_GMAIL);
assert.ok(qaEmail,'Set your own SEWAK_QA_GMAIL before executing.');
const prepared=JSON.parse(readFileSync(statePath,'utf8'));
const failedQa=JSON.parse(readFileSync(argv[2],'utf8'));
const currentValidation=validation();
assertIncidentRecovery({validation:currentValidation,failedQa,prepared,liveVersion:INCIDENT_VERSION,gitSha:sha});
await assertFreeAccount(SEWAK_ACCOUNT,{attested:true});
const readline=createInterface({input,output});
const answer=await readline.question('To authorize a one-time production repair, type RECOVER sewak-final 750f1bb7: ');
readline.close();
assert.equal(answer,'RECOVER sewak-final 750f1bb7','Operator did not confirm the incident recovery.');
console.log('Starting one-time version-pinned repair; original Worker version and D1 bookmarks are recorded locally.');
let uploaded=false;
try{
 const runner=spawnSync(process.execPath,['worker/node_modules/wrangler/bin/wrangler.js','deploy','--config','wrangler.production.toml'],{
   stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',SEWAK_REVIEWED_TARGET:'sewak-final'}
 });
 if(runner.status!==0)throw new Error('Worker upload failed. Confirm live deployment state before retrying.');
 uploaded=true;
 const dep=(await cloudflare(root+'/deployments')).deployments[0];
 assert.ok(dep.versions.length===1&&dep.versions[0].percentage===100&&dep.versions[0].version_id!==INCIDENT_VERSION,'Expected newly deployed 100% Worker version.');
 const version=dep.versions[0].version_id;
 assertLiveBindings('sewak-final',(await cloudflare(root+'/settings')).bindings,true);
 assertLiveBindings('sewak-final',(await cloudflare(root+'/versions/'+version)).resources.bindings,true);
 await smoke();
 run(process.execPath,['scripts/verify-cloudflare-data.mjs']);
 const before=new Set(existsSync(outdir)?readdirSync(outdir):[]);
 const result=spawnSync(process.execPath,['scripts/verify-cloudflare-auth.mjs','--worker','sewak-final','--apply-synthetic-qa','--verify-write-enabled-production'],{stdio:'inherit',env:process.env});
 const after=existsSync(outdir)?readdirSync(outdir).filter(name=>/^sewak-final-qa-.*\.json$/.test(name)&&!before.has(name)):[];
 assert.equal(after.length,1,'Expected one newly generated production Auth QA report.');
 const qa=JSON.parse(readFileSync(join(outdir,after[0]),'utf8'));
 assert.ok(result.status===0&&qa.pass===true&&qa.cleanupVerified===true&&qa.applicationRecordsUnchanged===true&&qa.version===version,'Production Auth QA must pass with verified cleanup and exact new version.');
 console.log(JSON.stringify({recovered:true,worker:'sewak-final',version,authQaPassed:true,cleanupVerified:true}));
}catch(error){
 // Roll back Worker code only. Never restore D1 automatically or delete customer data.
 if(uploaded) {
  console.error('Post-deployment verification failed; attempting Worker-code rollback to the pinned prior version. Database records are not restored or modified by rollback.');
  const previous=spawnSync(process.execPath,['worker/node_modules/wrangler/bin/wrangler.js','rollback',INCIDENT_VERSION,'--config','wrangler.production.toml','--message','Revert failed incident repair validation'],{stdio:'inherit',env:process.env});
  console.error(previous.status===0?'Worker code rollback command completed.':'Worker rollback FAILED; manual Cloudflare intervention required.');
 }
 throw new Error('Incident recovery did not verify. Check operator logs and release state; do not repeat blindly.');
}
