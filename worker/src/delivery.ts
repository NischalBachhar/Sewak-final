import { buildPushPayload } from '@block65/webcrypto-web-push';
import { seal, unseal } from './secret-box.ts';
import { requireThat, type Data, type Env } from './types.ts';
const now=()=>Math.floor(Date.now()/1000);
export function appBase(env: Env) {
 let url: URL; try { url=new URL(env.APP_BASE_URL || ''); } catch { throw new Error('Invalid application origin configuration'); }
 requireThat(url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash,'Transactional delivery is not configured.',503,'delivery-unavailable');
 return url.origin;
}
export function emailConfigured(env: Env) {
 try { appBase(env); return env.EMAIL_PROVIDER==='resend' && !!env.RESEND_API_KEY && /^[^\r\n<>\s]+@[^\r\n<>\s]+\.[^\r\n<>\s]+$/.test(env.EMAIL_FROM||'') && /^[A-Za-z0-9_-]{43}$/.test(env.OUTBOX_ENCRYPTION_KEY||''); } catch { return false; }
}
export const pushConfigured=(env: Env)=>!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT&&env.OUTBOX_ENCRYPTION_KEY);
export const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function emailTemplate(subject:string,message:string,link:string) {
 return {subject,text:`Sewak — Care, close to home\n\n${message}\n\n${link}\n\nSign in to Sewak for private details.`,html:`<!doctype html><html><body style="background:#fffdf8;color:#422f25;font:16px Arial,sans-serif;padding:24px"><main><h1>Sewak</h1><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(message)}</p><p><a href="${escapeHtml(link)}">Continue securely to Sewak</a></p><p>Care, close to home.</p></main></body></html>`};
}
export const defaultPreferences={booking:{inApp:true,email:true,push:true},reminders:{inApp:true,email:true,push:true},care:{inApp:true,email:false,push:true},reviews:{inApp:true,email:false,push:false},applications:{inApp:true,email:true,push:true},security:{inApp:true,email:true,push:false}};
export async function preferences(env:Env,uid:string) {
 const row=await env.DB.prepare('SELECT preferences_json,language FROM notification_preferences WHERE user_id=?').bind(uid).first<Data>();
 const saved=row?JSON.parse(row.preferences_json):{};
 return {categories:Object.fromEntries(Object.entries(defaultPreferences).map(([k,v])=>[k,{...v,...saved[k],...(k==='security'?{inApp:true,email:true}:{})}])),language:row?.language||'en'};
}
const cap=(value:string|undefined,max:number)=>Math.max(0,Math.min(max,Number.isFinite(Number(value))?Math.floor(Number(value)):max));
async function reserveEmail(env:Env,critical:boolean) {
 const date=new Date().toISOString(),day='day:'+date.slice(0,10),month='month:'+date.slice(0,7);
 const daily=cap(env.EMAIL_DAILY_CAP,100),monthly=cap(env.EMAIL_MONTHLY_CAP,3000),reserve=critical?0:Math.min(20,Math.floor(daily/5));
 const guard=crypto.randomUUID();
 try { await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO email_quota(bucket,used) VALUES(?,0),(?,0)').bind(day,month),
  env.DB.prepare('INSERT INTO commit_guards(id,valid) VALUES(?,(SELECT used<? FROM email_quota WHERE bucket=?) AND (SELECT used<? FROM email_quota WHERE bucket=?))').bind(guard,daily-reserve,day,monthly-(critical?0:Math.min(200,Math.floor(monthly/10))),month),
  env.DB.prepare('UPDATE email_quota SET used=used+1 WHERE bucket IN (?,?)').bind(day,month),env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind(guard)
 ]); return true; } catch(e) { if(String(e).includes('CHECK constraint failed'))return false;throw e; }
}
async function finish(env:Env,row:Data,status:string,code:string|null=null,reference:string|null=null,delay=0) {
 await env.DB.prepare('UPDATE notification_outbox SET status=?,last_error_code=?,provider_reference=COALESCE(?,provider_reference),next_attempt_at=?,updated_at=?,lease_until=NULL,lease_token=NULL,encrypted_payload=CASE WHEN ? IN (\'accepted\',\'delivered\',\'permanent_failure\',\'suppressed\') THEN NULL ELSE encrypted_payload END WHERE id=? AND lease_token=?').bind(status,code,reference,now()+delay,now(),status,row.id,row.lease_token).run();
}
export async function processOutbox(env:Env,send:typeof fetch=fetch) {
 if(env.APP_WRITES_ENABLED!=='true'||env.NOTIFICATION_PROCESSING_ENABLED!=='true')return;
 // One short worker-wide lease also throttles the provider across cron/manual kicks.
 const lock=await env.DB.prepare("INSERT INTO notification_jobs(name,lease_until) VALUES('delivery',?) ON CONFLICT(name) DO UPDATE SET lease_until=excluded.lease_until WHERE lease_until<=? RETURNING name").bind(now()+55,now()).first();
 if(!lock)return;
 const rows=(await env.DB.prepare("SELECT * FROM notification_outbox WHERE ((status IN ('pending','temporary_failure','deferred_quota') AND next_attempt_at<=?) OR (status='processing' AND lease_until<?)) ORDER BY priority,created_at LIMIT 2").bind(now(),now()).all<Data>()).results;
 for(const candidate of rows) {
  const lease=crypto.randomUUID();
  const row=await env.DB.prepare("UPDATE notification_outbox SET status='processing',lease_until=?,lease_token=?,updated_at=? WHERE id=? AND ((status IN ('pending','temporary_failure','deferred_quota') AND next_attempt_at<=?) OR (status='processing' AND lease_until<?)) RETURNING *").bind(now()+50,lease,now(),candidate.id,now(),now()).first<Data>();
  if(!row)continue;
  if(row.expires_at<=now()){await finish(env,row,'permanent_failure','expired');continue;}
  if(row.first_attempt_at&&now()-row.first_attempt_at>23*3600){await finish(env,row,'permanent_failure','retry_window_exceeded');continue;}
  try {
   const c=await env.DB.prepare("SELECT c.email,c.email_verified_at,c.disabled,c.credential_version,u.is_suspended,u.is_blacklisted,CASE WHEN u.role='caregiver' AND u.organization_id IS NOT NULL THEN o.id IS NULL OR COALESCE(o.is_suspended,0)=1 OR COALESCE(o.is_blacklisted,0)=1 ELSE 0 END AS organization_blocked FROM cf_credentials c JOIN users u ON u.id=c.user_id LEFT JOIN organizations o ON o.id=u.organization_id WHERE c.user_id=?").bind(row.user_id).first<Data>();
   const n=row.notification_id?await env.DB.prepare('SELECT * FROM notifications WHERE id=?').bind(row.notification_id).first<Data>():null;
   if(!c||c.disabled||c.is_suspended||c.is_blacklisted||c.organization_blocked){await finish(env,row,'suppressed','account_inactive');continue;}
   if(n) {
    const pref=await preferences(env,row.user_id);
    if(!pref.categories[n.category]?.[row.channel as 'email'|'push'] || !c.email_verified_at){await finish(env,row,'suppressed','recipient_preference_or_unverified');continue;}
    // Reminders/escalations are checked again at send time, after cancellation races.
    if(['booking_reminder','pending_escalation'].includes(n.event_type)) {
     const b=await env.DB.prepare('SELECT status,schedule_at FROM bookings WHERE id=?').bind(n.entity_id).first<Data>();
     if(!b||(n.event_type==='pending_escalation'?b.status!=='pending':!['accepted','confirmed'].includes(b.status)||Date.parse(b.schedule_at)<=Date.now())) {await finish(env,row,'suppressed','booking_ineligible');continue;}
    }
   }
   let response:Response;
   if(row.channel==='email') {
    if(!emailConfigured(env)){await finish(env,row,'temporary_failure','provider_not_configured',null,3600);continue;}
    let payload=row.encrypted_payload?await unseal(env,row.encrypted_payload,row.id):null;
    if(payload?.tokenId) {
     const t=await env.DB.prepare('SELECT t.id FROM cf_email_tokens t JOIN cf_credentials c ON c.user_id=t.user_id WHERE t.id=? AND t.used_at IS NULL AND t.expires_at>? AND t.credential_version=c.credential_version AND c.disabled=0').bind(payload.tokenId,now()).first();
     if(!t){await finish(env,row,'suppressed','token_expired_or_used');continue;}
    }
    if(!payload) {
     if(!n){await finish(env,row,'permanent_failure','missing_payload');continue;}
     payload={from:env.EMAIL_FROM,to:c.email,...emailTemplate(n.title,n.message,appBase(env)+n.target)};
     await env.DB.prepare('UPDATE notification_outbox SET encrypted_payload=? WHERE id=? AND lease_token=?').bind(await seal(env,payload,row.id),row.id,lease).run();
    }
    if(!await reserveEmail(env,row.priority<=1)){await finish(env,row,'deferred_quota','email_quota',null,3600);continue;}
    await env.DB.prepare('UPDATE notification_outbox SET attempt_count=attempt_count+1,first_attempt_at=COALESCE(first_attempt_at,?) WHERE id=? AND lease_token=?').bind(now(),row.id,lease).run();
    const {tokenId,...mail}=payload;
    response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':row.idempotency_key},body:JSON.stringify(mail),signal:AbortSignal.timeout(10000),redirect:'error'});
   } else {
    if(!pushConfigured(env)){await finish(env,row,'temporary_failure','push_not_configured',null,3600);continue;}
    const p=await env.DB.prepare('SELECT * FROM push_subscriptions WHERE id=? AND user_id=? AND revoked_at IS NULL AND credential_version=?').bind(row.subscription_id,row.user_id,c.credential_version).first<Data>();
    if(!p){await finish(env,row,'suppressed','subscription_revoked');continue;}
    const subscription=await unseal(env,p.encrypted_subscription,p.id);
    const request=await buildPushPayload({data:{title:'Sewak',body:'You have a new Sewak notification. Sign in to view it.',tag:row.notification_id,url:'/'},options:{ttl:3600}},subscription,{subject:env.VAPID_SUBJECT!,publicKey:env.VAPID_PUBLIC_KEY!,privateKey:env.VAPID_PRIVATE_KEY!});
    await env.DB.prepare('UPDATE notification_outbox SET attempt_count=attempt_count+1,first_attempt_at=COALESCE(first_attempt_at,?) WHERE id=? AND lease_token=?').bind(now(),row.id,lease).run();
    response=await send(subscription.endpoint,{...request,signal:AbortSignal.timeout(10000),redirect:'error'});
    if([404,410].includes(response.status)){await env.DB.prepare('UPDATE push_subscriptions SET revoked_at=? WHERE id=?').bind(now(),p.id).run();await finish(env,row,'permanent_failure','subscription_expired');continue;}
    if(response.ok)await env.DB.prepare('UPDATE push_subscriptions SET last_success_at=? WHERE id=?').bind(now(),p.id).run();
   }
   if(response.ok) {
    const result=row.channel==='email'?await response.json() as Data:{};
    if(row.channel==='email'&&typeof result.id!=='string')throw new Error('Invalid provider response');
    await finish(env,row,'accepted',null,result.id||null);
   } else {
    const retry=response.status===429||response.status>=500;
    await finish(env,row,retry?'temporary_failure':'permanent_failure','provider_http_'+response.status,null,Math.min(3600,60*2**Math.min(row.attempt_count,6)));
   }
  } catch { await finish(env,row,'temporary_failure','delivery_error',null,Math.min(3600,60*2**Math.min(row.attempt_count,6))); }
 }
}
