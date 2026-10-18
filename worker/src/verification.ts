import { Repository, requireActive, requireAdmin } from './repository.ts';
import { caregiverActive, organizationActive } from './policy.ts';
import { boundedBytes } from './media.ts';
import { inspectImage } from './image-validation.mjs';
import { decryptDetails, decryptEvidence, encryptDetails, encryptEvidence } from './verification-crypto.ts';
import { kindValue, nepalPhone, trustedVerification, validateSubmission, verificationStatuses } from './verification-validation.ts';
import { ApiError, badInput, nowISO, onlyKeys, requireThat, textField, type Actor, type Data, type Env } from './types.ts';

const day = 86400000;
const days = (value: string|undefined, fallback: number, max: number) => Math.min(max,Math.max(1,Math.floor(Number(value)||fallback)));
const deadline = (count: number) => new Date(Date.now()+count*day).toISOString();
const conflict = (value: unknown) => requireThat(value,'This verification changed. Refresh before trying again.',409,'aborted');
const privateContext = (type:string,id:string,uid:string) => `sewak-verification-v1:${type}:${uid}:${id}`;
function storage(env: Env) { requireThat(env.EVIDENCE_DB && env.VERIFICATION_ENCRYPTION_KEY,'Private verification storage is not configured.',503,'verification-unavailable'); return env.EVIDENCE_DB; }
function guard(repo: Repository, sql: string, params: any[]) {
  const id='verification:'+crypto.randomUUID();
  return [repo.env.DB.prepare(`INSERT INTO commit_guards(id,valid) VALUES(?,(${sql}))`).bind(id,...params),repo.env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind(id)];
}
function audit(repo:Repository,uid:string,kind:string,submission:string|null,actor:string,action:string,version:number) {
  return repo.env.DB.prepare('INSERT INTO verification_audit(caregiver_id,kind,submission_id,actor_id,action,version,created_at) VALUES(?,?,?,?,?,?,?)').bind(uid,kind,submission,actor,action,version,nowISO());
}
async function owner(repo:Repository,actor:Actor|null,uid:string,admin=false) {
  const user=requireActive(actor);
  requireThat(user.uid===uid || admin&&user.role==='superadmin');
  const caregiver=await repo.data(`vendors/${uid}`);
  requireThat(caregiver,'Caregiver not found.',404,'not-found');
  if(user.role!=='superadmin')requireThat(await caregiverActive(repo,uid,false),'This caregiver account is not active.');
  return {user,caregiver};
}
async function record(repo:Repository,uid:string,kind:string) {
  return repo.env.DB.prepare('SELECT * FROM verification_records WHERE caregiver_id=? AND kind=?').bind(uid,kind).first<Data>();
}
function effective(row:Data) { return ['verified','pending','under_review','more_information_required'].includes(row.status)&&row.expires_at&&row.expires_at<=nowISO()?{...row,status:'expired'}:row; }

