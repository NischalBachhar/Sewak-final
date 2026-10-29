import { emailReady } from './email.ts';
import { googleReady } from './google-auth.ts';
import type { Write, Saved } from './repository.ts';
import { Repository, requireActive } from './repository.ts';
import { badInput, onlyKeys, requireThat, type Actor, type Data, type Env } from './types.ts';

type Notice = {to:string;event:string;title:string;body:string;link:string;ctx:string;id:string;created:string};
const now = () => new Date().toISOString();
function createNotice(env:Env,n:Notice) {
  // Some migration-era published caregiver profiles do not yet have a login.
  // A valid booking must not fail a foreign key because its recipient cannot
  // receive an in-app alert. It will still alert the signed-in customer.
  return env.DB.prepare('INSERT OR IGNORE INTO care_notifications(id,recipient_id,event_type,context_id,title,body,link,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM users WHERE id=?)')
    .bind(n.id,n.to,n.event,n.ctx,n.title,n.body,n.link,n.created,n.to);
}
export function notificationStatements(env:Env,writes:Write[],reads:Map<string,Saved>):D1PreparedStatement[] {
  const statements:D1PreparedStatement[]=[];
  for (const write of writes) {
    if(!write.data)continue;
    if(write.path.startsWith('vendors/')){
      const previous=reads.get(write.path)?.data;
      if(previous && !previous.isApproved && write.data.isApproved === true && !write.data.isSuspended){
        const id=write.path.slice(8),version=(reads.get(write.path)?.version||0)+1;
        statements.push(createNotice(env,{id:'caregiver-approved:'+id+':'+version,to:id,event:'caregiver-approved',
          title:'Caregiver account approved',body:'You can now complete your availability and apply for care jobs.',
          link:'/caregiver',ctx:id,created:now()}));
      }
      continue;
    }
    if(write.path.startsWith('organizations/')){
      const old=reads.get(write.path)?.data;
      if(old && !old.isApproved && write.data.isApproved === true && !write.data.isSuspended){
        const id=write.path.slice(14),version=(reads.get(write.path)?.version||0)+1;
        const notice={id:'organization-approved:'+id+':'+version,event:'organization-approved',
          title:'Your organization is approved',body:'Your Sewak organization is approved. Complete setup to publish available services.',
          link:'/organization',ctx:id,created:now()};
        statements.push(env.DB.prepare(`INSERT OR IGNORE INTO care_notifications(id,recipient_id,event_type,context_id,title,body,link,created_at)
          SELECT ?,o.admin_uid,?,?,?,?,?,? FROM organizations o JOIN users u ON u.id=o.admin_uid WHERE o.id=?`)
         .bind(notice.id,notice.event,notice.ctx,notice.title,notice.body,notice.link,notice.created,id));
      }
      continue;
    }
    if(!write.path.startsWith('bookings/'))continue;
    const contextId=write.path.slice('bookings/'.length);
    const before=reads.get(write.path);
    const old=before?.data;
    // Only a new request or an actual lifecycle transition creates an event.
    if (!before || (!!old && old.status===write.data.status)) continue;
    const data=write.data,status=String(data.status||'');
    const customerId=data.userId,caregiverId=data.caregiverId;
    if(typeof customerId!=='string'||typeof caregiverId!=='string')continue;
    const version=(before.version||0)+1,created=now();
    const notice=(to:string,event:string,title:string,body:string,link:string) =>
      createNotice(env,{to,event,title,body,link,ctx:contextId,created,
        id:['booking',contextId,version,event,to].join(':')});
    const customerLink='/user/bookings/'+encodeURIComponent(contextId);
    const caregiverLink='/caregiver?tab=jobs';
    if(!old && status==='pending') {
      statements.push(notice(customerId,'booking-received','Request received','Your request has been sent. It is not confirmed until the caregiver accepts.',customerLink));
      statements.push(notice(caregiverId,'booking-requested','New care request','A family has requested a care session. Review it in your jobs.',caregiverLink));
      if(typeof data.organizationId==='string'&&data.organizationId) {
        const id=['booking',contextId,version,'organization-requested',data.organizationId].join(':');
        statements.push(env.DB.prepare(`INSERT OR IGNORE INTO care_notifications(id,recipient_id,event_type,context_id,title,body,link,created_at)
          SELECT ?,o.admin_uid,'organization-requested',?,'New team care request','A caregiver in your team received a booking request.','/organization?tab=bookings',?
          FROM organizations o JOIN users u ON u.id=o.admin_uid WHERE o.id=? AND o.admin_uid IS NOT NULL`)
          .bind(id,contextId,created,data.organizationId));
      }
    } else if(old && old.status!==status) {
      const messages:Record<string,[string,string,string]> = {
        accepted:['booking-accepted','Booking accepted','Your caregiver accepted the request. Review your booking details.'],
        confirmed:['booking-accepted','Booking accepted','Your caregiver accepted the request. Review your booking details.'],
        cancelled:['booking-cancelled','Booking cancelled','This care request has been cancelled. Review its status.'],
        in_progress:['care-started','Care started','Your scheduled care session has begun.'],
        completed:['care-completed','Care completed','Your care session has finished. You can review your experience.'],
      };
      const details=messages[status];
      if(details) {
        statements.push(notice(customerId,details[0],details[1],details[2],customerLink));
        if(status==='cancelled') statements.push(notice(caregiverId,'booking-cancelled','Care request cancelled','A scheduled request has been cancelled.',caregiverLink));
      }
    }
  }
  return statements;
}

