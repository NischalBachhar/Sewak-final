import { Repository, requireActive } from './repository.ts';
import { ApiError, badInput, onlyKeys, requireThat, type Actor, type Data } from './types.ts';

const token = /^[A-Za-z0-9_-]{1,160}$/;
const sanitizeBody = (value:unknown) => {
 badInput(typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 1500,'Write a message under 1,500 characters.');
 return (value as string).trim();
};
export async function careMessagesRoute(request:Request,url:URL,repo:Repository,actor:Actor|null,input:Data={}) {
 const user=requireActive(actor),method=request.method,kind=(method==='GET'?url.searchParams.get('kind'):input.kind);
 const contextId=method==='GET'?url.searchParams.get('contextId'):input.contextId;
 const selectedCaregiverId=method==='GET'?url.searchParams.get('caregiverId'):input.caregiverId;
 badInput(['booking','job'].includes(kind),'Invalid conversation type.');
 badInput(typeof contextId === 'string' && token.test(contextId),'Invalid conversation ID.');
 const db=repo.env.DB;
 let customerId:string,caregiverId:string;
 if(kind==='booking') {
   const row=await db.prepare('SELECT user_id AS userId,caregiver_id AS caregiverId FROM bookings WHERE id=?').bind(contextId).first<Data>();
   requireThat(row && (user.uid===row.userId || (user.uid===row.caregiverId && user.role==='caregiver')),'Conversation not found.',404,'not-found');
   customerId=row.userId;caregiverId=row.caregiverId;
 } else {
   requireThat(typeof selectedCaregiverId==='string' && token.test(selectedCaregiverId),'Select an applicant to message.');
   const row=await db.prepare("SELECT j.customer_id AS customerId,a.caregiver_id AS caregiverId FROM care_jobs j JOIN care_job_applications a ON a.job_id=j.id WHERE j.id=? AND a.caregiver_id=? AND a.status='applied'").bind(contextId,selectedCaregiverId).first<Data>();
   requireThat(row && (row.customerId===user.uid&&user.role==='user' || row.caregiverId===user.uid&&user.role==='caregiver'),'Conversation not found.',404,'not-found');
   customerId=row.customerId;caregiverId=row.caregiverId;
 }
 if(method==='GET'){
   const rows=await db.prepare('SELECT id,sender_id AS senderId,body,created_at AS createdAt FROM care_messages WHERE kind=? AND context_id=? AND caregiver_id=? AND customer_id=? ORDER BY created_at DESC,id DESC LIMIT 80').bind(kind,contextId,caregiverId,customerId).all<Data>();
   return {messages:rows.results.reverse()};
 }
 if(method==='POST'){
   requireThat(repo.env.APP_WRITES_ENABLED==='true','Sewak is read-only during maintenance.',503,'maintenance');
   onlyKeys(input,['kind','contextId','caregiverId','body']);
   const body=sanitizeBody(input.body);
   const count=await db.prepare('SELECT COUNT(*) AS n FROM care_messages WHERE sender_id=? AND created_at >= ?').bind(user.uid,new Date(Date.now()-86400000).toISOString()).first<Data>();
   requireThat(Number(count?.n||0)<100,'Daily messaging limit reached.',429,'rate-limited');
   const id='msg_'+crypto.randomUUID(),createdAt=new Date().toISOString();
   await repo.commit([],[db.prepare("INSERT INTO care_messages(id,kind,context_id,customer_id,caregiver_id,sender_id,body,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(id,kind,contextId,customerId,caregiverId,user.uid,body,createdAt)]);
   return {id,createdAt};
 }
 throw new ApiError(404,'not-found','Endpoint not found.');
}
