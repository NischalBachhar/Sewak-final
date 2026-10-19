import { Repository } from './repository.ts';
import { badInput, requireThat, type Data } from './types.ts';

export const weeklyRestriction = "(EXISTS(SELECT 1 FROM caregiver_weekly_hours w WHERE w.caregiver_id=?) AND NOT EXISTS(SELECT 1 FROM caregiver_weekly_hours w WHERE w.caregiver_id=? AND w.weekday=? AND w.start_min<=? AND w.end_min>=?))";
export const weeklyArgs=(caregiverId:string,day:string,start:number,end:number)=>
 [caregiverId,caregiverId,new Date(day+'T00:00:00Z').getUTCDay(),start,end];

function minute(value:unknown,end=false) {
 badInput(typeof value==='string' && /^\d{2}:\d{2}$/.test(value),'Enter a valid HH:MM time.');
 const [h,m]=(value as string).split(':').map(Number);
 badInput((h>=0 && h<24 && m>=0 && m<60) || (end && h===24 && m===0),'Choose a valid time.');
 return h*60+m;
}
export async function weeklyHoursRead(repo:Repository,uid:string) {
 const rows=await repo.env.DB.prepare('SELECT id,weekday,start_min AS startMin,end_min AS endMin FROM caregiver_weekly_hours WHERE caregiver_id=? ORDER BY weekday,start_min LIMIT 40').bind(uid).all<Data>();
 return rows.results;
}
export async function weeklyHoursAction(repo:Repository,uid:string,input:Data) {
 const db=repo.env.DB;
 if(input.action==='weekly-remove') {
  badInput(typeof input.id==='string'&&/^wh_[a-f0-9-]{36}$/.test(input.id),'Invalid weekly window ID.');
  badInput(input.weekday===undefined&&input.day===undefined&&input.start===undefined&&input.end===undefined,'Unexpected schedule fields.');
  await repo.commit([],[db.prepare('DELETE FROM caregiver_weekly_hours WHERE id=? AND caregiver_id=?').bind(input.id,uid)]);
  return {updated:true};
 }
 badInput(input.action==='weekly-add'&&input.id===undefined&&input.day===undefined,'Invalid weekly action.');
 badInput(Number.isInteger(input.weekday)&&input.weekday>=0&&input.weekday<=6,'Choose a weekday.');
 const start=minute(input.start),end=minute(input.end,true);
 badInput(end-start>=30,'Your working window must last at least 30 minutes.');
 const existing=await db.prepare('SELECT id FROM caregiver_weekly_hours WHERE caregiver_id=? AND weekday=? AND start_min=? AND end_min=?')
  .bind(uid,input.weekday,start,end).first<Data>();
 if(existing)return {updated:true,id:existing.id};
 const count=await db.prepare('SELECT COUNT(*) AS count FROM caregiver_weekly_hours WHERE caregiver_id=?').bind(uid).first<Data>();
 requireThat(Number(count?.count||0)<28,'Please remove another weekly window before adding more.',409,'limit-reached');
 const id='wh_'+crypto.randomUUID();
 await repo.commit([],[db.prepare('INSERT OR IGNORE INTO caregiver_weekly_hours(id,caregiver_id,weekday,start_min,end_min,created_at) VALUES(?,?,?,?,?,?)')
  .bind(id,uid,input.weekday,start,end,new Date().toISOString())]);
 return {updated:true};
}
