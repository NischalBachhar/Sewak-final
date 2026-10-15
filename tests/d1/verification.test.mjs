import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { environment, seed, put, call } from './harness.mjs';
import { encryptEvidence, decryptEvidence } from '../../worker/src/verification-crypto.ts';
import { verificationMaintenance } from '../../worker/src/verification.ts';
import { nepalPhone } from '../../worker/src/verification-validation.ts';
import { createWorker } from '../../worker/src/index.ts';
const require=createRequire(new URL('../../worker/package.json',import.meta.url));
const sharp=require('sharp');
const photo=await sharp({create:{width:1200,height:900,channels:3,background:'#e8e1d3'}}).webp().toBuffer();
const details={identity:{legalName:'Private Legal Name',documentType:'citizenship',documentNumber:'PRIVATE-123'},phone:{phone:'+9779800000000'},training:{institution:'Test Institute',course:'First aid',category:'first_aid',completedAt:'2025-01-01',expiresAt:''},background:{documentType:'police_clearance',referenceNumber:'POLICE-PRIVATE',issuedAt:'2025-01-01'},references:{references:[{name:'Reference One',phone:'9800000001',email:'one@example.test',relationship:'Former employer'},{name:'Reference Two',phone:'9800000002',email:'',relationship:'Supervisor'}]}};
const methods={identity:'manual_document_review',phone:'manual_phone_call',training:'manual_qualification_review',background:'nepal_police_portal_manual',references:'manual_reference_contact'};
async function setup(){const env=environment();const records=await seed(env);await put(env,'vendors/caregiver',{...records['vendors/caregiver'],phone:'+9779800000000'});return env;}
const upload=(env,kind='identity',body=photo,type='image/webp',uid='caregiver')=>call(env,'/api/verification/evidence?kind='+kind,{uid,method:'PUT',body,type});
async function submission(env,kind='identity',version=0,extra={}) {
  const evidenceIds=[];if(['identity','training','background'].includes(kind)){const r=await upload(env,kind);assert.equal(r.status,200,JSON.stringify(r.data));evidenceIds.push(r.data.id);}
  return call(env,'/api/verification/submit/'+kind,{uid:'caregiver',method:'POST',json:{version,requestId:crypto.randomUUID(),details:details[kind],evidenceIds,consent:true,readable:true,...extra}});
}
const review=(env,kind,version,decision,extra={})=>call(env,'/api/verification/review/caregiver/'+kind,{uid:'admin',method:'POST',json:{version,decision,confirmed:true,reason:decision==='rejected'||decision==='revoked'?'Evidence did not satisfy review requirements.':'',method:methods[kind],outcome:'Manual evidence check completed.',policeResult:'matched',referenceConfirmations:kind==='references'?[{index:0,confirmed:true,notes:'Contact confirmed prior work.'},{index:1,confirmed:true,notes:'Contact confirmed qualifications.'}]:[],...extra}});
async function approve(env,kind){let r=await submission(env,kind);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal((await review(env,kind,1,'under_review')).status,200);r=await review(env,kind,2,'verified');assert.equal(r.status,200,JSON.stringify(r.data));return r;}
const getPublic=async env=>(await call(env,'/api/records/publicCaregivers/caregiver')).data.items[0].data;

