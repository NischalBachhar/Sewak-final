import type { Write, Saved } from './repository.ts';
import { Repository, requireActive } from './repository.ts';
import { badInput, requireThat, onlyKeys, type Data, type Actor, type Env } from './types.ts';

// All dates/times in this module are local wall times in Nepal, not UTC.
const validDay=(value:unknown):value is string=>typeof value==='string' &&
 /^\d{4}-\d{2}-\d{2}$/.test(value) &&
 !Number.isNaN(Date.parse(value+'T00:00:00Z')) &&
 new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const minute=(value:unknown,allowEnd=false):number=>{
 badInput(typeof value==='string'&&/^\d{2}:\d{2}$/.test(value),'Enter time as HH:MM.');
 const [h,m]=(value as string).split(':').map(Number);
 badInput(h<24&&m<60 || allowEnd&&h===24&&m===0,'Enter a valid time.');
 return h*60+m;
};
const plus=(day:string,offset:number)=>new Date(Date.parse(day+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
const startSql='(CAST(substr(b.time,1,2) AS INTEGER)*60+CAST(substr(b.time,4,2) AS INTEGER))';
const overlapCurrent=`b.caregiver_id=? AND b.date=? AND b.status IN ('accepted','confirmed','in_progress')
  AND ${startSql}<? AND (${startSql}+b.duration_hours*60)>?`;
const overlapPrev=`b.caregiver_id=? AND b.date=? AND b.status IN ('accepted','confirmed','in_progress')
  AND (${startSql}+b.duration_hours*60)>(1440+?)`;

export function timeSegments(day:string,start:number,duration:number){
 const firstEnd=Math.min(start+duration*60,1440);
 const segments=[{day,start,end:firstEnd}];
 if(start+duration*60>1440)segments.push({day:plus(day,1),start:0,end:start+duration*60-1440});
 return segments;
}
const guardedSql=`INSERT INTO commit_guards(id,valid) VALUES(?,NOT EXISTS(
 SELECT 1 FROM caregiver_time_off t WHERE t.caregiver_id=? AND t.day=? AND t.start_min<? AND t.end_min>?
) AND NOT EXISTS(SELECT 1 FROM bookings b WHERE ${overlapCurrent} AND b.id<>?)
AND NOT EXISTS(SELECT 1 FROM bookings b WHERE ${overlapPrev} AND b.id<>?))`;
function conflicts(db:D1Database,caregiverId:string,segment:{day:string;start:number;end:number},ignoreId:string=''){
 return db.prepare(`SELECT (
  EXISTS(SELECT 1 FROM caregiver_time_off t WHERE t.caregiver_id=? AND t.day=? AND t.start_min<? AND t.end_min>?)
  OR EXISTS(SELECT 1 FROM bookings b WHERE ${overlapCurrent} AND b.id<>?)
  OR EXISTS(SELECT 1 FROM bookings b WHERE ${overlapPrev} AND b.id<>?)
 ) AS blocked`).bind(caregiverId,segment.day,segment.end,segment.start,
 caregiverId,segment.day,segment.end,segment.start,ignoreId,
 caregiverId,plus(segment.day,-1),segment.start,ignoreId);
}
export function availabilityGuards(env:Env,writes:Write[],reads:Map<string,Saved>,transactionId:string) {
 const statements:D1PreparedStatement[]=[];
 for(const write of writes){
  if(!write.path.startsWith('bookings/')||!write.data)continue;
  const old=reads.get(write.path)?.data, data=write.data;
  if(!((!old&&data.status==='pending')||(old&&old.status!==data.status&&['accepted','confirmed'].includes(data.status))))continue;
  if(!validDay(data.date)||typeof data.time!=='string'||!Number.isFinite(Number(data.durationHours)))continue;
  const start=minute(data.time),duration=Number(data.durationHours);
  if(duration<=0||duration>24)continue;
  const segments=timeSegments(data.date,start,duration);
  for(let index=0;index<segments.length;index++){
   const segment=segments[index],id=write.path.slice('bookings/'.length);
   statements.push(env.DB.prepare(guardedSql).bind(transactionId+'/schedule/'+id+'/'+index,
     data.caregiverId,segment.day,segment.end,segment.start,
     data.caregiverId,segment.day,segment.end,segment.start,id,
     data.caregiverId,plus(segment.day,-1),segment.start,id));
  }
 }
 return statements;
}
export async function careScheduleRoute(request:Request,url:URL,repo:Repository,actor:Actor|null,input:Data={}){
 const user=requireActive(actor),db=repo.env.DB;
 const check=url.searchParams.get('caregiverId');
 if(request.method==='GET'&&check){
  requireThat(user.role==='user'||user.role==='caregiver'||user.role==='orgadmin','Only care participants may check availability.');
  const day=url.searchParams.get('day'),clock=url.searchParams.get('time');
  const duration=Number(url.searchParams.get('hours'));
  badInput(validDay(day),'Choose a valid date.');
  const start=minute(clock);
  badInput(Number.isInteger(duration)&&duration>=1&&duration<=24,'Choose a valid care duration.');
  const professional=await repo.data('vendors/'+check);
  requireThat(professional&&professional.isApproved===true&&professional.isAvailable===true&&!professional.isBlacklisted&&!professional.isSuspended,'Caregiver unavailable.',404,'not-found');
  let blocked=false;
  for(const seg of timeSegments(day,start,duration)){
   const row=await conflicts(db,check,seg).first<Data>();
   if(row?.blocked) {blocked=true;break;}
  }
  return {available:!blocked,confirmationRequired:true};
 }
 requireThat(user.role==='caregiver','Only caregivers can manage their availability.');
 if(request.method==='GET'){
  const rows=await db.prepare('SELECT id,day,start_min AS startMin,end_min AS endMin FROM caregiver_time_off WHERE caregiver_id=? AND day>=? ORDER BY day,start_min LIMIT 100')
    .bind(user.uid,new Date().toISOString().slice(0,10)).all<Data>();
  return {blocks:rows.results};
 }
 requireThat(request.method==='POST','Unsupported scheduling method.',405,'method-not-allowed');
 requireThat(repo.env.APP_WRITES_ENABLED==='true','Availability management is read-only during maintenance.',503,'maintenance');
 onlyKeys(input,['action','id','day','start','end']);
 badInput(['block','unblock'].includes(input.action),'Invalid availability action.');
 if(input.action==='unblock'){
  badInput(typeof input.id==='string'&&/^off_[A-Za-z0-9-]{36}$/.test(input.id),'Invalid block ID.');
  await repo.commit([],[db.prepare('DELETE FROM caregiver_time_off WHERE id=? AND caregiver_id=?').bind(input.id,user.uid)]);
  return {updated:true};
 }
 badInput(input.id===undefined&&validDay(input.day),'Choose a valid date.');
 const today=new Date().toISOString().slice(0,10);
 badInput(input.day>=today&&input.day<=plus(today,366),'Choose a date within the next year.');
 const start=minute(input.start),end=minute(input.end,true);
 badInput(end>start,'End time must follow start time.');
 const count=await db.prepare('SELECT COUNT(*) AS total FROM caregiver_time_off WHERE caregiver_id=? AND day>=?').bind(user.uid,today).first<Data>();
 requireThat(Number(count?.total||0)<180,'Too many blocked times. Remove an old block first.',409,'limit-reached');
 // If an existing accepted booking overlaps this time, the guarded commit fails
 // and the block is not inserted. All writes are within the same D1 transaction.
 const guard='timeoff:'+crypto.randomUUID(),id='off_'+crypto.randomUUID();
 const sql=`INSERT INTO commit_guards(id,valid) VALUES(?,NOT EXISTS(
 SELECT 1 FROM bookings b WHERE ${overlapCurrent}
 ) AND NOT EXISTS(SELECT 1 FROM bookings b WHERE ${overlapPrev}))`;
 await repo.commit([],[
   db.prepare(sql).bind(guard,user.uid,input.day,end,start,user.uid,plus(input.day,-1),start),
   db.prepare('INSERT INTO caregiver_time_off(id,caregiver_id,day,start_min,end_min,created_at) VALUES(?,?,?,?,?,?)')
     .bind(id,user.uid,input.day,start,end,new Date().toISOString()),
   db.prepare('DELETE FROM commit_guards WHERE id=?').bind(guard),
 ]);
 return {id,updated:true};
}