async function upload(request:Request,repo:Repository,actor:Actor|null,kind:string) {
  const user=requireActive(actor); await owner(repo,user,user.uid); const evidenceDb=storage(repo.env);
  badInput(kind!=='phone','Phone verification does not need a photo.');
  const bytes=await boundedBytes(request,500000);
  let info;try{info=inspectImage(bytes,request.headers.get('Content-Type')||'',{maxBytes:500000,maxDimension:4096});}
  catch{throw new ApiError(400,'invalid-image','Use a valid, metadata-free JPEG or WebP, at most 500,000 bytes.');}
  badInput(Math.min(info.width,info.height)>=600,'The document is too small to review. Upload a clearer image (at least 600 pixels on each side).');
  const id=crypto.randomUUID(),now=nowISO(),until=deadline(1);
  const ciphertext=await encryptEvidence(repo.env,bytes,privateContext('image',id,user.uid));
  const cap=days(repo.env.VERIFICATION_MAX_IMAGES,8,8);
  const usage=await repo.env.DB.prepare("SELECT COUNT(CASE WHEN state<>'deleted' THEN 1 END) active,COUNT(CASE WHEN created_at>? THEN 1 END) daily FROM verification_evidence WHERE caregiver_id=?").bind(new Date(Date.now()-day).toISOString(),user.uid).first<Data>();
  requireThat(usage!.active<cap,`You have reached the ${cap}-photo limit. Withdraw an old photo in Manage private evidence before uploading.`,409,'image-quota');
  requireThat(usage!.daily<30,'Daily photo upload limit reached. Try again after 24 hours.',429,'upload-limit');
  await repo.commit([], [
    ...guard(repo,'SELECT COUNT(*)<? FROM verification_evidence WHERE caregiver_id=? AND state<>\'deleted\'',[cap,user.uid]),
    ...guard(repo,'SELECT COUNT(*)<30 FROM verification_evidence WHERE caregiver_id=? AND created_at>?',[user.uid,new Date(Date.now()-day).toISOString()]),
    repo.env.DB.prepare('INSERT INTO verification_evidence(id,caregiver_id,kind,state,mime,size,width,height,created_at,retain_until) VALUES(?,?,?,\'uploading\',?,?,?,?,?,?)').bind(id,user.uid,kind,info.mime,info.size,info.width,info.height,now,until),
    audit(repo,user.uid,kind,null,user.uid,'upload_reserved',0)
  ]);
  // Reservation precedes the cross-database write. An ambiguous failure leaves
  // a bounded reservation; maintenance deletes the BLOB before releasing quota.
  try {
    await evidenceDb.prepare('INSERT INTO evidence_blobs(id,ciphertext,created_at) VALUES(?,?,?)').bind(id,ciphertext,now).run();
    await repo.commit([], [
      ...guard(repo,"SELECT EXISTS(SELECT 1 FROM verification_evidence WHERE id=? AND state='uploading')",[id]),
      repo.env.DB.prepare("UPDATE verification_evidence SET state='ready' WHERE id=?").bind(id)
    ]);
  } catch(error) {
    // Never delete on an uncertain commit acknowledgement: the server's ready
    // state may already be durable. Its short TTL and maintenance recover it.
    if(error instanceof ApiError)throw error;
    throw new ApiError(503,'evidence-unavailable','Upload could not be completed. Refresh your evidence list before retrying; unfinished uploads expire within 24 hours.');
  }
  return {id,...info,state:'ready'};
}

