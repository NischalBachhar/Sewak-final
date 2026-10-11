import { unbase64 } from './secret-box.ts';
import { epoch } from './cloudflare-auth.ts';
import { boundedBytes } from './media.ts';
import { badInput, requireThat, type Data, type Env } from './types.ts';
// Resend's Svix signing protocol. Authenticate the exact bytes before parsing.
export async function emailWebhook(request:Request,env:Env) {
 requireThat(env.RESEND_WEBHOOK_SECRET?.startsWith('whsec_'),'Webhook not configured.',503,'unavailable');
 badInput(request.method==='POST');const id=request.headers.get('svix-id')||'',time=request.headers.get('svix-timestamp')||'',signatures=request.headers.get('svix-signature')||'';
 requireThat(/^[\w-]{1,128}$/.test(id)&&/^\d{10}$/.test(time)&&Math.abs(epoch()-Number(time))<=300,'Invalid webhook.',401,'invalid-signature');
 const bytes=await boundedBytes(request,64000),raw=new TextDecoder().decode(bytes),key=await crypto.subtle.importKey('raw',unbase64(env.RESEND_WEBHOOK_SECRET!.slice(6)),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 let valid=false;for(const signature of signatures.split(' ').slice(0,5)){const [version,encoded]=signature.split(',');if(version!=='v1'||!encoded)continue;try{valid=await crypto.subtle.verify('HMAC',key,unbase64(encoded),new TextEncoder().encode(id+'.'+time+'.'+raw))||valid;}catch{}}
 requireThat(valid,'Invalid webhook.',401,'invalid-signature');let event:Data;try{event=JSON.parse(raw);}catch{badInput(false);return;}
 const status=event.type==='email.delivered'?'delivered':['email.bounced','email.failed','email.complained'].includes(event.type)?'permanent_failure':null;
 if(!status)return {received:true};badInput(typeof event.data?.email_id==='string'&&event.data.email_id.length<=200);
 if(await env.DB.prepare('SELECT id FROM email_webhook_receipts WHERE id=?').bind(id).first())return {received:true};
 const row=await env.DB.prepare('SELECT id FROM notification_outbox WHERE provider_reference=? AND channel=\'email\'').bind(event.data.email_id).first<Data>();
 // Retry if the callback beat the dispatcher acknowledgement; never drop it.
 requireThat(row,'Provider acknowledgement is pending.',503,'retry-webhook');
 await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO email_webhook_receipts(id,created_at) VALUES(?,?)').bind(id,epoch()),env.DB.prepare("UPDATE notification_outbox SET status=?,last_error_code=?,updated_at=? WHERE id=? AND status IN ('accepted','delivered')").bind(status,status==='permanent_failure'?event.type:null,epoch(),row.id)]);
 return {received:true};
}
