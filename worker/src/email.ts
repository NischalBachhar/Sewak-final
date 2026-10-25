import { requireThat, type Env, type Data } from './types.ts';

export function emailReady(env:Env) { return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM && env.APP_ORIGIN); }
export function appOrigin(env:Env) {
  requireThat(env.APP_ORIGIN,'Email and Google access are not configured.',503,'unavailable');
  const url=new URL(env.APP_ORIGIN!);
  requireThat(url.protocol==='https:' && url.origin===env.APP_ORIGIN,'Invalid application origin.',503,'unavailable');
  return url.origin;
}
export async function sendEmail(env:Env,to:string,subject:string,text:string,key:string) {
  requireThat(emailReady(env),'Email delivery is temporarily unavailable. Please try again later.',503,'email-unavailable');
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',signal:AbortSignal.timeout(10000),
    headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},
    body:JSON.stringify({from:env.EMAIL_FROM,to:[to],subject,text}),
  });
  // Never log provider response bodies: they may contain addresses or links.
  requireThat(response.ok,'Email delivery is temporarily unavailable. Please try again later.',503,'email-unavailable');
}
export async function deliverNotificationEmails(env:Env) {
  if(env.APP_WRITES_ENABLED!=='true'||!emailReady(env))return;
  const origin=appOrigin(env),now=Math.floor(Date.now()/1000);
  // Opt-in and verified recipients only; no historical mail flood after rollout.
  const rows=await env.DB.prepare(`SELECT n.id,n.title,n.link,c.email FROM care_notifications n
    JOIN cf_credentials c ON c.user_id=n.recipient_id
    JOIN users u ON u.id=c.user_id
    JOIN care_notification_preferences p ON p.user_id=c.user_id
    LEFT JOIN care_email_deliveries d ON d.notification_id=n.id
    WHERE p.email_updates=1 AND c.email_verified_at IS NOT NULL AND c.disabled=0
      AND COALESCE(u.is_suspended,0)=0 AND COALESCE(u.is_blacklisted,0)=0
      AND NOT EXISTS(SELECT 1 FROM caregivers v JOIN organizations o ON o.id=v.organization_id WHERE v.id=c.user_id AND (o.is_suspended=1 OR o.is_blacklisted=1))
      AND (n.event_type!='booking-reminder' OR p.booking_reminders=1)
      AND n.created_at>=? AND n.created_at>=p.email_enabled_at AND d.accepted_at IS NULL AND d.failed_at IS NULL
      AND COALESCE(d.attempts,0)<5 AND COALESCE(d.retry_at,0)<=?
    ORDER BY n.created_at LIMIT 20`).bind(new Date((now-86400)*1000).toISOString(),now).all<Data>();
  for(const row of rows.results){
    const claim=await env.DB.prepare(`INSERT INTO care_email_deliveries(notification_id,attempts,retry_at) VALUES(?,1,?)
      ON CONFLICT(notification_id) DO UPDATE SET attempts=attempts+1,retry_at=excluded.retry_at
      WHERE accepted_at IS NULL AND failed_at IS NULL AND attempts<5 AND retry_at<=? RETURNING attempts`)
      .bind(row.id,now+900,now).first<Data>();
    if(!claim)continue;
    try{
      const link=new URL(row.link,origin);
      if(link.origin!==origin)throw new Error('Invalid notification link');
      // Keep sensitive booking details inside the authenticated app.
      await sendEmail(env,row.email,'Sewak: '+row.title,'There is a new update in your Sewak account. Sign in to review it:\n\n'+link.href+'\n\nYou can turn off email updates in Sewak notification preferences.','notice-'+row.id);
      await env.DB.prepare('UPDATE care_email_deliveries SET accepted_at=? WHERE notification_id=?').bind(now,row.id).run();
    }catch{
      await env.DB.prepare('UPDATE care_email_deliveries SET failed_at=CASE WHEN attempts>=5 THEN ? ELSE NULL END WHERE notification_id=?').bind(now,row.id).run();
    }
  }
  await env.DB.prepare('DELETE FROM cf_google_states WHERE expires_at<?').bind(now).run();
  await env.DB.prepare('DELETE FROM cf_email_tokens WHERE expires_at<?').bind(now-86400).run();
}