for(const kind of Object.keys(details))test(`${kind}: submission, manual review, approval and private/public isolation`,async()=>{
  const env=await setup();await approve(env,kind);const p=await getPublic(env);
  assert.equal(p[kind+'VerificationStatus'],'verified');assert.equal(p.verified,false);
  assert.equal(p.policeClearanceVerificationStatus,kind==='background'?'verified':'not_submitted');
  assert.doesNotMatch(JSON.stringify(p),/PRIVATE|Reference One|9800000001|Manual evidence/);
  const row=env.DB.database.prepare('SELECT typeof(details) type,details FROM verification_submissions').get();assert.equal(row.type,'blob');assert.ok(!Buffer.from(row.details).includes(Buffer.from(JSON.stringify(details[kind]))));
  assert.equal(env.DB.database.prepare('SELECT COUNT(*) n FROM verification_audit WHERE action=\'verified\'').get().n,1);
  assert.equal(env.DB.database.prepare('SELECT COUNT(*) n FROM verification_notifications WHERE recipient_id=\'caregiver\'').get().n,3);
});
test('all five audited checks are required for the overall badge; legacy flags never qualify',async()=>{
  const env=await setup();await env.DB.prepare('UPDATE caregivers SET verified=1,background_checked=1,is_certified=1,identity_verification_status=\'verified\'').run();
  let p=await getPublic(env);assert.equal(p.verified,false);assert.equal(p.identityVerificationStatus,'not_submitted');
  for(const kind of Object.keys(details))await approve(env,kind);
  p=await getPublic(env);assert.equal(p.verified,true);assert.equal(p.isCertified,true);
});
test('upload is not verification and generic admin updates cannot grant any trusted field',async()=>{
  const env=await setup();await upload(env);assert.equal((await getPublic(env)).identityVerificationStatus,'not_submitted');
  for(const [key,value]of Object.entries({verified:true,backgroundChecked:true,isCertified:true,identityVerificationStatus:'verified',phoneVerificationStatus:'verified',trainingVerificationStatus:'verified',backgroundVerificationStatus:'verified',referencesVerificationStatus:'verified',verificationSource:'audited_v1',policeClearanceVerificationStatus:'verified'})){
    const r=await call(env,'/api/commit',{uid:'admin',method:'POST',json:{writes:[{path:'vendors/caregiver',kind:'update',data:{[key]:value}}]}});assert.equal(r.status,403,key);
  }
});
test('rejection and more information permit audited resubmission while duplicate pending submissions fail',async()=>{
  const env=await setup();const first=await submission(env,'identity');assert.equal(first.status,200);
  assert.equal((await submission(env,'identity',1)).status,409);
  assert.equal((await review(env,'identity',1,'verified')).status,400);
  await review(env,'identity',1,'under_review');assert.equal((await review(env,'identity',2,'rejected',{reason:''})).status,400);
  assert.equal((await review(env,'identity',2,'rejected')).status,200);
  assert.equal((await submission(env,'identity',3)).status,200);
  await review(env,'identity',4,'under_review');assert.equal((await review(env,'identity',5,'more_information_required',{reason:'Please retake the back of your document.'})).status,200);
  assert.equal((await submission(env,'identity',6)).status,200);
  assert.equal(env.DB.database.prepare("SELECT COUNT(*) n FROM verification_evidence WHERE state='deleting'").get().n,2);
});
test('expired certificates and malformed dates cannot be submitted; approval respects certificate expiry',async()=>{
  const env=await setup();for(const expiresAt of ['2020-01-01','2099-02-30'])assert.equal((await submission(env,'training',0,{details:{...details.training,expiresAt}})).status,400);
  const expiresAt=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
  assert.equal((await submission(env,'training',0,{details:{...details.training,expiresAt}})).status,200);
  await review(env,'training',1,'under_review');assert.equal((await review(env,'training',2,'verified')).status,200);
  assert.equal(env.DB.database.prepare("SELECT expires_at FROM verification_records WHERE kind='training'").get().expires_at,expiresAt+'T23:59:59.999Z');
});
test('expiry immediately removes public badges and maintenance emits exactly one expiry notification',async()=>{
  const env=await setup();await approve(env,'training');await env.DB.prepare("UPDATE verification_records SET expires_at='2020-01-01T00:00:00.000Z' WHERE kind='training'").run();
  assert.equal((await getPublic(env)).trainingVerificationStatus,'expired');await verificationMaintenance(env);await verificationMaintenance(env);
  assert.equal(env.DB.database.prepare("SELECT COUNT(*) n FROM verification_notifications WHERE status='expired' AND recipient_id='caregiver'").get().n,1);
  assert.equal((await submission(env,'training',4)).status,200);
});
test('revocation requires a reason and confirmation and removes police badge',async()=>{
  const env=await setup();await approve(env,'background');assert.equal((await review(env,'background',3,'revoked',{confirmed:false})).status,400);assert.equal((await review(env,'background',3,'revoked',{reason:''})).status,400);
  assert.equal((await review(env,'background',3,'revoked')).status,200);assert.equal((await getPublic(env)).policeClearanceVerificationStatus,'revoked');
});
test('Nepal Police requires official manual match; other background evidence cannot produce police badge',async()=>{
  const env=await setup();await submission(env,'background');await review(env,'background',1,'under_review');
  assert.equal((await review(env,'background',2,'verified',{policeResult:'unavailable'})).status,400);
  assert.equal((await review(env,'background',2,'verified',{method:'automated_government_api'})).status,400);
  await review(env,'background',2,'rejected');await submission(env,'background',3,{details:{documentType:'other_background',referenceNumber:'TEST',issuedAt:'2025-01-01',issuer:'Former employer'}});await review(env,'background',4,'under_review');
  assert.equal((await review(env,'background',5,'verified',{method:'manual_background_review'})).status,200);assert.equal((await getPublic(env)).policeClearanceVerificationStatus,'not_submitted');
});
test('every reference must be contacted and confirmed, and contacts never leak to the organization',async()=>{
  const env=await setup();await submission(env,'references');await review(env,'references',1,'under_review');assert.equal((await review(env,'references',2,'verified',{referenceConfirmations:[]})).status,400);
  assert.equal((await call(env,'/api/verification/caregiver/caregiver',{uid:'org'})).status,403);
  const r=await call(env,'/api/verification/progress/caregiver',{uid:'org'});assert.equal(r.status,200);assert.doesNotMatch(JSON.stringify(r.data),/Reference One|9800000001|example.test/);
});
for(const collection of ['vendors','users'])test(`${collection} phone changes atomically revoke approval and invalidate stale reviews`,async()=>{
  const env=await setup();await approve(env,'phone');
  const r=await call(env,'/api/commit',{uid:'caregiver',method:'POST',json:{writes:[{path:collection+'/caregiver',kind:'update',data:{phone:'+9779810000000'}}]}});assert.equal(r.status,200,JSON.stringify(r.data));
  assert.equal((await getPublic(env)).phoneVerificationStatus,'revoked');assert.equal((await review(env,'phone',3,'revoked')).status,409);
});
test('Nepal mobile validation and phone profile matching reject forged verification',async()=>{
  assert.equal(nepalPhone('9800000000'),'+9779800000000');assert.equal(nepalPhone('+977 9800000000'),'+9779800000000');
  for(const phone of ['123','+919800000000','+9771234567890','98400000000'])assert.throws(()=>nepalPhone(phone));
  const env=await setup();assert.equal((await submission(env,'phone',0,{details:{phone:'9810000000'}})).status,400);
});
test('500,000-byte server limit, invalid signatures, metadata, low dimensions and wrong MIME are rejected',async()=>{
  const env=await setup();assert.equal((await upload(env,'identity',Buffer.alloc(500001))).status,413);
  assert.equal((await upload(env,'identity',Buffer.from('%PDF-1.7'),'image/jpeg')).status,400);
  assert.equal((await upload(env,'identity',photo,'image/jpeg')).status,400);
  assert.equal((await upload(env,'identity',await sharp(photo).resize(500,500).webp().toBuffer())).status,400);
  const exif=await sharp(photo).withMetadata().jpeg().toBuffer();assert.equal((await upload(env,'identity',exif,'image/jpeg')).status,400);
  assert.equal((await upload(env)).status,200);
});
test('encryption is binary, random, context-bound and detects modification; authorized download round-trips',async()=>{
  const env=await setup();const a=await encryptEvidence(env,photo,'context'),b=await encryptEvidence(env,photo,'context');assert.notDeepEqual(Buffer.from(a),Buffer.from(b));assert.deepEqual(Buffer.from(await decryptEvidence(env,a,'context')),photo);
  await assert.rejects(decryptEvidence(env,a,'other'));const broken=new Uint8Array(a);broken[50]^=1;await assert.rejects(decryptEvidence(env,broken,'context'));
  const uploaded=await upload(env);const id=uploaded.data.id;const row=env.EVIDENCE_DB.database.prepare('SELECT typeof(ciphertext) type,ciphertext FROM evidence_blobs').get();assert.equal(row.type,'blob');assert.notDeepEqual(Buffer.from(row.ciphertext),photo);
  const response=await call(env,'/api/verification/evidence/'+id,{uid:'caregiver'});assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.response.arrayBuffer()),photo);assert.match(response.response.headers.get('Cache-Control'),/no-store/);assert.equal(env.MEDIA_DB.database.prepare('SELECT COUNT(*) n FROM media').get().n,0);
});
test('anonymous, cross-user, organization and inactive admin document access is denied',async()=>{
  const env=await setup(),id=(await upload(env)).data.id;
  for(const uid of [undefined,'other','org'])assert.ok([401,403].includes((await call(env,'/api/verification/evidence/'+id,{uid})).status));
  assert.equal((await call(env,'/api/verification/evidence/'+id,{uid:'admin'})).status,200);
  await env.DB.prepare('UPDATE users SET is_suspended=1 WHERE id=\'admin\'').run();assert.equal((await call(env,'/api/verification/evidence/'+id,{uid:'admin'})).status,403);
});
test('only active superadmins can decide and nobody can approve their own checks',async()=>{
  const env=await setup();await submission(env,'phone');for(const uid of ['caregiver','org','other'])assert.equal((await call(env,'/api/verification/review/caregiver/phone',{uid,method:'POST',json:{version:1,decision:'under_review',confirmed:true}})).status,403);
  await env.DB.prepare("UPDATE users SET role='superadmin' WHERE id='caregiver'").run();assert.equal((await call(env,'/api/verification/review/caregiver/phone',{uid:'caregiver',method:'POST',json:{version:1,decision:'under_review',confirmed:true}})).status,403);
});
test('cross-organization progress and evidence attachment are denied',async()=>{
  const env=await setup();await put(env,'users/otherorg',{uid:'otherorg',role:'orgadmin'});await put(env,'organizations/otherorg',{organizationId:'otherorg',isApproved:true});
  assert.equal((await call(env,'/api/verification/progress/caregiver',{uid:'otherorg'})).status,403);
  const id=(await upload(env,'training')).data.id;assert.equal((await submission(env,'identity',0,{evidenceIds:[id]})).status,409);
});
test('maximum two photos per submission and eight active images are enforced atomically',async()=>{
  const env=await setup();const ids=[];for(let i=0;i<8;i++){const r=await upload(env);assert.equal(r.status,200);ids.push(r.data.id);}assert.equal((await upload(env)).status,409);
  const r=await call(env,'/api/verification/submit/identity',{uid:'caregiver',method:'POST',json:{version:0,requestId:crypto.randomUUID(),details:details.identity,evidenceIds:ids.slice(0,3),consent:true,readable:true}});assert.equal(r.status,400);
});
test('concurrent/stale decisions commit exactly one status, decision and notification set',async()=>{
  const env=await setup();await submission(env,'phone');await review(env,'phone',1,'under_review');
  // Two overlapping requests validate the same version before D1 serializes batches.
  const original=env.DB.batch;let waiting=null;
  env.DB.batch=async statements=>{const prior=waiting;let release;waiting=new Promise(r=>release=r);if(prior)await prior;try{return await original(statements);}finally{release();}};
  const results=await Promise.all([review(env,'phone',2,'verified'),review(env,'phone',2,'rejected')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(env.DB.database.prepare('SELECT COUNT(*) n FROM verification_decisions').get().n,2);
});
test('duplicate request IDs, forged successful statuses and missing consent are rejected',async()=>{
  const env=await setup(),requestId=crypto.randomUUID();assert.equal((await submission(env,'phone',0,{requestId})).status,200);assert.equal((await submission(env,'phone',1,{requestId})).status,409);
  assert.equal((await submission(env,'references',0,{status:'verified'})).status,400);assert.equal((await submission(env,'references',0,{consent:false})).status,400);
});
test('evidence withdrawal revokes, deletes binary data and prevents late resurrection',async()=>{
  const env=await setup();await approve(env,'identity');const id=env.DB.database.prepare('SELECT id FROM verification_evidence').get().id;
  assert.equal((await call(env,'/api/verification/evidence/'+id,{uid:'caregiver',method:'DELETE'})).status,200);assert.equal((await getPublic(env)).identityVerificationStatus,'revoked');assert.equal(env.EVIDENCE_DB.database.prepare('SELECT COUNT(*) n FROM evidence_blobs').get().n,0);
  assert.equal((await call(env,'/api/verification/evidence/'+id,{uid:'admin'})).status,410);
  await assert.rejects(env.EVIDENCE_DB.prepare('INSERT INTO evidence_blobs VALUES(?,?,?)').bind(id,new Uint8Array([1,2]).buffer,new Date().toISOString()).run(),/deleted/);
});
test('cross-database upload and delete failures recover without granting a badge or losing quota accounting',async()=>{
  const env=await setup();const prepare=env.EVIDENCE_DB.prepare;
  env.EVIDENCE_DB.prepare=()=>{throw new Error('simulated evidence database offline');};assert.equal((await upload(env)).status,503);
  assert.equal(env.DB.database.prepare("SELECT COUNT(*) n FROM verification_evidence WHERE state='uploading'").get().n,1);env.EVIDENCE_DB.prepare=prepare;
  await env.DB.prepare("UPDATE verification_evidence SET retain_until='2020-01-01'").run();await verificationMaintenance(env);
  assert.equal(env.DB.database.prepare("SELECT COUNT(*) n FROM verification_evidence WHERE state='deleted'").get().n,1);
  const id=(await upload(env)).data.id;env.EVIDENCE_DB.prepare=()=>{throw new Error('simulated deletion failure');};assert.equal((await call(env,'/api/verification/evidence/'+id,{uid:'caregiver',method:'DELETE'})).status,503);
  env.EVIDENCE_DB.prepare=prepare;await verificationMaintenance(env);assert.equal(env.EVIDENCE_DB.database.prepare('SELECT COUNT(*) n FROM evidence_blobs').get().n,0);
});
test('retention purges encrypted details and photos but preserves the decision audit',async()=>{
  const env=await setup();await approve(env,'identity');await env.DB.prepare("UPDATE verification_evidence SET retain_until='2020-01-01'").run();await env.DB.prepare("UPDATE verification_submissions SET retain_until='2020-01-01'").run();await env.DB.prepare("UPDATE verification_records SET expires_at='2020-01-01'").run();await verificationMaintenance(env);
  assert.equal(env.DB.database.prepare('SELECT details FROM verification_submissions').get().details,null);assert.equal(env.DB.database.prepare('SELECT details FROM verification_decisions LIMIT 1').get().details,null);assert.ok(env.DB.database.prepare('SELECT COUNT(*) n FROM verification_audit').get().n>=4);assert.equal(env.EVIDENCE_DB.database.prepare('SELECT used_bytes FROM evidence_capacity').get().used_bytes,0);
});
test('review states keep their retention deadline and expired private notes are hidden before cleanup',async()=>{
  const env=await setup();await submission(env,'phone');await review(env,'phone',1,'under_review');
  const before=env.DB.database.prepare('SELECT expires_at FROM verification_records').get();assert.ok(before.expires_at);
  await review(env,'phone',2,'more_information_required',{reason:'Please confirm your available call time.'});assert.ok(env.DB.database.prepare('SELECT expires_at FROM verification_records').get().expires_at);
  await env.DB.prepare("UPDATE verification_submissions SET retain_until='2020-01-01'").run();await env.DB.prepare("UPDATE verification_records SET expires_at='2020-01-01'").run();
  const result=await call(env,'/api/verification/caregiver/caregiver',{uid:'admin'});assert.equal(result.data.records[0].status,'expired');assert.equal(result.data.submissions[0].details,null);assert.ok(result.data.decisions.every(d=>d.details===null));
  await verificationMaintenance(env);assert.equal(env.DB.database.prepare('SELECT status FROM verification_records').get().status,'expired');
});
test('read-only mode, unavailable key/storage and free storage cap fail closed',async()=>{
  const env=await setup();env.APP_WRITES_ENABLED='false';assert.equal((await upload(env)).status,503);assert.equal((await submission(env,'phone')).status,503);env.APP_WRITES_ENABLED='true';delete env.VERIFICATION_ENCRYPTION_KEY;assert.equal((await upload(env)).status,503);
  env.VERIFICATION_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64url');await env.EVIDENCE_DB.prepare('UPDATE evidence_capacity SET used_bytes=399999999').run();assert.equal((await upload(env)).status,503);assert.equal(env.EVIDENCE_DB.database.prepare('SELECT COUNT(*) n FROM evidence_blobs').get().n,0);
});
test('CSRF and foreign origins cannot mutate verification',async()=>{
  const env=await setup();const worker=createWorker(async()=>({uid:'caregiver',email:'test@example.test',authTime:Date.now()/1000,transport:'cookie',csrfToken:'expected'}));
  for(const origin of ['https://evil.example','http://localhost']){const r=await worker.fetch(new Request('http://localhost/api/verification/submit/phone',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'}),env);assert.equal(r.status,403);}
});
test('queue supports filters, search, pagination and recipient-specific notification reads',async()=>{
  const env=await setup();await submission(env,'phone');let r=await call(env,'/api/verification/queue?status=pending&kind=phone&search=Caregiver',{uid:'admin'});assert.equal(r.status,200);assert.equal(r.data.items.length,1);
  r=await call(env,'/api/verification/queue?status=pending&page=1',{uid:'admin'});assert.equal(r.data.items.length,0);
  assert.equal((await call(env,'/api/verification/queue',{uid:'org'})).status,403);
  const admin=(await call(env,'/api/verification/notifications',{uid:'admin'})).data.items;assert.equal(admin.length,1);assert.equal((await call(env,'/api/verification/notifications',{uid:'other'})).data.items.length,0);
  await call(env,'/api/verification/notifications',{uid:'caregiver',method:'POST',json:{id:admin[0].id}});assert.equal(env.DB.database.prepare('SELECT read_at FROM verification_notifications WHERE id=?').get(admin[0].id).read_at,null);
});
