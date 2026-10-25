import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,put} from './harness.mjs';
import {createWorker} from '../../worker/src/index.ts';
import {digest,epoch,opaque} from '../../worker/src/cloudflare-auth.ts';
import {googleIdentity} from '../../worker/src/google-auth.ts';
import {deliverNotificationEmails} from '../../worker/src/email.ts';
const worker=createWorker(),password='Synthetic-password-123!',origin='https://sewak.test';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key',alg:'RS256',use:'sig'};
const b64=x=>Buffer.from(x).toString('base64url');
async function idToken(overrides={}){
 const payload={iss:'https://accounts.google.com',aud:'test-client',sub:'google-person',email:'person@gmail.com',email_verified:true,name:'Google Person',nonce:'test-nonce',iat:epoch(),exp:epoch()+300,...overrides};
 const unsigned=b64(JSON.stringify({alg:'RS256',kid:'test-key'}))+'.'+b64(JSON.stringify(payload));
 return unsigned+'.'+b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(unsigned)));
}
const setup=()=>({...environment(),APP_ORIGIN:origin,GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'synthetic-only',RESEND_API_KEY:'synthetic-only',EMAIL_FROM:'Sewak <care@sewak.test>'});
async function req(env,path,body,headers={}){
 const response=await worker.fetch(new Request(origin+'/api/auth/'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{Origin:origin,'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
 return {response,status:response.status,data:response.headers.get('Content-Type')?.includes('json')&&response.status!==303?await response.json():null};
}
async function register(env,email='person@gmail.com'){
 const r=await req(env,'register',{email,password,name:'Test Person'});assert.equal(r.status,200,JSON.stringify(r.data));
 return {uid:r.data.user.uid,headers:{Cookie:r.response.headers.get('Set-Cookie').split(';')[0],'X-CSRF-Token':r.data.csrfToken}};
}
async function googleStart(env,headers={}){
 const r=await req(env,'google/start',{},headers);assert.equal(r.status,200,JSON.stringify(r.data));const url=new URL(r.data.url);
 const state=url.searchParams.get('state'),pending=await env.DB.prepare('SELECT * FROM cf_google_states WHERE token_hash=?').bind(await digest(state)).first();
 return {r,url,state,pending,cookie:r.response.headers.get('Set-Cookie').split(';')[0]};
}
async function provider(t,claims={}){
 const old=globalThis.fetch,mails=[];
 globalThis.fetch=async(url,options)=>{
  if(url==='https://oauth2.googleapis.com/token')return Response.json({id_token:await idToken(claims)});
  if(url==='https://www.googleapis.com/oauth2/v3/certs')return Response.json({keys:[jwk]});
  if(url==='https://api.resend.com/emails'){mails.push({body:JSON.parse(options.body),headers:options.headers});return Response.json({id:'synthetic'});}
  throw Error('Unexpected network request');
 };
 t.after(()=>{globalThis.fetch=old;});return mails;
}
const mailToken=mail=>new URLSearchParams(new URL(mail.body.text.match(/https:\/\/\S+/)[0]).hash.slice(1)).get('token');

test('password recovery is non-enumerating; reset is hashed, single-use and revokes every old session',async t=>{
 const mails=await provider(t),env=setup(),a=await register(env);mails.length=0;
 const known=await req(env,'forgot-password',{email:'PERSON@gmail.com'}),unknown=await req(env,'forgot-password',{email:'unknown@gmail.com'});
 assert.equal(known.status,200);assert.deepEqual(known.data,unknown.data);assert.equal(mails.length,1);
 const token=mailToken(mails[0]),row=await env.DB.prepare("SELECT * FROM cf_email_tokens WHERE purpose='reset'").first();assert.equal(row.token_hash,await digest(token));assert.ok(!JSON.stringify(row).includes(token));
 const changed=await req(env,'reset-password',{token,password:'Replacement-password-456!'});assert.equal(changed.status,200,JSON.stringify(changed.data));assert.match(changed.response.headers.get('Set-Cookie'),/Max-Age=0/);
 assert.equal((await req(env,'me',undefined,a.headers)).status,401);assert.equal((await req(env,'login',{email:'person@gmail.com',password})).status,401);
 assert.equal((await req(env,'login',{email:'person@gmail.com',password:'Replacement-password-456!'})).status,200);
 assert.equal((await req(env,'reset-password',{token,password})).status,400);assert.ok((await env.DB.prepare('SELECT email_verified_at FROM cf_credentials').first()).email_verified_at);
});
test('verification is single-use, does not change passwords, and requires same-origin POST',async t=>{
 const mails=await provider(t),env=setup();await register(env);const token=mailToken(mails[0]);
 assert.equal((await req(env,'verify-email',{token},{Origin:'https://evil.test'})).status,403);
 assert.equal((await req(env,'verify-email',{token})).status,200);assert.equal((await req(env,'verify-email',{token})).status,400);
 assert.equal((await req(env,'login',{email:'person@gmail.com',password})).status,200);
});
test('expired, disabled and credential-invalidated email links cannot change a password',async t=>{
 const mails=await provider(t),env=setup();await register(env);
 for(const condition of ['expires_at','credential_version','disabled']){
  await env.DB.prepare('UPDATE cf_credentials SET disabled=0').run();await req(env,'forgot-password',{email:'person@gmail.com'});const token=mailToken(mails.at(-1));
  if(condition==='disabled')await env.DB.prepare('UPDATE cf_credentials SET disabled=1').run();
  else await env.DB.prepare(`UPDATE cf_email_tokens SET ${condition}=0 WHERE token_hash=?`).bind(await digest(token)).run();
  assert.equal((await req(env,'reset-password',{token,password:'Replacement-password-456!'})).status,400);
 }
});
test('unconfigured email reports unavailable consistently and never exposes tokens',async()=>{
 const env=environment();for(const email of ['person@gmail.com','unknown@gmail.com'])assert.equal((await req(env,'forgot-password',{email})).status,503);
 const options=await req(env,'options');assert.deepEqual(options.data,{google:false,email:false});assert.equal((await req(env,'google/start',{})).status,503);
});
test('recovery has persistent per-address rate limits',async t=>{
 await provider(t);const env=setup();for(let n=0;n<10;n++)assert.equal((await req(env,'forgot-password',{email:'unknown@gmail.com'})).status,200);
 assert.equal((await req(env,'forgot-password',{email:'UNKNOWN@gmail.com'})).status,429);
});
test('Google flow binds PKCE, nonce and state to a secure cookie and creates an unprivileged account',async t=>{
 const env=setup(),start=await googleStart(env);await provider(t,{nonce:start.pending.nonce});
 assert.equal(start.url.searchParams.get('scope'),'openid email profile');assert.equal(start.url.searchParams.get('code_challenge_method'),'S256');
 assert.equal(start.url.searchParams.get('code_challenge'),b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(start.pending.verifier))));
 assert.match(start.r.response.headers.get('Set-Cookie'),/Secure; HttpOnly; SameSite=Lax/);assert.equal(start.pending.token_hash,await digest(start.state));
 const r=await req(env,'google/callback?state='+start.state+'&code=test-code',undefined,{Cookie:start.cookie});assert.equal(r.status,303);assert.equal(r.response.headers.get('Location'),origin+'/');
 const c=await env.DB.prepare('SELECT * FROM cf_credentials').first();assert.equal(c.google_sub,'google-person');assert.equal(c.password_hash,null);assert.ok(c.email_verified_at);
 const u=await env.DB.prepare('SELECT role FROM users WHERE id=?').bind(c.user_id).first();assert.equal(u.role,'user');
 const replay=await req(env,'google/callback?state='+start.state+'&code=test-code',undefined,{Cookie:start.cookie});assert.match(replay.response.headers.get('Location'),/google=failed/);
});
test('Google callback rejects missing cookie, expired state, and cancellation safely',async()=>{
 const env=setup(),start=await googleStart(env);
 const missing=await req(env,'google/callback?state='+start.state+'&code=test-code');assert.match(missing.response.headers.get('Location'),/google=failed/);assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM cf_credentials').first()).n,0);
 const cancel=await req(env,'google/callback?state='+start.state+'&error=access_denied',undefined,{Cookie:start.cookie});assert.match(cancel.response.headers.get('Location'),/google=cancelled/);
 const next=await googleStart(env);await env.DB.prepare('UPDATE cf_google_states SET expires_at=0').run();const expired=await req(env,'google/callback?state='+next.state+'&code=test-code',undefined,{Cookie:next.cookie});assert.match(expired.response.headers.get('Location'),/google=failed/);
});
test('an existing password account cannot be silently linked; authenticated linking retains its role',async t=>{
 const env=setup();await provider(t);const a=await register(env),anonymous=await googleStart(env);
 const oldFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>url==='https://oauth2.googleapis.com/token'?Response.json({id_token:await idToken({nonce:anonymous.pending.nonce})}):oldFetch(url,options);
 const denied=await req(env,'google/callback?state='+anonymous.state+'&code=test-code',undefined,{Cookie:anonymous.cookie});assert.match(denied.response.headers.get('Location'),/link-required/);assert.equal((await env.DB.prepare('SELECT google_sub FROM cf_credentials').first()).google_sub,null);
 await env.DB.prepare("UPDATE users SET role='superadmin' WHERE id=?").bind(a.uid).run();
 const link=await googleStart(env,a.headers);globalThis.fetch=async(url,options)=>url==='https://oauth2.googleapis.com/token'?Response.json({id_token:await idToken({nonce:link.pending.nonce})}):oldFetch(url,options);
 const linked=await req(env,'google/callback?state='+link.state+'&code=test-code',undefined,{Cookie:a.headers.Cookie+'; '+link.cookie});assert.equal(linked.response.headers.get('Location'),origin+'/');assert.equal((await env.DB.prepare('SELECT google_sub FROM cf_credentials').first()).google_sub,'google-person');assert.equal((await env.DB.prepare('SELECT role FROM users WHERE id=?').bind(a.uid).first()).role,'superadmin');
});
for(const [name,claims] of Object.entries({audience:{aud:'evil'},issuer:{iss:'https://evil.test'},nonce:{nonce:'wrong'},expiry:{exp:0},issued:{iat:epoch()+1000},unverified:{email_verified:false},thirdparty:{email:'person@example.test'},subject:{sub:''},azp:{azp:'evil'}})){
 test('Google identity rejects '+name,async t=>{const env=setup();await provider(t,claims);await assert.rejects(()=>googleIdentity(env,'code','verifier','test-nonce'));});
}
test('Google identity rejects a tampered signature',async t=>{
 const env=setup(),token=await idToken(),old=globalThis.fetch;t.after(()=>{globalThis.fetch=old;});globalThis.fetch=async url=>url.includes('/token')?Response.json({id_token:token.slice(0,-6)+'AAAAAA'}):Response.json({keys:[jwk]});await assert.rejects(()=>googleIdentity(env,'code','verifier','test-nonce'));
});
test('email preferences require verification; reminders and email options remain independent',async t=>{
 const mails=await provider(t),env=setup(),a=await register(env);
 const route=async body=>{const response=await worker.fetch(new Request(origin+'/api/care-notifications',{method:'POST',headers:{...a.headers,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),env);return {status:response.status,data:await response.json()};};
 assert.equal((await route({action:'preferences',emailUpdates:true})).status,400);
 await req(env,'verify-email',{token:mailToken(mails[0])});assert.equal((await route({action:'preferences',emailUpdates:true})).status,200);
 assert.equal((await route({action:'preferences',bookingReminders:false})).status,200);
 const p=await env.DB.prepare('SELECT * FROM care_notification_preferences').first();assert.equal(p.email_updates,1);assert.equal(p.booking_reminders,0);assert.ok(p.email_enabled_at);
 assert.equal((await route({action:'preferences',emailUpdates:'true'})).status,400);
});
test('notification mail respects verification, opt-in, reminder choice, privacy, and idempotence',async t=>{
 const mails=await provider(t),env=setup(),a=await register(env);mails.length=0;
 await env.DB.prepare("INSERT INTO care_notification_preferences(user_id,booking_reminders,email_updates,email_enabled_at,updated_at) VALUES(?,0,1,'2026-01-01','2026-01-01')").bind(a.uid).run();
 for(const [id,event] of [['update','booking-accepted'],['reminder','booking-reminder']])await env.DB.prepare('INSERT INTO care_notifications(id,recipient_id,event_type,context_id,title,body,link,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,a.uid,event,'ctx','Booking accepted','PRIVATE medical details','/user/bookings/ctx',new Date().toISOString()).run();
 await deliverNotificationEmails(env);assert.equal(mails.length,0);
 await env.DB.prepare('UPDATE cf_credentials SET email_verified_at=?').bind(epoch()).run();await deliverNotificationEmails(env);assert.equal(mails.length,1);assert.ok(!JSON.stringify(mails).includes('PRIVATE'));assert.equal(mails[0].headers['Idempotency-Key'],'notice-update');
 await deliverNotificationEmails(env);assert.equal(mails.length,1);assert.ok((await env.DB.prepare("SELECT accepted_at FROM care_email_deliveries WHERE notification_id='update'").first()).accepted_at);
});
test('notification provider failures retry with the same key without rolling back bookings',async t=>{
 const mails=await provider(t),env=setup(),a=await register(env);mails.length=0;
 await env.DB.prepare('UPDATE cf_credentials SET email_verified_at=?').bind(epoch()).run();
 await env.DB.prepare("INSERT INTO care_notification_preferences(user_id,booking_reminders,email_updates,email_enabled_at,updated_at) VALUES(?,1,1,'2026-01-01','2026-01-01')").bind(a.uid).run();
 await env.DB.prepare("INSERT INTO care_notifications(id,recipient_id,event_type,context_id,title,body,link,created_at) VALUES('retry',?,'booking-accepted','ctx','Booking accepted','Update','/user/bookings/ctx',?)").bind(a.uid,new Date().toISOString()).run();
 const success=globalThis.fetch;globalThis.fetch=async()=>new Response('unavailable',{status:503});await deliverNotificationEmails(env);
 const failed=await env.DB.prepare('SELECT * FROM care_email_deliveries').first();assert.equal(failed.attempts,1);assert.equal(failed.accepted_at,null);
 globalThis.fetch=success;await env.DB.prepare('UPDATE care_email_deliveries SET retry_at=0').run();await deliverNotificationEmails(env);assert.equal(mails[0].headers['Idempotency-Key'],'notice-retry');assert.equal((await env.DB.prepare('SELECT attempts FROM care_email_deliveries').first()).attempts,2);
});

test('deployed recovery returns without waiting for provider delivery',async t=>{
 await provider(t);const env=setup();await register(env);
 const old=globalThis.fetch;let release,observe;const started=new Promise(resolve=>{observe=resolve;});const pending=new Promise(resolve=>{release=resolve;});globalThis.fetch=async()=>{observe();await pending;return Response.json({id:'synthetic'});};t.after(()=>{release();globalThis.fetch=old;});
 const tasks=[],context={waitUntil:p=>tasks.push(p)};
 const response=await worker.fetch(new Request(origin+'/api/auth/forgot-password',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'person@gmail.com'})}),env,context);
 assert.equal(response.status,200);assert.equal(tasks.length,1);await started;release();await Promise.all(tasks);
});
