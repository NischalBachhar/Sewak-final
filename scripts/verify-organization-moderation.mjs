// Explicit production QA. Only random, run-owned identities may be mutated or cleaned.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {chromium} from '@playwright/test';
import {openTarget} from './d1-target.mjs';
import {cloudflare} from './cloudflare-operator.mjs';
import {targets,SEWAK_ACCOUNT,assertLiveBindings} from './deployment-policy.mjs';
import {entities,encodeRecord,insertSQL} from '../worker/src/model.mjs';
import {hashPassword} from '../worker/src/passwords.ts';
import {controlledQaGmail,syntheticQaEmail} from './synthetic-qa-email.mjs';
import {verifyOrganizationModeration} from './organization-moderation-browser-qa.mjs';

assert.ok(process.argv.includes('--apply-synthetic-qa'),'Explicit synthetic QA flag required');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,SEWAK_ACCOUNT);
const gmail=controlledQaGmail(process.env.SEWAK_QA_GMAIL),worker='sewak-final';
const origin='https://sewak-final.nischalbachhar9.workers.dev',root=`/accounts/${SEWAK_ACCOUNT}/workers/scripts/${worker}`;
const validation=JSON.parse(readFileSync('.local-tools/cloudflare-auth/cloudflare-data-check.json','utf8'));
const deployment=(await cloudflare(root+'/deployments')).deployments[0];
assert.equal(deployment.versions.length,1);assert.equal(deployment.versions[0].percentage,100);
const version=deployment.versions[0].version_id;
assert.equal(validation.pass,true);assert.equal(validation.version,version);assert.ok(Date.now()-Date.parse(validation.checkedAt)<3600000);
assertLiveBindings(worker,(await cloudflare(root+'/settings')).bindings,true);
const target=await openTarget({remote:true,mainId:targets[worker].DB[1],mediaId:targets[worker].MEDIA_DB[1]}),{DB}=target;
const run=randomUUID(),password=randomBytes(32).toString('base64url')+'!Aa9';
const admin={uid:'usr_'+randomUUID(),email:syntheticQaEmail({role:'superadmin',run,gmailBase:gmail})};
const orgs=['approve','reject','blacklisted'].map(key=>({key,uid:'usr_'+randomUUID(),name:`Synthetic ${key} ${run}`,email:syntheticQaEmail({role:'orgadmin',run:randomUUID(),gmailBase:gmail})}));
const report={run,worker,version,startedAt:new Date().toISOString(),pass:false,fixtureSetup:'operator-seeded-moderation-only'};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function snapshot(){const rows={};for(const table of new Set(Object.values(entities).map(e=>e.table))){const records=(await DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all()).results;rows[table]=records.filter(row=>table!=='admin_audit_logs'||row.actor_uid!==admin.uid);}return hash(rows);}
const before=await snapshot();let browser;
report.originalApplicationHash=before;
report.fixtures={adminUid:admin.uid,organizationIds:orgs.map(org=>org.uid)};
mkdirSync('.local-tools/cloudflare-auth',{recursive:true});
writeFileSync(`.local-tools/cloudflare-auth/organization-moderation-${run}.json`,JSON.stringify(report,null,2));
async function put(name,id,data){const q=insertSQL(name,encodeRecord(name,id,data),'insert');await DB.prepare(q.sql).bind(...q.params).run();}
try{
  await put('users',admin.uid,{uid:admin.uid,email:admin.email,name:'Synthetic moderation QA',role:'superadmin',profileComplete:true,isApproved:true,isSuspended:false,isBlacklisted:false});
  await DB.prepare('INSERT INTO cf_credentials(user_id,email,password_hash,created_at) VALUES(?,?,?,?)').bind(admin.uid,admin.email,hashPassword(password),Math.floor(Date.now()/1000)).run();
  for(const org of orgs){
    const restricted=org.key==='blacklisted';
    await put('users',org.uid,{uid:org.uid,email:org.email,name:'Synthetic organization owner',role:'orgadmin',profileComplete:true,isApproved:false,isSuspended:restricted,isBlacklisted:restricted});
    await put('organizations',org.uid,{organizationId:org.uid,adminUid:org.uid,organizationName:org.name,isApproved:false,isSuspended:restricted,isBlacklisted:restricted,...(restricted?{reviewStatus:'blacklisted'}:{})});
    if(!restricted)await put('organizationApplications',org.uid,{applicantId:org.uid,organizationName:org.name,status:'pending'});
  }
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(45000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/auth');await page.getByLabel('Email',{exact:true}).fill(admin.email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(/\/superadmin/);
  report.browser=await verifyOrganizationModeration(page,{origin,names:Object.fromEntries(orgs.map(o=>[o.key,o.name]))});
  assert.deepEqual(errors,[],'No browser page errors');report.browser.pageErrors=0;
  const applications=(await DB.prepare('SELECT id,status FROM organization_applications WHERE id IN (?,?)').bind(orgs[0].uid,orgs[1].uid).all()).results;
  assert.equal(applications.find(r=>r.id===orgs[0].uid).status,'approved');assert.equal(applications.find(r=>r.id===orgs[1].uid).status,'rejected');report.linkedQueuesUpdated=true;
  const audit=(await DB.prepare('SELECT action,target_id FROM admin_audit_logs WHERE actor_uid=?').bind(admin.uid).all()).results;
  assert.equal(audit.filter(r=>r.action==='organization_deleted').length,2);report.syntheticAuditEntriesPreserved=audit.length;
  report.checksPassed=true;
}catch(error){report.failure={name:error.name,message:error.message};}
finally{
  if(browser)await browser.close();
  try{
    for(const org of orgs){
      assert.match(org.uid,/^usr_[0-9a-f-]{36}$/);assert.ok(org.name.endsWith(run));
      // Approval can create an in-app alert. Remove only this run's recipient's
      // alerts before deleting its synthetic identity; retain audit history.
      const notices=await DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='care_notifications'").first();
      if(notices)await DB.prepare('DELETE FROM care_notifications WHERE recipient_id=?').bind(org.uid).run();
      const row=await DB.prepare('SELECT organization_name FROM organizations WHERE id=?').bind(org.uid).first();
      if(row){assert.equal(row.organization_name,org.name);await DB.prepare('DELETE FROM organization_applications WHERE id=? AND applicant_id=?').bind(org.uid,org.uid).run();await DB.prepare('DELETE FROM blacklist WHERE id=?').bind(org.uid).run();await DB.prepare('UPDATE users SET organization_id=NULL WHERE id=? AND email=? AND organization_id=?').bind(org.uid,org.email,org.uid).run();await DB.prepare('DELETE FROM organizations WHERE id=? AND admin_uid=?').bind(org.uid,org.uid).run();}
      await DB.prepare('DELETE FROM users WHERE id=? AND email=?').bind(org.uid,org.email).run();
      assert.equal(await DB.prepare('SELECT id FROM users WHERE id=?').bind(org.uid).first(),null);
    }
    await DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind(admin.uid).run();await DB.prepare('DELETE FROM cf_credentials WHERE user_id=? AND email=?').bind(admin.uid,admin.email).run();await DB.prepare('DELETE FROM users WHERE id=? AND email=?').bind(admin.uid,admin.email).run();
    assert.equal(await DB.prepare('SELECT id FROM users WHERE id=?').bind(admin.uid).first(),null);
    assert.equal(await snapshot(),before,'Existing application records, bookings and audit history must remain unchanged');
    assert.deepEqual((await DB.prepare('PRAGMA foreign_key_check').all()).results,[]);
    report.cleanupVerified=true;report.applicationRecordsUnchanged=true;report.existingAuditHistoryPreserved=true;
  }catch(error){report.cleanupFailure={name:error.name,message:error.message};}
  report.pass=Boolean(report.checksPassed&&report.cleanupVerified);report.completedAt=new Date().toISOString();
  mkdirSync('.local-tools/cloudflare-auth',{recursive:true});const output=`.local-tools/cloudflare-auth/organization-moderation-${run}.json`;writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({pass:report.pass,version,report:output,browser:report.browser,cleanupVerified:report.cleanupVerified,failure:report.failure,cleanupFailure:report.cleanupFailure}));await target.close();if(!report.pass)process.exitCode=1;
}
