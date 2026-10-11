import { digest, epoch } from './cloudflare-auth.ts';
import { defaultPreferences, preferences, pushConfigured } from './delivery.ts';
import { requireActive } from './repository.ts';
import { seal, unbase64 } from './secret-box.ts';
import { ApiError, badInput, onlyKeys, requireThat, type Actor, type Data, type Env } from './types.ts';
export function validatePush(value:Data) {
 badInput(value&&typeof value==='object');onlyKeys(value,['endpoint','keys','expirationTime']);
 let url:URL;try{url=new URL(value.endpoint);}catch{throw new ApiError(400,'invalid-argument','Invalid push endpoint.');}
 // Explicit service origins prevent using the subscription API as an SSRF relay.
 badInput(url.protocol==='https:'&&!url.port&&!url.username&&!url.password&&!url.hash&&url.href.length<=2048&&(
  url.hostname==='fcm.googleapis.com'||url.hostname==='updates.push.services.mozilla.com'||url.hostname==='web.push.apple.com'||url.hostname.endsWith('.push.apple.com')||url.hostname==='wns2-par02p.notify.windows.com'||/^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname)
 ),'Unsupported push service endpoint.');
 badInput(value.keys&&typeof value.keys==='object');onlyKeys(value.keys,['p256dh','auth']);
 badInput(typeof value.keys.p256dh==='string'&&/^[\w-]{87}$/.test(value.keys.p256dh)&&unbase64(value.keys.p256dh)[0]===4&&typeof value.keys.auth==='string'&&/^[\w-]{22}$/.test(value.keys.auth),'Invalid push subscription keys.');
 return {endpoint:url.href,keys:{p256dh:value.keys.p256dh,auth:value.keys.auth}};
}
export async function notificationRoute(request:Request,env:Env,actor:Actor|null,body:Data) {
 const user=requireActive(actor),url=new URL(request.url),path=url.pathname;
 if(request.method==='GET'&&path==='/api/notifications') {
  const before=url.searchParams.get('before')||'',limit=20;
  const pref=await preferences(env,user.uid);
  const filter=JSON.stringify(pref.categories);
  const rows=(await env.DB.prepare("SELECT * FROM notifications WHERE recipient_id=? AND COALESCE(json_extract(?,'$.'||category||'.inApp'),1)=1 AND (?='' OR (created_at||':'||id)<?) ORDER BY created_at DESC,id DESC LIMIT ?").bind(user.uid,filter,before,before,limit+1).all<Data>()).results;
  const unread=await env.DB.prepare("SELECT COUNT(*) total FROM notifications WHERE recipient_id=? AND read_at IS NULL AND COALESCE(json_extract(?,'$.'||category||'.inApp'),1)=1").bind(user.uid,filter).first<Data>();
  const page=rows.slice(0,limit);return {notifications:page,unread:unread?.total||0,nextCursor:rows.length>limit?page.at(-1)!.created_at+':'+page.at(-1)!.id:null};
 }
 if(request.method==='GET'&&path==='/api/notifications/preferences')return preferences(env,user.uid);
 if(request.method==='GET'&&path==='/api/notifications/devices')return {enabled:pushConfigured(env),publicKey:pushConfigured(env)?env.VAPID_PUBLIC_KEY:null,devices:(await env.DB.prepare('SELECT id,device_label,created_at,last_success_at FROM push_subscriptions WHERE user_id=? AND revoked_at IS NULL').bind(user.uid).all()).results};
 requireThat(env.APP_WRITES_ENABLED==='true','Sewak is temporarily read-only.',503,'maintenance');badInput(request.method==='POST');
 if(path==='/api/notifications/read') {
  onlyKeys(body,['id','all']);badInput(body.all===true||typeof body.id==='string'&&body.id.length<=500);
  if(body.all===true)await env.DB.prepare('UPDATE notifications SET read_at=? WHERE recipient_id=? AND read_at IS NULL').bind(epoch(),user.uid).run();
  else {const result=await env.DB.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE recipient_id=? AND id=?').bind(epoch(),user.uid,body.id).run();requireThat(result.meta.changes>0,'Notification not found.',404,'not-found');}
  return {updated:true};
 }
 if(path==='/api/notifications/preferences') {
  onlyKeys(body,['categories','language']);badInput(['en','ne'].includes(body.language)&&body.categories&&typeof body.categories==='object');onlyKeys(body.categories,Object.keys(defaultPreferences));
  const saved:Data={};for(const [category,defaults]of Object.entries(defaultPreferences)){const value=body.categories[category]||defaults;onlyKeys(value,['inApp','email','push']);badInput(Object.values(value).every(v=>typeof v==='boolean'));saved[category]={...defaults,...value,...(category==='security'?{inApp:true,email:true}:{})};}
  await env.DB.prepare('INSERT INTO notification_preferences(user_id,preferences_json,language,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET preferences_json=excluded.preferences_json,language=excluded.language,updated_at=excluded.updated_at').bind(user.uid,JSON.stringify(saved),body.language,epoch()).run();return {saved:true};
 }
 if(path==='/api/notifications/subscribe') {
  requireThat(pushConfigured(env),'Push notifications are not configured.',503,'push-unavailable');onlyKeys(body,['subscription','label']);badInput(typeof body.label==='string'&&body.label.length>=1&&body.label.length<=80);
  const subscription=validatePush(body.subscription),hash=await digest(subscription.endpoint),existing=await env.DB.prepare('SELECT id,user_id FROM push_subscriptions WHERE endpoint_hash=?').bind(hash).first<Data>();
  requireThat(!existing||existing.user_id===user.uid,'This browser subscription belongs to another account. Unsubscribe it in the browser first.',409,'subscription-owned');
  const count=await env.DB.prepare('SELECT COUNT(*) n FROM push_subscriptions WHERE user_id=? AND revoked_at IS NULL').bind(user.uid).first<Data>();requireThat(existing||count!.n<10,'Remove a device before adding another.',400,'device-limit');
  const id=existing?.id||crypto.randomUUID(),c=await env.DB.prepare('SELECT credential_version FROM cf_credentials WHERE user_id=?').bind(user.uid).first<Data>();
  // A concurrent enrollment must not replace ciphertext bound to another row ID.
  const saved=await env.DB.prepare('INSERT INTO push_subscriptions(id,user_id,endpoint_hash,encrypted_subscription,device_label,credential_version,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(endpoint_hash) DO UPDATE SET encrypted_subscription=excluded.encrypted_subscription,device_label=excluded.device_label,credential_version=excluded.credential_version,revoked_at=NULL WHERE push_subscriptions.user_id=excluded.user_id AND push_subscriptions.id=excluded.id').bind(id,user.uid,hash,await seal(env,subscription,id),body.label,c!.credential_version,epoch()).run();
  requireThat(saved.meta.changes===1,'This subscription changed. Refresh and retry.',409,'subscription-conflict');return {id};
 }
 if(path==='/api/notifications/unsubscribe') {
  onlyKeys(body,['id']);badInput(typeof body.id==='string'&&body.id.length<=100);await env.DB.prepare('UPDATE push_subscriptions SET revoked_at=? WHERE id=? AND user_id=?').bind(epoch(),body.id,user.uid).run();return {removed:true};
 }
 requireThat(false,'Endpoint not found.',404,'not-found');
}
export async function scheduleNotifications(env:Env) {
 if(env.APP_WRITES_ENABLED!=='true'||env.NOTIFICATION_PROCESSING_ENABLED!=='true')return;
 const escalation=Math.min(168,Math.max(1,Number(env.PENDING_ESCALATION_HOURS)||6));
 for(const hours of [24,1])await env.DB.prepare(`INSERT OR IGNORE INTO notifications(id,recipient_id,organization_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 SELECT 'reminder:'||b.id||':'||?||':'||p.recipient_id,p.recipient_id,b.organization_id,'booking_reminder',b.id,'reminders','Upcoming Sewak booking','Your confirmed booking is coming up. View your schedule in Nepal Time.',CASE p.participant_role WHEN 'user' THEN '/user/bookings/'||b.id WHEN 'caregiver' THEN '/caregiver/schedule' ELSE '/organization/dashboard' END,5,'reminder:'||b.id||':'||?||':'||p.recipient_id
 FROM bookings b JOIN booking_notification_participants p ON p.booking_id=b.id WHERE b.status IN ('accepted','confirmed') AND unixepoch(b.schedule_at)>? AND unixepoch(b.schedule_at)<=? AND unixepoch(b.schedule_at)>? AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.id='reminder:'||b.id||':'||?||':'||p.recipient_id) LIMIT 60`).bind(hours,hours,epoch(),epoch()+hours*3600,epoch()+(hours===24?3600:0),hours).run();
 await env.DB.prepare(`INSERT OR IGNORE INTO notifications(id,recipient_id,organization_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 SELECT 'escalation:'||b.id||':'||p.recipient_id,p.recipient_id,b.organization_id,'pending_escalation',b.id,'booking','Booking response needed','A booking request is still waiting for an authorized response.',CASE p.participant_role WHEN 'caregiver' THEN '/caregiver/jobs' ELSE '/organization/dashboard' END,4,'escalation:'||b.id||':'||p.recipient_id
 FROM bookings b JOIN booking_notification_participants p ON p.booking_id=b.id WHERE b.status='pending' AND p.participant_role<>'user' AND unixepoch(b.created_at)<=? AND unixepoch(b.schedule_at)>? AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.id='escalation:'||b.id||':'||p.recipient_id) LIMIT 60`).bind(epoch()-escalation*3600,epoch()).run();
 await env.DB.batch([
  env.DB.prepare("UPDATE notification_outbox SET status='permanent_failure',last_error_code='expired',encrypted_payload=NULL WHERE id IN (SELECT id FROM notification_outbox WHERE expires_at<? AND status IN ('pending','temporary_failure','deferred_quota') LIMIT 100)").bind(epoch()),
  env.DB.prepare('DELETE FROM cf_email_tokens WHERE id IN (SELECT id FROM cf_email_tokens WHERE expires_at<? LIMIT 100)').bind(epoch()-86400),
  env.DB.prepare('DELETE FROM cf_oauth_states WHERE expires_at<?').bind(epoch()),
  env.DB.prepare("DELETE FROM notifications WHERE id IN (SELECT id FROM notifications WHERE created_at<? AND NOT EXISTS(SELECT 1 FROM notification_outbox o WHERE o.notification_id=notifications.id AND o.status IN ('pending','processing','temporary_failure','deferred_quota')) LIMIT 100)").bind(epoch()-90*86400)
 ]);
}
