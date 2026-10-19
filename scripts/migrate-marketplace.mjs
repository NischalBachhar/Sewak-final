// Explicit production operator. Default is read-only; never provisions or renames resources.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cloudflare} from './cloudflare-operator.mjs';
import {SEWAK_ACCOUNT,targets,assertDeploymentConfig,assertLiveBindings} from './deployment-policy.mjs';
import {migrationPlan} from './marketplace-migration-plan.mjs';
import {assertReleaseEvidence} from './release-evidence.mjs';

const args=process.argv.slice(2);
assert.ok(args.length===0||args.length===3&&args[0]==='--apply'&&args[1]==='--auth-qa'&&args[2]&&!args[2].startsWith('--'),'Use --apply --auth-qa PATH or no arguments for a read-only plan');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,SEWAK_ACCOUNT);
assertDeploymentConfig('sewak-final',readFileSync('wrangler.production.toml','utf8'));
const base='/accounts/'+SEWAK_ACCOUNT,worker=base+'/workers/scripts/sewak-final';
assertLiveBindings('sewak-final',(await cloudflare(worker+'/settings')).bindings,true,{requireEvidence:true});
const query=async (id,sql,params=[]) => (await cloudflare(base+'/d1/database/'+id+'/query',{method:'POST',json:{sql,params}}));
const main=targets['sewak-final'].DB[1];
const rows=async(sql,params=[]) => (await query(main,sql,params))[0].results;
const tables=(await rows("SELECT name FROM sqlite_master WHERE type='table'")).map(r=>r.name);
for(const required of ['users','cf_credentials','bookings','caregivers','organization_services','verification_records','sewak_schema_migrations'])assert.ok(tables.includes(required),'Missing prerequisite: '+required);
const journal=await rows('SELECT * FROM sewak_schema_migrations');
const plan=migrationPlan({journal,tables});
if(!args.includes('--apply')){console.log(JSON.stringify({worker:'sewak-final',dryRun:true,plan},null,2));process.exit(0);}

const validation=JSON.parse(readFileSync('.local-tools/cloudflare-auth/cloudflare-data-check.json','utf8'));
assert.equal(validation.pass,true);assert.equal(validation.worker,'sewak-final');
assert.ok(Date.now()-Date.parse(validation.checkedAt)<3600000,'Refresh production integrity QA');
assertReleaseEvidence({validation,qa:JSON.parse(readFileSync(args[2],'utf8')),writesEnabled:true});
const deployments=(await cloudflare(worker+'/deployments')).deployments;
assert.equal(deployments[0].versions.length,1);assert.equal(deployments[0].versions[0].percentage,100);
assert.equal(deployments[0].versions[0].version_id,validation.version,'Production changed since validation');
const backup=JSON.parse(readFileSync('.local-tools/backups/backup-evidence.json','utf8'));
assert.ok(Date.now()-Date.parse(backup.checkedAt)<86400000,'Refresh production backups');
for(const binding of ['DB','MEDIA_DB','EVIDENCE_DB']){
 const item=backup.databases.find(d=>d.binding===binding);
 assert.equal(item?.id,targets['sewak-final'][binding][1]);assert.ok(item.bookmark);
 if(binding!=='EVIDENCE_DB'){
   assert.equal(createHash('sha256').update(readFileSync(item.file)).digest('hex'),item.sha256);
   assert.equal(item.restoreVerified,true,'Backup restore must be verified offline');
 }
}
// Record hashes rather than personal data; compare every preexisting application table.
const snapshot=async()=>{
 const result={};
 for(const table of tables.filter(t=>!t.startsWith('_')&&!['sewak_schema_migrations','d1_migrations','sqlite_sequence','cf_sessions','cf_auth_limits'].includes(t)).sort()){
   assert.match(table,/^[a-z_]+$/);
   const data=await rows('SELECT * FROM '+table+' ORDER BY rowid');
   result[table]={count:data.length,sha256:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
 }
 return result;
};
const before=await snapshot(),applied=[];
for(const migration of plan.filter(m=>!m.applied)){
 // Journal entry and additive schema share a single atomic D1 transaction.
 const batch=migration.statements.map(sql=>({sql,params:[]}));
 batch.push({sql:'INSERT INTO sewak_schema_migrations(name,hash,next_statement,applied_at) VALUES(?,?,?,?)',params:[migration.name,migration.hash,migration.statements.length,new Date().toISOString()]});
 await cloudflare(base+'/d1/database/'+main+'/query',{method:'POST',json:{batch}});
 applied.push({name:migration.name,hash:migration.hash});
}
const after=await snapshot();assert.deepEqual(after,before,'Existing application data changed during migration; inspect before release');
for(const binding of ['DB','MEDIA_DB','EVIDENCE_DB']){
 const id=targets['sewak-final'][binding][1];
 assert.deepEqual((await query(id,'PRAGMA foreign_key_check'))[0].results,[]);
 assert.ok((await query(id,'PRAGMA quick_check'))[0].results.every(r=>r.quick_check==='ok'));
}
const report={worker:'sewak-final',checkedAt:new Date().toISOString(),applied,existingApplicationRecordsUnchanged:true,before,after};
mkdirSync('.local-tools/cloudflare-auth',{recursive:true});
writeFileSync('.local-tools/cloudflare-auth/marketplace-migrations.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({applied,existingApplicationRecordsUnchanged:true}));
