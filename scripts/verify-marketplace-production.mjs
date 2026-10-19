// Authorized live QA: run-owned identities only. Never books a real provider.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from '@playwright/test';
import axe from 'axe-core';
import {verifyVerificationViews} from './verification-browser-qa.mjs';
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
const report={worker,version,run,startedAt:new Date().toISOString(),pass:false,checks:[],widths:[320,390,768,1024,1440,1920],fixtureSetup:'run-owned-identities-and-bookings'};
const lifecycleIds=[];
const dir='.local-tools/cloudflare-auth/marketplace-'+run;
mkdirSync(dir,{recursive:true});
const tables=(await DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results.map(r=>r.name).filter(name=>!name.startsWith('_')&&!name.startsWith('sqlite_')&&!['d1_migrations','cf_sessions','cf_auth_limits'].includes(name)).sort();
const hash=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
async function snapshot(){const result={};for(const table of tables){assert.match(table,/^[a-z_][a-z0-9_]*$/);try{result[table]=hash((await DB.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()).results);}catch(error){throw new Error('Application snapshot '+table+': '+error.message);}}return result;}
const before=await snapshot();let browser;
report.fixtures={userIds:users.map(user=>user.uid),closedBookingId:bookingId,lifecycleIds};
writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));
async function put(name,id,data,mode='insert'){const q=insertSQL(name,encodeRecord(name,id,data),mode);await DB.prepare(q.sql).bind(...q.params).run();}
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
 // Briefly expose an explicitly named synthetic fixture only while exercising
 // genuine booking authorization. Never send a request to a real provider.
 const services=await request('/api/query',null,{path:'publicServices',limit:50});
 const service=services.items.find(s=>!s.data.organizationId&&['caregiver','both'].includes(s.data.category));
 assert.ok(service,'An existing active non-medical global service is required');
 const professional={uid:caregiver.uid,name:'Synthetic QA - not a care provider',isApproved:true,isAvailable:true,isSuspended:false,isBlacklisted:false,isIndependent:true,category:'caregiver',workType:'parttime',shifts:['morning'],servicesOffered:[service.id],hourlyRate:0,allowZeroRate:true,location:'Synthetic QA only'};
 try{
  await put('vendors',caregiver.uid,professional,'upsert');
  await DB.prepare('INSERT OR IGNORE INTO caregiver_services(caregiver_id,service_id) VALUES(?,?)').bind(caregiver.uid,service.id).run();
  assert.equal((await request('/api/records/publicCaregivers/'+caregiver.uid,null)).items.length,1);
  const timestamp={__op:'serverTimestamp'};
  const create=async(time)=>{
   const id=customer.uid+'_'+randomUUID();lifecycleIds.push(id);writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));
   const data={schemaVersion:2,requestFingerprint:hash(run+id),requestedTimeWindows:[],scheduleAt:new Date('2090-01-01T'+time+':00+05:45').toISOString(),commissionRate:15,userId:customer.uid,userName:'Synthetic QA customer',userPhone:'+9779800000000',userEmail:customer.email,address:'Synthetic QA address',city:'Hetauda',date:'2090-01-01',time,durationHours:1,recurrence:'one_time',careRecipient:'Synthetic QA recipient',careNeeds:'Synthetic QA only',serviceId:service.id,serviceLabel:service.data.label||service.data.serviceName,caregiverId:caregiver.uid,vendorId:caregiver.uid,organizationId:'',organizationName:'',caregiverName:professional.name,caregiverLocation:professional.location,caregiverWorkType:'parttime',caregiverShifts:['morning'],caregiverCategory:'caregiver',status:'pending',hourlyRate:0,totalAmount:0,platformCommission:0,vendorEarnings:0,paymentMethod:'cash',paymentStatus:'pending',amountDue:0,createdAt:timestamp};
   await request('/api/commit',customer,{writes:[{path:'bookings/'+id,kind:'set',data}],preconditions:[]});return id;
  };
  const update=async(id,status)=>request('/api/commit',caregiver,{writes:[{path:'bookings/'+id,kind:'update',data:{status,updatedAt:timestamp}}],preconditions:[]});
  const accepted=await create('10:00');await update(accepted,'accepted');
  assert.equal((await request('/api/records/bookings/'+accepted,customer)).items[0].data.status,'accepted');
  const declined=await create('12:00');await update(declined,'cancelled');
  assert.equal((await request('/api/records/bookings/'+declined,customer)).items[0].data.status,'cancelled');
  report.bookingLifecycle={realApiCreation:true,caregiverAcceptance:true,caregiverDecline:true,realProviderContacted:false,charged:false};
 }finally{
  await put('vendors',caregiver.uid,{...professional,isApproved:false,isAvailable:false},'upsert');
  assert.equal((await request('/api/records/publicCaregivers/'+caregiver.uid,null)).items.length,0);
 }
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 page.setDefaultTimeout(45000);
 const views=[];
 async function inspect(p,label,width){
  await p.locator('main h1').first().waitFor();await p.waitForLoadState('networkidle');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflow at '+width);
  if(width===320||width===1440){
   await p.evaluate(axe.source);
   const violations=await p.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
   assert.deepEqual(violations,[],label+' accessibility at '+width);
  }
  for(const photo of await p.locator('img[src*="sewak2-"]').all())await photo.scrollIntoViewIfNeeded();
  await p.waitForFunction(()=>[...document.querySelectorAll('img[src*="sewak2-"]')].every(img=>img.complete&&img.naturalWidth>0));
  const photos=await p.locator('img[src*="sewak2-"]').evaluateAll(images=>images.map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0})));
  assert.ok(photos.every(img=>img.loaded),label+' photographic assets');
  await p.screenshot({path:dir+'/'+label+'-'+width+'.png',fullPage:true,animations:'disabled'});
  views.push({label,width,photographs:photos.length});
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of report.widths){
  await page.setViewportSize({width,height:900});
  for(const [label,path] of [['public','/'],['browse','/browse'],['login','/auth'],['signup','/auth?mode=register']]){
   await page.goto(origin+path);await inspect(page,label,width);
  }
 }
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(origin+'/');
 const video=page.locator('video').first();await video.waitFor();
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 await page.getByRole('button',{name:'Pause background video',exact:true}).first().click();assert.equal(await video.evaluate(v=>v.paused),true);
 await page.getByRole('button',{name:'Play background video',exact:true}).first().click();
 await page.waitForFunction(()=>document.querySelector('video')?.paused===false);
 await page.emulateMedia({reducedMotion:'reduce'});await video.waitFor({state:'detached'});
 report.media={...report.media,liveActionVideo:true,pauseResume:true,reducedMotion:true,sameOrigin:true};
 const roles=[];
 for(const [u,paths] of [[customer,['/user/home','/user','/user/mybookings','/user/inbox','/user/notifications']],[caregiver,['/caregiver','/caregiver/jobs','/caregiver/inbox','/caregiver/notifications']],[org,['/organization','/organization?tab=caregivers','/organization?tab=bookings','/organization/notifications']],[admin,['/superadmin','/superadmin/caregivers','/superadmin/organizations','/superadmin/accounts']]]){
  const context=await browser.newContext();const rolePage=await context.newPage();rolePage.setDefaultTimeout(45000);
  rolePage.on('pageerror',error=>errors.push(error.message));await rolePage.emulateMedia({reducedMotion:'reduce'});
  await rolePage.goto(origin+'/auth');await rolePage.getByLabel('Email',{exact:true}).fill(u.email);await rolePage.getByLabel('Password',{exact:true}).fill(password);await rolePage.getByRole('button',{name:'Sign in',exact:true}).click();await rolePage.waitForURL(url=>url.pathname!=='/auth');
  for(const width of report.widths){await rolePage.setViewportSize({width,height:900});for(const [index,path]of paths.entries()){await rolePage.goto(origin+path);await inspect(rolePage,u.role+'-'+index,width);}}
  for(const width of [390,1440]){
   await rolePage.setViewportSize({width,height:900});await rolePage.emulateMedia({reducedMotion:'no-preference'});await rolePage.goto(origin+paths[0]);
   await rolePage.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
   await rolePage.getByRole('button',{name:'Pause background video',exact:true}).first().click();
   assert.equal(await rolePage.locator('video').first().evaluate(v=>v.paused),true);
   await rolePage.emulateMedia({reducedMotion:'reduce'});await rolePage.locator('video').waitFor({state:'detached'});
  }
  await rolePage.getByRole('button',{name:/Account menu for/}).click();await rolePage.getByRole('button',{name:/Logout/}).click();await rolePage.getByRole('button',{name:/Account menu for/}).waitFor({state:'hidden'});
  roles.push(u.role);await context.close();
 }
 report.verificationBrowser=await verifyVerificationViews(browser,{origin,worker,accounts:[{role:'caregiver',email:caregiver.email,password},{role:'admin',email:admin.email,password}]});
 assert.deepEqual(errors,[]);report.browser={publicWidths:report.widths,authenticatedRoles:roles,overflow:false,pageErrors:0,views,axeWidths:[320,1440]};
 const finalDeployment=(await cloudflare(root+'/deployments')).deployments[0];assert.equal(finalDeployment.versions[0].version_id,version,'Production changed during QA');
 report.checksPassed=true;
}catch(error){report.failure={name:error.name,message:error.message};}
finally{
 if(browser)await browser.close();
 try{
  for(const u of users){assert.match(u.uid,/^usr_[0-9a-f-]{36}$/);const row=await DB.prepare('SELECT email FROM users WHERE id=?').bind(u.uid).first();if(row)assert.equal(row.email,u.email);}
  await DB.prepare('DELETE FROM care_messages WHERE context_id=? AND customer_id=? AND caregiver_id=?').bind(bookingId,customer.uid,caregiver.uid).run();
  for(const u of users){for(const [table,column] of [['care_notifications','recipient_id'],['care_notification_preferences','user_id'],['care_membership_preferences','user_id']])await DB.prepare('DELETE FROM '+table+' WHERE '+column+'=?').bind(u.uid).run();}
  await DB.prepare('DELETE FROM bookings WHERE id=? AND user_id=? AND caregiver_id=?').bind(bookingId,customer.uid,caregiver.uid).run();
  for(const id of lifecycleIds)await DB.prepare('DELETE FROM bookings WHERE id=? AND user_id=? AND caregiver_id=?').bind(id,customer.uid,caregiver.uid).run();
  await DB.prepare('DELETE FROM caregiver_services WHERE caregiver_id=?').bind(caregiver.uid).run();
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
