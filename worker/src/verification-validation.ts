import { badInput, onlyKeys, textField, type Data } from './types.ts';
export const verificationKinds = ['identity','phone','training','background','references'] as const;
export const verificationStatuses = ['not_submitted','pending','under_review','more_information_required','verified','rejected','expired','revoked'];
export const kindValue = (value: string) => { badInput(verificationKinds.includes(value as any), 'Unknown verification check.'); return value; };
export function nepalPhone(value: unknown) {
  const cleaned = textField(value,'Nepal mobile number',10,20).replace(/[\s()-]/g,'').replace(/^(?:\+977|00977|977)/,'');
  badInput(/^9[678]\d{8}$/.test(cleaned),'Enter a Nepal mobile number, for example +977 9800000000.');
  return '+977'+cleaned;
}
export function validDate(value: unknown, name: string, future = false) {
  const text = textField(value,name,10,10);
  badInput(/^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(text)) && new Date(text).toISOString().slice(0,10)===text,`${name} must be a valid date.`);
  badInput(future ? text > new Date().toISOString().slice(0,10) : text <= new Date().toISOString().slice(0,10),`${name} must be ${future?'in the future':'today or earlier'}.`);
  return text;
}
export function validateSubmission(kind: string, data: Data) {
  const field = (key: string, label: string, max=160) => textField(data[key],label,1,max);
  if(kind==='identity') {
    onlyKeys(data,['legalName','documentType','documentNumber']);
    badInput(['citizenship','national_id','passport'].includes(data.documentType),'Choose an identity document.');
    return {legalName:field('legalName','Legal name'),documentType:data.documentType,documentNumber:field('documentNumber','Document number',80)};
  }
  if(kind==='phone') { onlyKeys(data,['phone']);return {phone:nepalPhone(data.phone)}; }
  if(kind==='training') {
    onlyKeys(data,['institution','course','category','completedAt','expiresAt']);
    badInput(['caregiver','childcare','first_aid','cpr','healthcare','household'].includes(data.category),'Choose a training category.');
    return {institution:field('institution','Institution'),course:field('course','Course'),category:data.category,completedAt:validDate(data.completedAt,'Completion date'),expiresAt:data.expiresAt?validDate(data.expiresAt,'Certificate expiry',true):null};
  }
  if(kind==='background') {
    onlyKeys(data,['documentType','referenceNumber','issuedAt','issuer']);
    badInput(['police_clearance','other_background'].includes(data.documentType),'Choose a background document type.');
    return {documentType:data.documentType,referenceNumber:field('referenceNumber','Certificate/reference number',100),issuedAt:validDate(data.issuedAt,'Issue date'),issuer:data.documentType==='police_clearance'?'Nepal Police':field('issuer','Issuer')};
  }
  onlyKeys(data,['references']);
  badInput(Array.isArray(data.references)&&data.references.length>=2&&data.references.length<=5,'Add 2 to 5 professional references.');
  const references = data.references.map((r:Data)=>{
    onlyKeys(r,['name','phone','email','relationship']);
    const email = textField(r.email||'','Reference email',0,254);
    badInput(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Invalid reference email.');
    return {name:textField(r.name,'Reference name',2,120),phone:nepalPhone(r.phone),email,relationship:textField(r.relationship,'Relationship',2,160)};
  });
  badInput(new Set(references.map((r:Data)=>r.phone)).size===references.length,'Use different contacts for each reference.');
  return {references};
}
export function trustedVerification(rows: Data[] = []) {
  const result: Data = {verificationSource:'audited_v1'};
  for(const kind of verificationKinds) {
    const row=rows.find(r=>r.kind===kind);
    result[kind+'VerificationStatus']=row?.status || 'not_submitted';
  }
  result.verified=verificationKinds.every(k=>result[k+'VerificationStatus']==='verified');
  result.backgroundChecked=result.backgroundVerificationStatus==='verified';
  result.isCertified=result.trainingVerificationStatus==='verified';
  const background=rows.find(r=>r.kind==='background');
  result.policeClearanceVerificationStatus=background?.police_requested===1 ? (background.status==='verified' ? (background.police_verified===1?'verified':'not_submitted') : background.status) : 'not_submitted';
  return result;
}