export async function notificationsRoute(request:Request,repo:Repository,actor:Actor|null,input:Data={}) {
  const user=requireActive(actor),db=repo.env.DB;
  if(request.method==='GET') {
    const [items, count, preferences, credentials]=await Promise.all([
      db.prepare('SELECT id,event_type AS eventType,context_id AS contextId,title,body,link,created_at AS createdAt,read_at AS readAt FROM care_notifications WHERE recipient_id=? ORDER BY created_at DESC,id DESC LIMIT 60')
        .bind(user.uid).all<Data>(),
      db.prepare('SELECT COUNT(*) AS unread FROM care_notifications WHERE recipient_id=? AND read_at IS NULL').bind(user.uid).first<Data>(),
      db.prepare('SELECT booking_reminders,email_updates FROM care_notification_preferences WHERE user_id=?').bind(user.uid).first<Data>(),
      db.prepare('SELECT email_verified_at,google_sub FROM cf_credentials WHERE user_id=?').bind(user.uid).first<Data>(),
    ]);
    return {items:items.results,unread:Number(count?.unread||0),preferences:{bookingReminders:preferences?.booking_reminders!==0,emailUpdates:preferences?.email_updates===1},delivery:{inApp:true,email:emailReady(repo.env)&&Boolean(credentials?.email_verified_at)&&preferences?.email_updates===1,emailConfigured:emailReady(repo.env),emailVerified:Boolean(credentials?.email_verified_at),googleConnected:Boolean(credentials?.google_sub),googleAvailable:googleReady(repo.env),webPush:false}};
  }
  requireThat(request.method==='POST','Unsupported notification action.',405,'method-not-allowed');
  requireThat(repo.env.APP_WRITES_ENABLED==='true','Notifications are read-only during maintenance.',503,'maintenance');
  onlyKeys(input,['action','id','bookingReminders','emailUpdates']);
  if(input.action==='preferences'){
    badInput(input.id===undefined&&(typeof input.bookingReminders==='boolean'||typeof input.emailUpdates==='boolean')
      &&(input.bookingReminders===undefined||typeof input.bookingReminders==='boolean')&&(input.emailUpdates===undefined||typeof input.emailUpdates==='boolean'),'Choose a notification preference.');
    if(input.emailUpdates===true){
      requireThat(emailReady(repo.env),'Email updates are not configured yet.',503,'email-unavailable');
      const c=await db.prepare('SELECT email_verified_at FROM cf_credentials WHERE user_id=? AND disabled=0').bind(user.uid).first<Data>();
      requireThat(c?.email_verified_at,'Verify your email before enabling email updates.',400,'email-unverified');
    }
    const reminders=input.bookingReminders===undefined?null:Number(input.bookingReminders),emails=input.emailUpdates===undefined?null:Number(input.emailUpdates),updated=now();
    await repo.commit([],[db.prepare(`INSERT INTO care_notification_preferences(user_id,booking_reminders,email_updates,email_enabled_at,updated_at)
      VALUES(?,COALESCE(?,1),COALESCE(?,0),?,?) ON CONFLICT(user_id) DO UPDATE SET
      booking_reminders=COALESCE(?,booking_reminders),email_enabled_at=CASE WHEN ?=1 AND email_updates=0 THEN excluded.updated_at WHEN ?=0 THEN NULL ELSE email_enabled_at END,
      email_updates=COALESCE(?,email_updates),updated_at=excluded.updated_at`)
      .bind(user.uid,reminders,emails,emails===1?updated:null,updated,reminders,emails,emails,emails)]);
    return {updated:true,preferences:{...(reminders!==null?{bookingReminders:input.bookingReminders}:{}),...(emails!==null?{emailUpdates:input.emailUpdates}:{})}};
  }
  badInput(input.bookingReminders===undefined&&input.emailUpdates===undefined,'Unsupported notification fields.');
  badInput(['read','read-all'].includes(input.action),'Choose a notification action.');
  if(input.action==='read')badInput(typeof input.id==='string'&&input.id.length>=1&&input.id.length<=250,'Invalid notification ID.');
  else badInput(input.id===undefined,'Unsupported notification selection.');
  const sql=input.action==='read'?
    db.prepare('UPDATE care_notifications SET read_at=COALESCE(read_at,?) WHERE recipient_id=? AND id=?').bind(now(),user.uid,input.id):
    db.prepare('UPDATE care_notifications SET read_at=? WHERE recipient_id=? AND read_at IS NULL').bind(now(),user.uid);
  await repo.commit([],[sql]);
  return {updated:true};
}

export async function scheduledBookingReminders(env:Env) {
  if(env.APP_WRITES_ENABLED!=='true')return;
  const created=new Date().toISOString(),within=new Date(Date.now()+86400000).toISOString();
  // Existing cron runs every 15 minutes. Deterministic IDs make retries safe,
  // and no family names, medical data or private addresses enter notifications.
  for(const role of ['customer','caregiver']){
    const recipient=role==='customer'?'b.user_id':'b.caregiver_id';
    const sql=`INSERT OR IGNORE INTO care_notifications(id,recipient_id,event_type,context_id,title,body,link,created_at)
      SELECT 'booking-reminder:'||b.id||':${role}',${recipient},'booking-reminder',b.id,
        'Upcoming care appointment','Your confirmed care session begins within 24 hours.',
        ${role==='customer'?"'/user/bookings/'||b.id":"'/caregiver?tab=jobs'"},?
      FROM bookings b JOIN users u ON u.id=${recipient}
      WHERE b.status IN ('accepted','confirmed') AND b.schedule_at>? AND b.schedule_at<=?
        AND COALESCE(u.is_suspended,0)=0 AND COALESCE(u.is_blacklisted,0)=0
        AND NOT EXISTS(SELECT 1 FROM care_notification_preferences p WHERE p.user_id=${recipient} AND p.booking_reminders=0)`;
    await env.DB.prepare(sql).bind(created,created,within).run();
  }
}
