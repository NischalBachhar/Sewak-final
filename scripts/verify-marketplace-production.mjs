// Authorized live QA: unpublished, run-owned identities only. Never books a real provider.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from '@playwright/test';
import {openTarget} from './d1-target.mjs';
import {cloudflare} from './cloudflare-operator.mjs';
import {SEWAK_ACCOUNT,targets,assertLiveBindings} from './deployment-policy.mjs';
import {encodeRecord,insertSQL} from '../worker/src/model.mjs';
import {hashPassword} from '../worker/src/passwords.ts';
import {controlledQaGmail,syntheticQaEmail} from './synthetic-qa-email.mjs';

assert.deepEqual(process.argv.slice(2),['--apply-synthetic-qa']);
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,SEWAK_ACCOUNT);
const worker='sewak-final',origin='https://sewak-final.nischalbachhar9.workers.dev';
const root=`/accounts/${SEWAK_ACCOUNT}/workers/scripts/${worker}`;
const validation=JSON.parse(readFileSync('.local-tools/cloudflare-auth/cloudflare-data-check.json','utf8'));
const deployment=(await cloudflare(root+'/deployments')).deployments[0];
assert.equal(deployment.versions.length,1);assert.equal(deployment.versions[0].percentage,100);
const version=deployment.versions[0].version_id;
assert.equal(validation.pass,true);assert.equal(validation.version,version);
assert.ok(Date.now()-Date.parse(validation.checkedAt)<3600000);
assertLiveBindings(worker,(await cloudflare(root+'/settings')).bindings,true,{requireEvidence:true});
const target=await openTarget({remote:true,mainId:targets[worker].DB[1],mediaId:targets[worker].MEDIA_DB[1]});
const {DB}=target,run=randomUUID(),gmail=controlledQaGmail(process.env.SEWAK_QA_GMAIL);
const password=randomBytes(32).toString('base64url')+'!Aa9';
const users=['user','caregiver','orgadmin','superadmin'].map(role=>({role,uid:'usr_'+randomUUID(),email:syntheticQaEmail({role,run,gmailBase:gmail})}));
const [customer,caregiver,org,admin]=users,bookingId='qa_'+run;
const report={worker,version,run,startedAt:new Date().toISOString(),pass:false,checks:[],widths:[320,390,768,1440,1920],fixtureSetup:'unpublished-identities-and-closed-booking'};
const dir='.local-tools/cloudflare-auth/marketplace-'+run;
mkdirSync(dir,{recursive:true});
const tables=(await DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results.map(r=>r.name).filter(name=>!name.startsWith('_')&&!name.startsWith('sqlite_')&&!['d1_migrations','cf_sessions','cf_auth_limits'].includes(name)).sort();
const hash=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
async function snapshot(){const result={};for(const table of tables){assert.match(table,/^[a-z_][a-z0-9_]*$/);try{result[table]=hash((await DB.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()).results);}catch(error){throw new Error('Application snapshot '+table+': '+error.message);}}return result;}
const before=await snapshot();let browser;
async function put(name,id,data){const q=insertSQL(name,encodeRecord(name,id,data),'insert');await DB.prepare(q.sql).bind(...q.params).run();}
async function request(path,user,json,expected=200){
 const response=await fetch(origin+path,{method:json?'POST':'GET',headers:{...(user?{Authorization:'Bearer '+user.token}:{}),...(json?{'Content-Type':'application/json'}:{})},...(json?{body:JSON.stringify(json)}:{}),signal:AbortSignal.timeout(45000)});
 const data=await response.json();report.checks.push({path,status:response.status});
 assert.equal(response.status,expected,JSON.stringify({path,status:response.status,error:data.error}));return data;
}
try{
 for(const u of users){
  await put('users',u.uid,{uid:u.uid,email:u.email,name:'Unpublished live QA '+u.role,role:u.role,profileComplete:true,isApproved:false,isSuspended:false,isBlacklisted:false});
  await DB.prepare('INSERT INTO cf_credentials(user_id,email,password_hash,created_at) VALUES(?,?,?,?)').bind(u.uid,u.email,hashPassword(password),Math.floor(Date.now()/1000)).run();
  u.token=(await request('/auth/login',null,{email:u.email,password,sessionMode:'bearer'})).token;
 }
 await put('organizations',org.uid,{organizationId:org.uid,adminUid:org.uid,organizationName:'Unpublished live QA organization',isApproved:false,isSuspended:false,isBlacklisted:false});
 await put('vendors',caregiver.uid,{uid:caregiver.uid,name:'Unpublished live QA caregiver',isApproved:false,isAvailable:false,isSuspended:false,isBlacklisted:false,isIndependent:true});
 assert.equal((await request('/api/records/publicCaregivers/'+caregiver.uid,null)).items.length,0,'Synthetic caregiver must remain unpublished');
 await request('/api/query',null,{path:'publicCaregivers',limit:12});
 const clip=await fetch(origin+'/videos/sewak-care-hero.mp4?v=sewak-care-20261019');
 assert.equal(clip.status,200);assert.match(clip.headers.get('Content-Type'),/^video\/mp4/);
 assert.equal(createHash('sha256').update(Buffer.from(await clip.arrayBuffer())).digest('hex'),createHash('sha256').update(readFileSync('public/videos/sewak-care-hero.mp4')).digest('hex'));
 report.media={originalVideoBytesMatch:true};
 // A closed booking supports private history/conversations without publishing
 // a fabricated caregiver or generating a request/reminder for real accounts.
 await put('bookings',bookingId,{userId:customer.uid,caregiverId:caregiver.uid,status:'cancelled',paymentMethod:'cash',paymentStatus:'pending',serviceLabel:'Synthetic closed QA care',date:'2020-01-01',time:'10:00',scheduleAt:'2020-01-01T04:15:00.000Z',durationHours:1});
 assert.equal((await request('/api/records/bookings/'+bookingId,customer)).items[0].data.status,'cancelled');
 await request('/api/records/bookings/'+bookingId,org,undefined,403);
 for(const u of users){const notices=await request('/api/care-notifications',u);assert.equal(notices.delivery.email,false);assert.equal(notices.delivery.webPush,false);}
 await request('/api/care-notifications',customer,{action:'preferences',bookingReminders:false});
 assert.equal((await request('/api/care-notifications',customer)).preferences.bookingReminders,false);
 assert.equal((await request('/api/care-notifications',caregiver)).preferences.bookingReminders,true);
 await request('/api/care-messages',customer,{kind:'booking',contextId:bookingId,body:'Synthetic private live QA message'});
 const messages=await request('/api/care-messages?kind=booking&contextId='+bookingId,caregiver);
 assert.equal(messages.messages.length,1);
 await request('/api/care-messages?kind=booking&contextId='+bookingId,org,undefined,404);
 assert.equal((await request('/api/care-inbox',customer)).conversations.length,1);
 const notices=await request('/api/care-notifications',caregiver);assert.equal(notices.unread,1);
 await request('/api/care-notifications',caregiver,{action:'read-all'});
 assert.equal((await request('/api/care-notifications',caregiver)).unread,0);
 const membership=await request('/api/membership',customer,{tier:'plus_preview',acknowledgeDemo:true});
 assert.equal(membership.charged,false);assert.equal(membership.realSubscription,false);assert.equal(membership.mode,'demo-only');
 await request('/api/membership',caregiver,undefined,403);
 await request('/api/admin/accounts',admin);await request('/api/admin/audit',admin);
 await request('/api/admin/accounts',customer,undefined,403);
 await request('/api/care-notifications',null,undefined,401);
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 page.setDefaultTimeout(45000);
 for(const width of report.widths){
  await page.setViewportSize({width,height:900});await page.goto(origin+'/');
  await page.locator('main h1').waitFor();
  await page.waitForLoadState('networkidle');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Public overflow at '+width);
  await page.screenshot({path:dir+'/public-'+width+'.png',fullPage:true,animations:'disabled'});
 }
 const roles=[];
 for(const [u,path] of [[customer,'/user/inbox'],[caregiver,'/caregiver/notifications'],[org,'/organization/notifications'],[admin,'/superadmin/accounts']]){
  const context=await browser.newContext();const rolePage=await context.newPage();rolePage.setDefaultTimeout(45000);
  await rolePage.goto(origin+'/auth');await rolePage.getByLabel('Email',{exact:true}).fill(u.email);await rolePage.getByLabel('Password',{exact:true}).fill(password);await rolePage.getByRole('button',{name:'Sign in',exact:true}).click();await rolePage.waitForURL(url=>url.pathname!=='/auth');
  for(const width of report.widths){await rolePage.setViewportSize({width,height:900});await rolePage.goto(origin+path);await rolePage.locator('main h1').first().waitFor();await rolePage.waitForLoadState('networkidle');assert.ok(await rolePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),u.role+' overflow at '+width);await rolePage.screenshot({path:dir+'/'+u.role+'-'+width+'.png',fullPage:true,animations:'disabled'});}
  roles.push(u.role);await context.close();
 }
 assert.deepEqual(errors,[]);report.browser={publicWidths:report.widths,authenticatedRoles:roles,overflow:false,pageErrors:0};
 report.checksPassed=true;
}catch(error){report.failure={name:error.name,message:error.message};}
finally{
 if(browser)await browser.close();
 try{
  for(const u of users){assert.match(u.uid,/^usr_[0-9a-f-]{36}$/);const row=await DB.prepare('SELECT email FROM users WHERE id=?').bind(u.uid).first();if(row)assert.equal(row.email,u.email);}
  await DB.prepare('DELETE FROM care_messages WHERE context_id=? AND customer_id=? AND caregiver_id=?').bind(bookingId,customer.uid,caregiver.uid).run();
  for(const u of users){for(const [table,column] of [['care_notifications','recipient_id'],['care_notification_preferences','user_id'],['care_membership_preferences','user_id']])await DB.prepare('DELETE FROM '+table+' WHERE '+column+'=?').bind(u.uid).run();}
  await DB.prepare('DELETE FROM bookings WHERE id=? AND user_id=? AND caregiver_id=?').bind(bookingId,customer.uid,caregiver.uid).run();
  await DB.prepare('DELETE FROM caregivers WHERE id=?').bind(caregiver.uid).run();
  await DB.prepare('DELETE FROM organizations WHERE id=? AND admin_uid=?').bind(org.uid,org.uid).run();
  for(const u of users)await DB.batch([DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind(u.uid),DB.prepare('DELETE FROM cf_credentials WHERE user_id=? AND email=?').bind(u.uid,u.email),DB.prepare('DELETE FROM users WHERE id=? AND email=?').bind(u.uid,u.email)]);
  assert.deepEqual(await snapshot(),before,'Every preexisting application table must remain identical');
  assert.deepEqual((await DB.prepare('PRAGMA foreign_key_check').all()).results,[]);
  report.cleanupVerified=true;report.applicationRecordsUnchanged=true;
 }catch(error){report.cleanupFailure={name:error.name,message:error.message};}
 report.pass=Boolean(report.checksPassed&&report.cleanupVerified);report.completedAt=new Date().toISOString();
 writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));await target.close();
 console.log(JSON.stringify({pass:report.pass,version,checks:report.checks.length,report:dir+'/report.json',cleanupVerified:report.cleanupVerified,failure:report.failure,cleanupFailure:report.cleanupFailure}));
 if(!report.pass)process.exitCode=1;
}
