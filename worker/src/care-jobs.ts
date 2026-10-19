import { caregiverActive } from './policy.ts';
import { Repository, requireActive } from './repository.ts';
import { ApiError, badInput, onlyKeys, requireThat, type Actor, type Data } from './types.ts';

const timestamp=()=>new Date().toISOString();
function validateText(value:unknown,min:number,max:number,label:string):string {
 badInput(typeof value==='string' && value.trim().length>=min && value.trim().length<=max,'Enter a valid '+label+'.');
 return (value as string).trim();
}
function contactsHidden(value:string){return !/(\b\d{9,}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(value);}
const publicFields='j.id,j.title,j.description,j.category,j.city,j.schedule,j.hourly_budget AS hourlyBudget,j.status,j.created_at AS createdAt';
export async function careJobsRoute(request:Request,url:URL,repo:Repository,actor:Actor|null,input:Data={}) {
 const user=requireActive(actor),db=repo.env.DB,post=request.method==='POST';
 const customer=user.role==='user' && user.profile?.profileComplete===true;
 const caregiver=user.role==='caregiver' && await caregiverActive(repo,user.uid);
 requireThat(customer||caregiver,'Only active customers and approved caregivers may use care jobs.');
 if(post) requireThat(repo.env.APP_WRITES_ENABLED==='true','Sewak is read-only during maintenance.',503,'maintenance');
 if(url.pathname==='/api/care-jobs'&&!post){
   if(customer){const result=await db.prepare('SELECT '+publicFields+', (SELECT COUNT(*) FROM care_job_applications a WHERE a.job_id=j.id AND a.status=\'applied\') AS applicationCount FROM care_jobs j WHERE j.customer_id=? ORDER BY j.created_at DESC LIMIT 50').bind(user.uid).all<Data>();return {jobs:result.results};}
   const result=await db.prepare('SELECT '+publicFields+' FROM care_jobs j WHERE j.status=\'open\' ORDER BY j.created_at DESC LIMIT 50').all<Data>();
   const mine=await db.prepare('SELECT job_id,status FROM care_job_applications WHERE caregiver_id=?').bind(user.uid).all<Data>();
   const status=Object.fromEntries(mine.results.map(row=>[row.job_id,row.status]));
   return {jobs:result.results.map(row=>({...row,myApplicationStatus:status[row.id]||null}))};
 }
 if(url.pathname==='/api/care-jobs'&&post){
   requireThat(customer,'Only customers may publish jobs.');
   onlyKeys(input,['title','description','category','city','schedule','hourlyBudget']);
   const title=validateText(input.title,6,100,'title'),description=validateText(input.description,10,1000,'description'),city=validateText(input.city,2,100,'city');
   badInput(/^[\p{L}\p{M}\p{N} .,()'/-]+$/u.test(city),'Enter a valid city.');
   badInput(['caregiver','household'].includes(input.category),'Choose a care category.');
   badInput(['one_time','recurring','flexible'].includes(input.schedule),'Choose a schedule.');
   badInput(contactsHidden(title)&&contactsHidden(description),'Do not include personal phone numbers or email addresses.');
   const budget=input.hourlyBudget===null||input.hourlyBudget===undefined ? null : input.hourlyBudget;
   badInput(budget===null||(typeof budget==='number'&&Number.isFinite(budget)&&budget>=0&&budget<=1000000),'Invalid hourly budget.');
   const count=await db.prepare('SELECT COUNT(*) AS n FROM care_jobs WHERE customer_id=? AND created_at>=?').bind(user.uid,new Date(Date.now()-86400000).toISOString()).first<Data>();
   requireThat(Number(count?.n||0)<10,'Daily job posting limit reached.',429,'rate-limited');
   const id='job_'+crypto.randomUUID(),at=timestamp();
   await repo.commit([], [db.prepare('INSERT INTO care_jobs(id,customer_id,title,description,category,city,schedule,hourly_budget,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,user.uid,title,description,input.category,city,input.schedule,budget,'open',at,at)]);
   return {id,status:'open'};
 }
 const parts=url.pathname.match(/^\/api\/care-jobs\/(job_[0-9a-f-]{36})\/(close|applications|apply|withdraw)$/);
 if(!parts)throw new ApiError(404,'not-found','Endpoint not found.');
 const [,id,action]=parts;
 const job=await db.prepare('SELECT customer_id AS customerId,status FROM care_jobs WHERE id=?').bind(id).first<Data>();
 requireThat(job,'Care job not found.',404,'not-found');
 if(action==='applications'&&!post) {
   requireThat(customer&&job.customerId===user.uid,'Only the job owner may read applications.');
   const rows=await db.prepare('SELECT a.id,a.caregiver_id AS caregiverId,c.name AS caregiverName,a.message,a.status,a.created_at AS createdAt FROM care_job_applications a JOIN caregivers c ON c.id=a.caregiver_id WHERE a.job_id=? ORDER BY a.created_at DESC LIMIT 80').bind(id).all<Data>();
   return {applications:rows.results};
 }
 if(action==='close'&&post) {
   requireThat(customer&&job.customerId===user.uid,'Only the job owner can close it.');
   requireThat(job.status==='open','This job is already closed.',409,'failed-precondition');
   await repo.commit([],[db.prepare("UPDATE care_jobs SET status='closed',updated_at=? WHERE id=? AND customer_id=? AND status='open'").bind(timestamp(),id,user.uid)]);
   return {id,status:'closed'};
 }
 if(action==='apply'&&post) {
   requireThat(caregiver,'Only approved caregivers may apply.');
   requireThat(job.status==='open','This job is closed.',409,'failed-precondition');
   onlyKeys(input,['message']);
   const message=validateText(input.message,20,700,'application message');
   badInput(contactsHidden(message),'Do not include personal phone numbers or email addresses.');
   const mine=await db.prepare('SELECT id FROM care_job_applications WHERE job_id=? AND caregiver_id=?').bind(id,user.uid).first();
   requireThat(!mine,'You have already applied.',409,'already-exists');
   const count=await db.prepare('SELECT COUNT(*) AS n FROM care_job_applications WHERE caregiver_id=? AND created_at>=?').bind(user.uid,new Date(Date.now()-86400000).toISOString()).first<Data>();
   requireThat(Number(count?.n||0)<30,'Daily application limit reached.',429,'rate-limited');
   const aid='apply_'+crypto.randomUUID(),at=timestamp();
   await repo.commit([],[
     db.prepare("INSERT INTO care_job_applications(id,job_id,caregiver_id,message,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(aid,id,user.uid,message,'applied',at,at),
     db.prepare("INSERT OR IGNORE INTO care_notifications(id,recipient_id,event_type,context_id,title,body,link,created_at) VALUES(?,?,?,?,?,?,?,?)")
       .bind('care-job-application:'+aid,job.customerId,'care-job-applied',id,'New caregiver application','A caregiver applied to your care job. Review the application and profile.','/user/jobs',at),
   ]);
   return {id:aid,status:'applied'};
 }
 if(action==='withdraw'&&post) {
   requireThat(caregiver,'Only caregivers may withdraw applications.');
   const app=await db.prepare('SELECT id,status FROM care_job_applications WHERE job_id=? AND caregiver_id=?').bind(id,user.uid).first<Data>();
   requireThat(app&&app.status==='applied','Application cannot be withdrawn.',409,'failed-precondition');
   await repo.commit([],[db.prepare("UPDATE care_job_applications SET status='withdrawn',updated_at=? WHERE id=? AND caregiver_id=? AND status='applied'").bind(timestamp(),app.id,user.uid)]);
   return {id:app.id,status:'withdrawn'};
 }
 throw new ApiError(404,'not-found','Endpoint not found.');
}
