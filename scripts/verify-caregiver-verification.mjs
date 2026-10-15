// Authorized live smoke: synthetic, unpublished caregivers; no real evidence.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {openTarget} from './d1-target.mjs';
import {cloudflare} from './cloudflare-operator.mjs';
import {targets,SEWAK_ACCOUNT,assertLiveBindings} from './deployment-policy.mjs';
import {controlledQaGmail,syntheticQaEmail} from './synthetic-qa-email.mjs';
import {entities,encodeRecord,insertSQL} from '../worker/src/model.mjs';
import {verifyVerificationViews} from './verification-browser-qa.mjs';

assert.ok(process.argv.includes('--apply-synthetic-qa'),'Explicit synthetic QA authorization required');
const worker=process.argv[process.argv.indexOf('--worker')+1];
assert.ok(Object.hasOwn(targets,worker),'Exact Sewak target required');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,SEWAK_ACCOUNT);
const target=targets[worker],staging=worker==='sewak',run=randomUUID(),accounts=[];
const gmail=staging?null:controlledQaGmail(process.env.SEWAK_QA_GMAIL);
const email=role=>syntheticQaEmail({role,run,staging,gmailBase:gmail});
const origin=`https://${worker}.nischalbachhar9.workers.dev`;
const database=await openTarget({remote:true,mainId:target.DB[1],mediaId:target.MEDIA_DB[1],evidenceId:target.EVIDENCE_DB[1]});
const {DB,EVIDENCE_DB}=database,checks=[],password=randomBytes(32).toString('base64url')+'Aa9!';
const report={worker,run,startedAt:new Date().toISOString(),pass:false,checks};
const privateTables=['verification_records','verification_submissions','verification_evidence','verification_decisions','verification_audit','verification_notifications'];
async function appHash(){
 const rows={};
 for(const table of [...new Set(Object.values(entities).map(e=>e.table)),...privateTables])rows[table]=(await DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results;
 rows.evidence=(await EVIDENCE_DB.prepare('SELECT id,length(ciphertext) bytes FROM evidence_blobs ORDER BY id').all()).results;
 return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
async function request(path,token,{body,method=body?'POST':'GET',type='application/json',expected=200}={}){
 const response=await fetch(origin+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':type}:{})},...(body?{body:type==='application/json'?JSON.stringify(body):body}:{}),signal:AbortSignal.timeout(45000),redirect:'error'});
 const data=response.headers.get('content-type')?.includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer());
 checks.push({path:path.split('?')[0],method,status:response.status});
 assert.equal(response.status,expected,`${method} ${path.split('?')[0]}: ${response.status}; code=${data?.error?.code||'none'}`);
 return {response,data};
}
const before=await appHash();let browser;
try{
 const base=`/accounts/${SEWAK_ACCOUNT}/workers/scripts/${worker}`;
 assertLiveBindings(worker,(await cloudflare(base+'/settings')).bindings,!staging,{requireEvidence:true});
 const deployments=(await cloudflare(base+'/deployments')).deployments[0];
 assert.equal(deployments.versions.length,1);assert.equal(deployments.versions[0].percentage,100);report.version=deployments.versions[0].version_id;
 assert.equal((await request('/api/health')).data.writesEnabled,!staging);
 for(const role of ['caregiver','superadmin']){
  const {data}=await request('/api/auth/register',null,{body:{email:email(role),password,name:'Unpublished verification QA',sessionMode:'bearer'}});
  const user={role,email:email(role),uid:data.user.uid,token:data.token};accounts.push(user);
  assert.match(user.uid,/^usr_[0-9a-f-]{36}$/i);
  await DB.prepare('UPDATE users SET role=?,profile_complete=1,version=version+1 WHERE id=? AND email=?').bind(role,user.uid,user.email).run();
 }
 const [caregiver,admin]=accounts,uid=caregiver.uid;
 const encoded=encodeRecord('vendors',uid,{uid,name:'Unpublished verification QA',phone:'+9779800000000',isApproved:false,isAvailable:false,category:'both',profileComplete:true},1);
 const insert=insertSQL('vendors',encoded,'upsert');await DB.prepare(insert.sql).bind(...insert.params).run();
 await request('/api/verification/me',caregiver.token);
 await request('/api/verification/queue',caregiver.token,{expected:403});
 if(staging){
  await request('/api/verification/submit/phone',caregiver.token,{body:{},expected:503});
 }else{
  const require=createRequire(new URL('../worker/package.json',import.meta.url));
  const photo=await require('sharp')({create:{width:1400,height:1000,channels:3,background:'#dfe7dd'}}).webp().toBuffer();
  const details={identity:{legalName:'SYNTHETIC TEST ONLY',documentType:'passport',documentNumber:'SYNTHETIC-'+run},phone:{phone:'+9779800000000'},training:{institution:'Synthetic fixture',course:'Synthetic first aid',category:'first_aid',completedAt:'2026-01-01'},background:{documentType:'police_clearance',referenceNumber:'SYNTHETIC-'+run,issuedAt:'2026-01-01'},references:{references:[{name:'Synthetic contact A',phone:'+9779800000001',relationship:'Test fixture'},{name:'Synthetic contact B',phone:'+9779800000002',relationship:'Test fixture'}]}};
  const methods={identity:'manual_document_review',phone:'manual_phone_call',training:'manual_qualification_review',background:'nepal_police_portal_manual',references:'manual_reference_contact'};
  let identityImage;
  for(const kind of Object.keys(details)){
   const evidenceIds=[];
   if(['identity','training','background'].includes(kind)){
    const {data}=await request('/api/verification/evidence?kind='+kind,caregiver.token,{method:'PUT',type:'image/webp',body:photo});evidenceIds.push(data.id);
    const stored=await EVIDENCE_DB.prepare('SELECT typeof(ciphertext) type,length(ciphertext) size FROM evidence_blobs WHERE id=?').bind(data.id).first();assert.equal(stored.type,'blob');assert.equal(stored.size,photo.length+29);
    const preview=await request('/api/verification/evidence/'+data.id,admin.token);assert.deepEqual(preview.data,photo);assert.equal(preview.response.headers.get('cache-control'),'private, no-store');
    await request('/api/verification/evidence/'+data.id,null,{expected:401});
    if(kind==='identity')identityImage=data.id;
   }
   await request('/api/verification/submit/'+kind,caregiver.token,{body:{version:0,requestId:randomUUID(),details:details[kind],evidenceIds,consent:true,readable:true}});
   await request(`/api/verification/review/${uid}/${kind}`,admin.token,{body:{version:1,decision:'under_review',confirmed:true}});
   await request(`/api/verification/review/${uid}/${kind}`,admin.token,{body:{version:2,decision:'verified',confirmed:true,method:methods[kind],outcome:'SYNTHETIC QA ONLY. No real document, call or police match claimed.',...(kind==='background'?{policeResult:'matched'}:{}),...(kind==='references'?{referenceConfirmations:[0,1].map(index=>({index,confirmed:true,notes:'SYNTHETIC test fixture only.'}))}:{})}});
  }
  const own=(await request('/api/verification/me',caregiver.token)).data;assert.equal(own.records.filter(r=>r.status==='verified').length,5);
  const hidden=(await request('/api/records/publicCaregivers/'+uid,null)).data;assert.deepEqual(hidden.items,[]);assert.ok(!JSON.stringify(hidden).includes('SYNTHETIC-'+run));
  await request(`/api/verification/review/${uid}/identity`,admin.token,{body:{version:2,decision:'rejected',reason:'Stale decision rejected.',confirmed:true},expected:409});
  await request('/api/verification/evidence/'+identityImage,caregiver.token,{method:'DELETE'});
  assert.equal((await DB.prepare("SELECT status FROM verification_records WHERE caregiver_id=? AND kind='identity'").bind(uid).first()).status,'revoked');
  await DB.prepare('UPDATE caregivers SET phone=?,version=version+1 WHERE id=?').bind('+9779800000003',uid).run();
  assert.equal((await DB.prepare("SELECT status FROM verification_records WHERE caregiver_id=? AND kind='phone'").bind(uid).first()).status,'revoked');
 }
 const {chromium}=await import('@playwright/test');browser=await chromium.launch({channel:'chrome',headless:true});
 report.browser=await verifyVerificationViews(browser,{origin,worker,accounts:[{role:'caregiver',email:caregiver.email,password},{role:'admin',email:admin.email,password}]});report.checksPassed=true;
}catch(error){report.failure={name:error.name,message:error.message};}
finally{
 if(browser)await browser.close();
 try{
  for(const role of ['caregiver','superadmin']){const row=await DB.prepare('SELECT id FROM users WHERE email=?').bind(email(role)).first();if(row&&!accounts.some(u=>u.uid===row.id))accounts.push({role,uid:row.id,email:email(role)});}
  for(const user of accounts){
   assert.equal(user.email,email(user.role));assert.match(user.uid,/^usr_[0-9a-f-]{36}$/i);
   const photos=(await DB.prepare('SELECT id FROM verification_evidence WHERE caregiver_id=?').bind(user.uid).all()).results;
   for(const photo of photos){await EVIDENCE_DB.prepare('DELETE FROM evidence_blobs WHERE id=?').bind(photo.id).run();await EVIDENCE_DB.prepare('DELETE FROM evidence_tombstones WHERE id=?').bind(photo.id).run();}
   await DB.batch(['verification_notifications','verification_audit','verification_decisions','verification_records','verification_evidence','verification_submissions'].map(table=>DB.prepare(`DELETE FROM ${table} WHERE caregiver_id=?`).bind(user.uid)));
   await DB.batch([DB.prepare('DELETE FROM caregiver_services WHERE caregiver_id=?').bind(user.uid),DB.prepare('DELETE FROM caregivers WHERE id=?').bind(user.uid),DB.prepare('DELETE FROM cf_invitations WHERE user_id=?').bind(user.uid),DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind(user.uid),DB.prepare('DELETE FROM cf_credentials WHERE user_id=? AND email=?').bind(user.uid,user.email),DB.prepare('DELETE FROM users WHERE id=? AND email=?').bind(user.uid,user.email)]);
   assert.equal(await DB.prepare('SELECT id FROM users WHERE id=?').bind(user.uid).first(),null);
  }
  assert.equal(await appHash(),before,'Existing application and verification records must remain unchanged');
  for(const db of [DB,EVIDENCE_DB])assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  report.cleanupVerified=true;report.applicationRecordsUnchanged=true;
 }catch(error){report.cleanupFailure={name:error.name,message:error.message};}
 report.pass=Boolean(report.checksPassed&&report.cleanupVerified);report.completedAt=new Date().toISOString();mkdirSync('.local-tools/cloudflare-auth',{recursive:true});const output=`.local-tools/cloudflare-auth/${worker}-verification-${run}.json`;writeFileSync(output,JSON.stringify(report,null,2));await database.close();console.log(JSON.stringify({pass:report.pass,worker,version:report.version,checks:checks.length,cleanupVerified:report.cleanupVerified,report:output,...(report.failure?{failure:report.failure}:{}),...(report.cleanupFailure?{cleanupFailure:report.cleanupFailure}:{})}));if(!report.pass)process.exitCode=1;
}