async function submit(repo:Repository,actor:Actor|null,kind:string,body:Data) {
  const user=requireActive(actor),{caregiver}=await owner(repo,user,user.uid);storage(repo.env);
  onlyKeys(body,['version','requestId','details','evidenceIds','consent','readable']);
  badInput(body.consent===true,'Consent is required to process verification evidence.');
  badInput(Number.isInteger(body.version)&&body.version>=0,'Refresh the verification before submitting.');
  badInput(typeof body.requestId==='string'&&/^[\da-f-]{36}$/.test(body.requestId),'Invalid submission request ID.');
  const details=validateSubmission(kind,body.details);
  badInput(Array.isArray(body.evidenceIds)&&body.evidenceIds.length<=2&&new Set(body.evidenceIds).size===body.evidenceIds.length&&body.evidenceIds.every((id:unknown)=>typeof id==='string'&&/^[\da-f-]{36}$/.test(id)),'Choose at most two different photos.');
  const minimum=['identity','training','background'].includes(kind)?1:0;
  badInput(body.evidenceIds.length>=minimum&&(kind!=='phone'||body.evidenceIds.length===0),'The required document photo is missing.');
  badInput(!body.evidenceIds.length||body.readable===true,'Confirm that every document is readable in the preview.');
  const old=await record(repo,user.uid,kind);
  const duplicate=await repo.env.DB.prepare('SELECT id FROM verification_submissions WHERE caregiver_id=? AND request_id=?').bind(user.uid,body.requestId).first<Data>();
  requireThat(!duplicate,'This request was already submitted. Refresh to view it.',409,'already-exists');
  conflict((old?.version||0)===body.version);
  requireThat(!old||['not_submitted','more_information_required','rejected','expired','revoked'].includes(effective(old).status),'This check already has an active submission.',409,'already-submitted');
  if(kind==='phone')badInput(nepalPhone(caregiver.phone)===details.phone,'Save this phone number on your caregiver profile before requesting verification.');
  const id=crypto.randomUUID(),now=nowISO(),retain=deadline(days(repo.env.VERIFICATION_RETENTION_DAYS,365,730));
  const encrypted=await encryptDetails(repo.env,details,privateContext('submission',id,user.uid));
  await repo.commit([], [
    ...guard(repo,'SELECT COALESCE((SELECT version FROM verification_records WHERE caregiver_id=? AND kind=?),0)=?',[user.uid,kind,body.version]),
    ...guard(repo,'SELECT COUNT(*)<10 FROM verification_submissions WHERE caregiver_id=? AND created_at>?',[user.uid,new Date(Date.now()-day).toISOString()]),
    ...guard(repo,"SELECT COUNT(*)=? FROM verification_evidence WHERE id IN (SELECT value FROM json_each(?)) AND caregiver_id=? AND kind=? AND state='ready' AND retain_until>?",[body.evidenceIds.length,JSON.stringify(body.evidenceIds),user.uid,kind,now]),
    repo.env.DB.prepare('INSERT INTO verification_submissions(id,caregiver_id,kind,request_id,details,created_at,retain_until,consent_version) VALUES(?,?,?,?,?,?,?,?)').bind(id,user.uid,kind,body.requestId,encrypted,now,retain,'2026-10-v1'),
    repo.env.DB.prepare("UPDATE verification_evidence SET state='deleting' WHERE submission_id=? AND state='attached'").bind(old?.submission_id||''),
    repo.env.DB.prepare("UPDATE verification_evidence SET state='attached',submission_id=?,retain_until=? WHERE id IN (SELECT value FROM json_each(?))").bind(id,retain,JSON.stringify(body.evidenceIds)),
    repo.env.DB.prepare(`INSERT INTO verification_records(caregiver_id,kind,status,version,submission_id,submitted_at,updated_at,phone_snapshot,expires_at,police_requested) VALUES(?,?,'pending',1,?,?,?,?,?,?)
      ON CONFLICT(caregiver_id,kind) DO UPDATE SET status='pending',version=version+1,submission_id=excluded.submission_id,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at,phone_snapshot=excluded.phone_snapshot,police_requested=excluded.police_requested,verified_decision_id=NULL,verified_at=NULL,expires_at=excluded.expires_at,police_verified=0`).bind(user.uid,kind,id,now,now,kind==='phone'?details.phone:null,retain,kind==='background'&&details.documentType==='police_clearance'?1:0),
    audit(repo,user.uid,kind,id,user.uid,'submitted',body.version+1)
  ]);
  return {id,status:'pending',version:body.version+1};
}

async function review(repo:Repository,actor:Actor|null,uid:string,kind:string,body:Data) {
  const user=requireAdmin(actor); requireThat(user.uid!==uid,'You cannot review your own verification.');
  await owner(repo,user,uid,true);
  requireThat(await caregiverActive(repo,uid,false),'The caregiver or their organization is not active.');
  onlyKeys(body,['version','decision','reason','method','outcome','expiresAt','policeResult','referenceConfirmations','confirmed']);
  badInput(body.confirmed===true,'Confirm this review decision.');
  badInput(Number.isInteger(body.version)&&body.version>0,'A current record version is required.');
  const old=await record(repo,uid,kind);requireThat(old,'Submission not found.',404,'not-found');conflict(old.version===body.version);
  const transitions:Record<string,string[]>={pending:['under_review'],under_review:['verified','rejected','more_information_required'],verified:['revoked'],expired:['revoked'],more_information_required:['under_review'],rejected:[],revoked:[]};
  badInput((transitions[effective(old).status]||[]).includes(body.decision),'Begin review before deciding, or refresh this request.');
  const reason=textField(body.reason||'','Caregiver response', ['rejected','revoked','more_information_required'].includes(body.decision)?5:0,1000);
  const method=textField(body.method||'manual_review','Verification method',1,80);
  const outcome=textField(body.outcome||'','Review outcome',body.decision==='verified'?5:0,1000);
  const submission=await repo.env.DB.prepare('SELECT * FROM verification_submissions WHERE id=?').bind(old.submission_id).first<Data>();
  requireThat(submission,'Submission not found.',404,'not-found');
  if(body.decision==='verified')requireThat(submission.details,'Evidence retention has ended. A new submission is required.',409,'evidence-expired');
  const details=await decryptDetails(repo.env,submission.details,privateContext('submission',submission.id,uid));
  let expiry:string|null=['under_review','more_information_required'].includes(body.decision)?submission.retain_until:null,police=0;
  if(body.decision==='verified') {
    requireThat(submission.retain_until>nowISO(),'Evidence retention has ended.',409,'evidence-expired');
    const expectedMethod:Data={identity:'manual_document_review',phone:'manual_phone_call',training:'manual_qualification_review',background:details.documentType==='police_clearance'?'nepal_police_portal_manual':'manual_background_review',references:'manual_reference_contact'};
    badInput(method===expectedMethod[kind],'Record the required verification method.');
    if(['identity','training','background'].includes(kind)) {
      const count=await repo.env.DB.prepare("SELECT COUNT(*) n FROM verification_evidence WHERE submission_id=? AND state='attached' AND retain_until>?").bind(submission.id,nowISO()).first<Data>();
      requireThat(count!.n>0,'Document evidence is no longer available. Request a new submission.');
    }
    if(kind==='phone') { const caregiver=await repo.data(`vendors/${uid}`);conflict(nepalPhone(caregiver!.phone)===old.phone_snapshot); }
    if(kind==='references') {
      badInput(Array.isArray(body.referenceConfirmations)&&body.referenceConfirmations.length===details.references.length&&body.referenceConfirmations.every((r:Data,i:number)=>r&&r.index===i&&r.confirmed===true&&typeof r.notes==='string'&&r.notes.trim().length>=5&&r.notes.length<=500),'Contact and record a confirmation for every reference.');
      for(const item of body.referenceConfirmations)onlyKeys(item,['index','confirmed','notes']);
    }
    if(kind==='background'&&details.documentType==='police_clearance') { badInput(body.policeResult==='matched','Record a successful match using the official Nepal Police portal.');police=1; }
    const policyExpiry=kind==='background'?deadline(days(repo.env.VERIFICATION_BACKGROUND_DAYS,365,730)):submission.retain_until;
    const maxExpiry=policyExpiry<submission.retain_until?policyExpiry:submission.retain_until;
    if(body.expiresAt)badInput(Number.isFinite(Date.parse(body.expiresAt)),'Invalid renewal date.');
    expiry=body.expiresAt?new Date(textField(body.expiresAt,'Renewal date',10,24)).toISOString():String(maxExpiry);
    badInput(expiry!>nowISO()&&expiry!<=maxExpiry&&expiry!<=submission.retain_until,'Renewal must be in the future and within the evidence retention and renewal policy.');
    if(kind==='training'&&details.expiresAt) {
      const certificateExpiry=details.expiresAt+'T23:59:59.999Z';
      badInput(certificateExpiry>nowISO(),'The training certificate has expired.');
      expiry=expiry!<certificateExpiry?expiry:certificateExpiry;
    }
  }
  const id=crypto.randomUUID(),now=nowISO();
  const encrypted=await encryptDetails(repo.env,{reason,outcome,policeResult:kind==='background'&&['matched','not_matched','unavailable'].includes(body.policeResult)?body.policeResult:null,referenceConfirmations:body.referenceConfirmations||[]},privateContext('decision',id,uid));
  await repo.commit([], [
    ...guard(repo,'SELECT version=? FROM verification_records WHERE caregiver_id=? AND kind=?',[body.version,uid,kind]),
    ...(body.decision==='verified' ? [
      ...guard(repo,'SELECT details IS NOT NULL AND retain_until>? FROM verification_submissions WHERE id=?',[now,old.submission_id]),
      ...(['identity','training','background'].includes(kind) ? guard(repo,"SELECT COUNT(*)>0 FROM verification_evidence WHERE submission_id=? AND state='attached' AND retain_until>?",[old.submission_id,now]) : [])
    ] : []),
    repo.env.DB.prepare('INSERT INTO verification_decisions(id,caregiver_id,kind,submission_id,reviewer_id,decision,method,details,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,uid,kind,old.submission_id,user.uid,body.decision,method,encrypted,now,expiry),
    repo.env.DB.prepare('UPDATE verification_records SET status=?,version=version+1,updated_at=?,verified_decision_id=?,verified_at=?,expires_at=?,police_verified=? WHERE caregiver_id=? AND kind=?').bind(body.decision,now,body.decision==='verified'?id:null,body.decision==='verified'?now:null,expiry,police,uid,kind),
    audit(repo,uid,kind,old.submission_id,user.uid,body.decision,body.version+1)
  ]);
  return {status:body.decision,version:body.version+1};
}

async function detail(repo:Repository,actor:Actor|null,uid:string) {
  const {user,caregiver}=await owner(repo,actor,uid,true);
  const records=(await repo.env.DB.prepare('SELECT * FROM verification_records WHERE caregiver_id=?').bind(uid).all<Data>()).results.map(effective);
  const submissions=(await repo.env.DB.prepare('SELECT s.* FROM verification_submissions s JOIN verification_records r ON r.submission_id=s.id WHERE r.caregiver_id=?').bind(uid).all<Data>()).results;
  for(const s of submissions)s.details=s.retain_until>nowISO()?await decryptDetails(repo.env,s.details,privateContext('submission',s.id,uid)):null;
  const evidence=(await repo.env.DB.prepare("SELECT id,kind,submission_id,state,mime,size,width,height,retain_until FROM verification_evidence WHERE caregiver_id=? AND state<>'deleted'").bind(uid).all()).results;
  const decisions=(await repo.env.DB.prepare('SELECT d.*,s.retain_until FROM verification_decisions d JOIN verification_submissions s ON s.id=d.submission_id WHERE d.caregiver_id=? ORDER BY d.created_at DESC,d.id DESC LIMIT 100').bind(uid).all<Data>()).results;
  for(const d of decisions) {
    const privateDetails=d.retain_until>nowISO()?await decryptDetails(repo.env,d.details,privateContext('decision',d.id,uid)):null;
    d.details=user.role==='superadmin'?privateDetails:{reason:privateDetails?.reason||''};
    if(user.role!=='superadmin')delete d.reviewer_id;
  }
  const history=user.role==='superadmin'?(await repo.env.DB.prepare('SELECT * FROM verification_audit WHERE caregiver_id=? ORDER BY id DESC LIMIT 100').bind(uid).all()).results:[];
  return {caregiver:{id:uid,name:caregiver.name,phone:caregiver.phone,organizationId:caregiver.organizationId||null},records,submissions,evidence,decisions,history,limits:{images:days(repo.env.VERIFICATION_MAX_IMAGES,8,8),perSubmission:2,bytes:500000,retentionDays:days(repo.env.VERIFICATION_RETENTION_DAYS,365,730)}};
}

async function evidence(request:Request,repo:Repository,actor:Actor|null,id:string) {
  const row=await repo.env.DB.prepare('SELECT * FROM verification_evidence WHERE id=?').bind(id).first<Data>();
  requireThat(row,'Evidence not found.',404,'not-found');
  const {user}=await owner(repo,actor,row.caregiver_id,request.method==='GET');
  if(request.method==='DELETE') {
    requireThat(user.uid===row.caregiver_id,'Only the owner can withdraw evidence.');
    const current=await record(repo,row.caregiver_id,row.kind),now=nowISO();
    const statements=[repo.env.DB.prepare("UPDATE verification_evidence SET state='deleting' WHERE id=? AND state<>'deleted'").bind(id),audit(repo,row.caregiver_id,row.kind,row.submission_id,user.uid,'evidence_withdrawn',current?.version||0)];
    if(row.submission_id&&current&&row.submission_id===current.submission_id)statements.push(
      ...guard(repo,'SELECT version=? FROM verification_records WHERE caregiver_id=? AND kind=?',[current.version,row.caregiver_id,row.kind]),
      repo.env.DB.prepare("UPDATE verification_records SET status='revoked',version=version+1,updated_at=?,verified_decision_id=NULL,police_verified=0 WHERE caregiver_id=? AND kind=?").bind(now,row.caregiver_id,row.kind)
    );
    await repo.commit([],statements);
    await purgeEvidence(repo.env,[id]);return {deleted:true};
  }
  requireThat(['ready','attached'].includes(row.state)&&row.retain_until>nowISO(),'This evidence is no longer available.',410,'evidence-expired');
  requireThat(repo.env.APP_WRITES_ENABLED==='true','Document previews are unavailable during maintenance.',503,'maintenance');
  const stored=await storage(repo.env).prepare('SELECT ciphertext FROM evidence_blobs WHERE id=?').bind(id).first<Data>();
  requireThat(stored,'Evidence is temporarily unavailable.',503,'evidence-unavailable');
  const bytes=await decryptEvidence(repo.env,stored.ciphertext,privateContext('image',id,row.caregiver_id));
  await repo.commit([], [
    ...guard(repo,"SELECT EXISTS(SELECT 1 FROM verification_evidence WHERE id=? AND state IN ('ready','attached') AND retain_until>?)",[id,nowISO()]),
    audit(repo,row.caregiver_id,row.kind,row.submission_id,user.uid,'evidence_viewed',0)
  ]);
  return new Response(bytes,{headers:{'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':`inline; filename="verification.${row.mime==='image/jpeg'?'jpg':'webp'}"`,'Referrer-Policy':'no-referrer'}});
}

async function purgeEvidence(env:Env,ids:string[]) {
  if(!ids.length)return;
  const json=JSON.stringify(ids);
  await storage(env).batch([
    storage(env).prepare('INSERT OR IGNORE INTO evidence_tombstones(id,deleted_at) SELECT value,? FROM json_each(?)').bind(nowISO(),json),
    storage(env).prepare('DELETE FROM evidence_blobs WHERE id IN (SELECT value FROM json_each(?))').bind(json)
  ]);
  await env.DB.prepare("UPDATE verification_evidence SET state='deleted' WHERE state='deleting' AND id IN (SELECT value FROM json_each(?))").bind(json).run();
}
export async function verificationMaintenance(env:Env) {
  if(env.APP_WRITES_ENABLED!=='true'||!env.EVIDENCE_DB||!env.VERIFICATION_ENCRYPTION_KEY)return {processed:0};
  const now=nowISO();
  // Bounded work per invocation, including notifications and deletion retries.
  await env.DB.batch([
    env.DB.prepare("INSERT INTO verification_audit(caregiver_id,kind,submission_id,actor_id,action,version,created_at) SELECT caregiver_id,kind,submission_id,'system','expired',version+1,? FROM verification_records WHERE rowid IN (SELECT rowid FROM verification_records WHERE status IN ('verified','pending','under_review','more_information_required') AND expires_at<=? LIMIT 10)").bind(now,now),
    env.DB.prepare("UPDATE verification_records SET status='expired',version=version+1,updated_at=? WHERE rowid IN (SELECT rowid FROM verification_records WHERE status IN ('verified','pending','under_review','more_information_required') AND expires_at<=? LIMIT 10)").bind(now,now),
    env.DB.prepare("UPDATE verification_evidence SET state='deleting' WHERE id IN (SELECT id FROM verification_evidence WHERE state NOT IN ('deleting','deleted') AND retain_until<=? LIMIT 10)").bind(now),
    env.DB.prepare('UPDATE verification_submissions SET details=NULL WHERE id IN (SELECT id FROM verification_submissions WHERE retain_until<=? AND details IS NOT NULL LIMIT 10)').bind(now),
    env.DB.prepare('UPDATE verification_decisions SET details=NULL WHERE id IN (SELECT d.id FROM verification_decisions d JOIN verification_submissions s ON s.id=d.submission_id WHERE s.retain_until<=? AND d.details IS NOT NULL LIMIT 20)').bind(now),
    env.DB.prepare('DELETE FROM verification_notifications WHERE id IN (SELECT id FROM verification_notifications WHERE created_at<? LIMIT 100)').bind(new Date(Date.now()-90*day).toISOString())
  ]);
  const rows=await env.DB.prepare("SELECT id FROM verification_evidence WHERE state='deleting' LIMIT 10").all<Data>();
  await purgeEvidence(env,rows.results.map(r=>r.id));
  return {processed:rows.results.length};
}

export async function verificationRoute(request:Request,repo:Repository,actor:Actor|null,body:Data={}) {
  const user=requireActive(actor),url=new URL(request.url),path=url.pathname;
  if(request.method!=='GET')requireThat(repo.env.APP_WRITES_ENABLED==='true','Sewak is temporarily read-only.',503,'maintenance');
  if(path==='/api/verification/me'&&request.method==='GET')return detail(repo,user,user.uid);
  if(path==='/api/verification/notifications') {
    if(request.method==='GET')return {items:(await repo.env.DB.prepare('SELECT id,caregiver_id,kind,status,created_at,read_at FROM verification_notifications WHERE recipient_id=? ORDER BY id DESC LIMIT 30').bind(user.uid).all()).results};
    if(request.method==='POST') { onlyKeys(body,['id']);badInput(Number.isSafeInteger(body.id)&&body.id>0);await repo.commit([],[repo.env.DB.prepare('UPDATE verification_notifications SET read_at=? WHERE id=? AND recipient_id=?').bind(nowISO(),body.id,user.uid)]);return {read:true}; }
  }
  if(path==='/api/verification/maintenance'&&request.method==='POST') { requireAdmin(user);onlyKeys(body,[]);return verificationMaintenance(repo.env); }
  if(path==='/api/verification/queue'&&request.method==='GET') {
    requireAdmin(user);
    const status=url.searchParams.get('status')||'pending',kind=url.searchParams.get('kind')||'',search=(url.searchParams.get('search')||'').trim();
    badInput(verificationStatuses.includes(status)||['all','expiring'].includes(status),'Invalid status filter.'); if(kind)kindValue(kind);
    badInput(search.length<=40,'Search is limited to 40 characters.');
    const page=Number(url.searchParams.get('page')||0);badInput(Number.isSafeInteger(page)&&page>=0&&page<=1000,'Invalid page.');
    const conditions=['1=1'],params:any[]=[];
    if(status==='expiring'){conditions.push("r.status='verified' AND r.expires_at>? AND r.expires_at<=?");params.push(nowISO(),deadline(30));}
    else if(status!=='all'){conditions.push('p.status=?');params.push(status);}
    if(kind){conditions.push('r.kind=?');params.push(kind);}
    if(search){conditions.push("(instr(lower(c.name),lower(?))>0 OR c.id=?)");params.push(search,search);}
    const rows=await repo.env.DB.prepare(`SELECT r.caregiver_id,r.kind,p.status,r.version,r.submitted_at,r.expires_at,c.name,c.organization_id FROM verification_records r JOIN caregivers c ON c.id=r.caregiver_id JOIN verification_public_status p ON p.caregiver_id=r.caregiver_id AND p.kind=r.kind WHERE ${conditions.join(' AND ')} ORDER BY r.updated_at DESC,r.caregiver_id,r.kind LIMIT 21 OFFSET ?`).bind(...params,page*20).all<Data>();
    return {items:rows.results.slice(0,20),hasMore:rows.results.length>20,page};
  }
  const parts=path.split('/').slice(3);
  if(parts[0]==='caregiver'&&parts.length===2&&request.method==='GET'){requireAdmin(user);return detail(repo,user,parts[1]);}
  if(parts[0]==='progress'&&parts.length===2&&request.method==='GET') {
    const caregiver=await repo.data(`vendors/${parts[1]}`);
    requireThat(caregiver&&user.role==='orgadmin'&&caregiver.organizationId===user.uid&&await organizationActive(repo,user.uid,false));
    const rows=await repo.env.DB.prepare('SELECT kind,status,verified_at,expires_at,police_verified,police_requested FROM verification_public_status WHERE caregiver_id=?').bind(parts[1]).all<Data>();return trustedVerification(rows.results);
  }
  if(parts[0]==='evidence'&&parts.length===1&&request.method==='PUT')return upload(request,repo,user,kindValue(url.searchParams.get('kind')||''));
  if(parts[0]==='evidence'&&parts.length===2&&['GET','DELETE'].includes(request.method))return evidence(request,repo,user,parts[1]);
  if(parts[0]==='submit'&&parts.length===2&&request.method==='POST')return submit(repo,user,kindValue(parts[1]),body);
  if(parts[0]==='review'&&parts.length===3&&request.method==='POST')return review(repo,user,parts[1],kindValue(parts[2]),body);
  throw new ApiError(404,'not-found','Verification endpoint not found.');
}
