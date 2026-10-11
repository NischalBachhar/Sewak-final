import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, seed, put, booking, call, timestamp } from './harness.mjs';
import { createWorker } from '../../worker/src/index.ts';
import { digest, epoch, opaque } from '../../worker/src/cloudflare-auth.ts';
import { processOutbox } from '../../worker/src/delivery.ts';
import { scheduleNotifications, validatePush } from '../../worker/src/notifications.ts';
import { unseal, seal } from '../../worker/src/secret-box.ts';
import { base64url } from '../../worker/src/secret-box.ts';
import { emailWebhook } from '../../worker/src/email-webhook.ts';
import { registrationEmail } from '../../worker/src/email-auth.ts';
import { verifyGoogleToken } from '../../worker/src/google-auth.ts';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from '../../worker/node_modules/jose/dist/webapi/index.js';
const worker=createWorker(),password='River8!x';
async function request(env,path,body,token){const r=await worker.fetch(new Request('https://sewak.test/api/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json()};}
async function signup(env,email='owner.test+sewak@gmail.com'){const r=await request(env,'auth/register',{email,password,name:'Synthetic Test',selectedRole:'user',sessionMode:'bearer'});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
async function link(env,uid,purpose='verify'){const row=await env.DB.prepare("SELECT o.* FROM notification_outbox o JOIN cf_email_tokens t ON o.id='auth:'||t.id WHERE t.user_id=? AND t.purpose=? ORDER BY t.created_at DESC,t.rowid DESC LIMIT 1").bind(uid,purpose).first();const mail=await unseal(env,row.encrypted_payload,row.id);return {row,mail,token:new URLSearchParams(mail.text.match(/https:\/\/\S+/)[0].split('#')[1]).get('token')};}
async function verified(env){const a=await signup(env),l=await link(env,a.user.uid);assert.equal((await request(env,'auth/verify-email',{token:l.token})).status,200);return a;}
const count=(env,table)=>env.DB.database.prepare('SELECT COUNT(*) n FROM '+table).get().n;
const resetLease=env=>env.DB.database.exec("DELETE FROM notification_jobs; UPDATE notification_outbox SET next_attempt_at=0");

test('Gmail aliases retain distinct identities; invalid domains, syntax, short and common passwords fail',async()=>{
 const env=environment();assert.equal(registrationEmail(' User.Name+tag@gmail.com ','user',env),'user.name+tag@gmail.com');
 assert.notEqual(registrationEmail('username@gmail.com','user',env),registrationEmail('user.name@gmail.com','user',env));
 for(const email of ['x@example.test','a..b@gmail.com','.a@gmail.com','a@gmail.com.evil','a@@gmail.com'])assert.equal((await request(env,'auth/register',{email,password,name:'Test Person',sessionMode:'bearer'})).status,400);
 for(const pw of ['short','password','12345678'])assert.equal((await request(env,'auth/register',{email:'hello@gmail.com',password:pw,name:'Test Person',sessionMode:'bearer'})).status,400);
 assert.equal(registrationEmail('owner@agency.test','orgadmin',{...env,ORGANIZATION_EMAIL_DOMAINS:'agency.test'}),'owner@agency.test');assert.throws(()=>registrationEmail('owner@agency.test','user',{...env,ORGANIZATION_EMAIL_DOMAINS:'agency.test'}));
});
test('dummy Gmail receives only a restricted session; verification is hashed, expiring, one-time and server enforced',async()=>{
 const env=environment(),a=await signup(env),l=await link(env,a.user.uid);
 assert.equal(a.user.emailVerified,false);assert.equal((await request(env,'records/users/'+a.user.uid,null,a.token)).data.error.code,'email-verification-required');
 assert.equal((await request(env,'notifications',null,a.token)).status,403);
 assert.equal((await request(env,'auth/me',null,a.token)).status,200);
 assert.ok(!JSON.stringify(env.DB.database.prepare('SELECT * FROM cf_email_tokens').all()).includes(l.token));assert.ok(!l.row.encrypted_payload.includes(l.token));assert.ok(l.mail.text.includes('#token='));
 assert.equal((await request(env,'auth/verify-email',{token:opaque()})).status,400);
 assert.equal((await request(env,'auth/verify-email',{token:l.token})).status,200);
 assert.equal((await request(env,'auth/verify-email',{token:l.token})).status,400);
 assert.equal((await request(env,'records/users/'+a.user.uid,null,a.token)).status,200);
 assert.equal((await request(env,'auth/resend-verification',{},a.token)).data.verified,true);
});
test('duplicate signup cannot replace credentials; provider misconfiguration leaves no partial identity',async()=>{
 const env=environment(),a=await signup(env),original=await env.DB.prepare('SELECT password_hash FROM cf_credentials').first();
 const r=await request(env,'auth/register',{email:a.user.email,password:'New12345!',name:'Replacement',sessionMode:'bearer'});assert.equal(r.status,409);assert.equal((await env.DB.prepare('SELECT password_hash FROM cf_credentials').first()).password_hash,original.password_hash);
 const missing=environment();delete missing.RESEND_API_KEY;assert.equal((await request(missing,'auth/register',{email:'test@gmail.com',password,name:'Test Person',sessionMode:'bearer'})).status,503);assert.equal(count(missing,'users'),0);
});
test('expired links and resend cooldown fail; changing a pending address requires password and proof',async()=>{
 const env=environment(),a=await signup(env),l=await link(env,a.user.uid);
 assert.equal((await request(env,'auth/resend-verification',{},a.token)).status,409);
 env.DB.database.exec('UPDATE cf_email_tokens SET expires_at=0,created_at=0');assert.equal((await request(env,'auth/verify-email',{token:l.token})).status,400);
 assert.equal((await request(env,'auth/change-email',{email:'correct@gmail.com',password:'incorrect'},a.token)).status,401);
 assert.equal((await request(env,'auth/change-email',{email:'correct@gmail.com',password},a.token)).status,200);
 assert.equal((await env.DB.prepare('SELECT email FROM cf_credentials').first()).email,a.user.email);
 const change=await link(env,a.user.uid,'change_email');assert.equal((await request(env,'auth/verify-email',{token:change.token})).status,200);
 assert.equal((await env.DB.prepare('SELECT email FROM cf_credentials').first()).email,'correct@gmail.com');assert.equal((await request(env,'auth/me',null,a.token)).status,401);
});
test('ordinary recovery is generic, expires, rejects replay, revokes sessions and preserves privileged recovery',async()=>{
 const env=environment(),a=await verified(env);
 const known=await request(env,'auth/forgot-password',{email:a.user.email}),unknown=await request(env,'auth/forgot-password',{email:'unknown@gmail.com'});assert.deepEqual(known,unknown);
 const l=await link(env,a.user.uid,'reset');assert.equal((await request(env,'auth/reset-password',{token:l.token,password:'Newpass8!'})).status,200);
 assert.equal((await request(env,'auth/me',null,a.token)).status,401);assert.equal((await request(env,'auth/reset-password',{token:l.token,password:'Again123'})).status,400);
 assert.equal((await request(env,'auth/login',{email:a.user.email,password,sessionMode:'bearer'})).status,401);
 assert.equal((await request(env,'auth/login',{email:a.user.email,password:'Newpass8!',sessionMode:'bearer'})).status,200);
 assert.equal(count(env,'notifications'),1);assert.equal((await env.DB.prepare('SELECT category FROM notifications').first()).category,'security');
 env.DB.database.exec("UPDATE users SET role='superadmin'");const n=count(env,'cf_email_tokens');assert.deepEqual(await request(env,'auth/forgot-password',{email:a.user.email}),unknown);assert.equal(count(env,'cf_email_tokens'),n);
});
test('a role elevation after reset issuance prevents public reset and session versions prevent stale links',async()=>{
 const env=environment(),a=await verified(env);await request(env,'auth/forgot-password',{email:a.user.email});const l=await link(env,a.user.uid,'reset');env.DB.database.exec("UPDATE users SET role='superadmin'");assert.equal((await request(env,'auth/reset-password',{token:l.token,password:'Newpass8!'})).status,400);
 env.DB.database.exec("UPDATE users SET role='user'; UPDATE cf_credentials SET credential_version=credential_version+1");assert.equal((await request(env,'auth/reset-password',{token:l.token,password:'Newpass8!'})).status,400);
});
test('booking notifications are atomic, scoped, private and idempotent; confirmation requires authorized acceptance',async()=>{
 const env=environment();await seed(env);env.DB.database.exec('DELETE FROM notification_outbox;DELETE FROM notifications');const b=booking();
 const commit=(uid,writes)=>call(env,'/api/commit',{uid,method:'POST',json:{writes}});
 assert.equal((await commit('customer',[{...b,data:{...b.data,totalAmount:1}}])).status,409);assert.equal(count(env,'notifications'),0);
 assert.equal((await commit('customer',[b])).status,200);assert.equal(count(env,'notifications'),3);assert.equal(count(env,'notification_outbox'),3);assert.ok(!JSON.stringify(env.DB.database.prepare('SELECT * FROM notifications').all()).includes('Test Recipient'));
 await commit('customer',[b]);assert.equal(count(env,'notifications'),3);
 const accept={path:b.path,kind:'update',data:{status:'accepted',updatedAt:timestamp}};assert.equal((await commit('customer',[accept])).status,403);assert.equal(count(env,'notifications'),3);
 assert.equal((await commit('caregiver',[accept])).status,200);assert.equal(count(env,'notifications'),6);
 const customer=await call(env,'/api/notifications',{uid:'customer'}),other=await call(env,'/api/notifications',{uid:'other'});assert.equal(customer.data.notifications.length,2);assert.equal(other.data.notifications.length,0);
 assert.equal((await call(env,'/api/notifications/read',{uid:'other',method:'POST',json:{id:customer.data.notifications[0].id}})).status,404);
 assert.equal((await call(env,'/api/notifications/read',{uid:'customer',method:'POST',json:{all:true}})).status,200);assert.equal((await call(env,'/api/notifications',{uid:'customer'})).data.unread,0);
});
test('D1 batch failure rolls back domain state, events and outbox together',async()=>{
 const env=environment();await seed(env);const before=count(env,'notifications');
 await assert.rejects(env.DB.batch([env.DB.prepare("INSERT INTO bookings(id,user_id,caregiver_id,organization_id,status) VALUES('rollback','customer','caregiver','org','pending')"),env.DB.prepare("INSERT INTO commit_guards(id,valid) VALUES('forced-failure',0)")]));
 assert.equal(count(env,'bookings'),0);assert.equal(count(env,'notifications'),before);
});

test('legacy provider profiles without a login never become invalid notification recipients',async()=>{
 const env=environment();await seed(env);
 await put(env,'vendors/legacy-listing',{name:'Legacy listing',isApproved:false});
 await put(env,'vendors/legacy-listing',{name:'Legacy listing',isApproved:true});
 await put(env,'bookings/legacy-review',{userId:'customer',caregiverId:'legacy-listing',status:'completed'});
 await put(env,'reviews/legacy-review',{bookingId:'legacy-review',customerId:'customer',caregiverId:'legacy-listing',rating:5,isVerifiedReview:true,isHidden:false});
 assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM notifications WHERE recipient_id='legacy-listing'").first()).n,0);
 assert.equal(env.DB.database.prepare('PRAGMA foreign_key_check').all().length,0);
});
test('outbox uses real provider request shape, preserves idempotency and reports accepted, never assumed delivered',async()=>{
 const env=environment(),a=await signup(env);env.NOTIFICATION_PROCESSING_ENABLED='true';const calls=[];
 await processOutbox(env,async(url,init)=>{calls.push({url,init});return Response.json({id:'provider-123'});});
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.resend.com/emails');assert.ok(calls[0].init.headers['Idempotency-Key']);assert.ok(!('tokenId' in JSON.parse(calls[0].init.body)));
 const row=await env.DB.prepare('SELECT * FROM notification_outbox WHERE user_id=?').bind(a.user.uid).first();assert.equal(row.status,'accepted');assert.equal(row.encrypted_payload,null);resetLease(env);await processOutbox(env,()=>{throw new Error('Must not resend accepted work');});assert.equal((await env.DB.prepare('SELECT status FROM notification_outbox').first()).status,'accepted');
});
test('provider errors retry durably, concurrent processing is leased, exhausted quotas defer authentication safely',async()=>{
 const env=environment();await signup(env);env.NOTIFICATION_PROCESSING_ENABLED='true';let calls=0;const send=async()=>{calls++;return new Response(null,{status:429});};
 await Promise.all([processOutbox(env,send),processOutbox(env,send)]);assert.equal(calls,1);assert.equal((await env.DB.prepare('SELECT status FROM notification_outbox').first()).status,'temporary_failure');
 resetLease(env);env.EMAIL_DAILY_CAP='0';await processOutbox(env,send);assert.equal(calls,1);assert.equal((await env.DB.prepare('SELECT status FROM notification_outbox').first()).status,'deferred_quota');
});
test('delivery-time preferences suppress optional email but never mandatory security',async()=>{
 const env=environment(),a=await verified(env);env.NOTIFICATION_PROCESSING_ENABLED='true';env.DB.database.exec("UPDATE notification_outbox SET status='suppressed'");
 await env.DB.prepare("INSERT INTO notification_preferences(user_id,preferences_json,updated_at) VALUES(?, ?, 0)").bind(a.user.uid,JSON.stringify({booking:{email:false},security:{email:false}})).run();
 for(const category of ['booking','security'])await env.DB.prepare('INSERT INTO notifications(id,recipient_id,event_type,entity_id,category,title,message,idempotency_key) VALUES(?,?,?,?,?,?,?,?)').bind(category,a.user.uid,category,a.user.uid,category,'Safe title','Safe message',category).run();
 let calls=0;await processOutbox(env,async()=>{calls++;return Response.json({id:'test'});});assert.equal(calls,1);assert.equal((await env.DB.prepare("SELECT status FROM notification_outbox WHERE id='booking:email'").first()).status,'suppressed');
});
test('reminders and escalation are deduplicated and never automatically accept bookings',async()=>{
 const env=environment();await seed(env);env.NOTIFICATION_PROCESSING_ENABLED='true';
 await put(env,'bookings/soon',{userId:'customer',caregiverId:'caregiver',organizationId:'org',status:'accepted',scheduleAt:new Date(Date.now()+1800000).toISOString()});
 await put(env,'bookings/waiting',{userId:'customer',caregiverId:'caregiver',organizationId:'org',status:'pending',createdAt:new Date(Date.now()-86400000).toISOString(),scheduleAt:new Date(Date.now()+86400000).toISOString()});
 await scheduleNotifications(env);const n=count(env,'notifications');await scheduleNotifications(env);assert.equal(count(env,'notifications'),n);assert.equal((await env.DB.prepare("SELECT status FROM bookings WHERE id='waiting'").first()).status,'pending');assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM notifications WHERE event_type='pending_escalation'").first()).n,2);
});

test('delivery rechecks account suspension before disclosing or sending queued work',async()=>{
 const env=environment(),a=await verified(env);env.NOTIFICATION_PROCESSING_ENABLED='true';
 env.DB.database.exec("UPDATE notification_outbox SET status='suppressed'");
 await env.DB.prepare('INSERT INTO notifications(id,recipient_id,event_type,entity_id,category,title,message,idempotency_key) VALUES(?,?,?,?,?,?,?,?)').bind('inactive',a.user.uid,'booking',a.user.uid,'booking','Safe','Safe','inactive').run();
 await env.DB.prepare('UPDATE users SET is_suspended=1 WHERE id=?').bind(a.user.uid).run();
 await processOutbox(env,()=>{throw new Error('Suspended users must not receive queued deliveries');});
 const row=await env.DB.prepare("SELECT status,last_error_code FROM notification_outbox WHERE id='inactive:email'").first();assert.equal(row.status,'suppressed');assert.equal(row.last_error_code,'account_inactive');
});
test('push validates endpoint destinations and encryption context prevents ciphertext swapping',async()=>{
 for(const endpoint of ['http://127.0.0.1','https://evil.test/x','https://fcm.googleapis.com.evil.test/x','https://user@fcm.googleapis.com/x'])assert.throws(()=>validatePush({endpoint,keys:{}}));
 const env=environment(),value=await seal(env,{private:'secret'},'device-one');assert.deepEqual(await unseal(env,value,'device-one'),{private:'secret'});await assert.rejects(unseal(env,value,'device-two'));
});
test('Google ID token validation enforces signature, issuer, audience, nonce, expiry and verified email',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256'),jwk=await exportJWK(publicKey);jwk.kid='test';const keys=createLocalJWKSet({keys:[jwk]}),env={GOOGLE_CLIENT_ID:'client-test'};
 const sign=(claims={})=>new SignJWT({sub:'stable-subject',email:'owner@gmail.com',email_verified:true,nonce:'expected',...claims}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://accounts.google.com').setAudience('client-test').setIssuedAt().setExpirationTime('5m').sign(privateKey);
 assert.equal((await verifyGoogleToken(await sign(),env,'expected',keys)).sub,'stable-subject');
 for(const claims of [{email_verified:false},{nonce:'wrong'},{sub:''}])await assert.rejects(verifyGoogleToken(await sign(claims),env,'expected',keys));
 await assert.rejects(verifyGoogleToken(await sign(),{GOOGLE_CLIENT_ID:'wrong'},'expected',keys));
 const expired=await new SignJWT({sub:'stable',email:'owner@gmail.com',email_verified:true,nonce:'expected'}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('evil').setAudience('client-test').setIssuedAt(epoch()-3600).setExpirationTime(epoch()-1).sign(privateKey);await assert.rejects(verifyGoogleToken(expired,env,'expected',keys));
});
test('Google and Forms config fail closed, and existing legacy accounts are not falsely marked verified',async()=>{
 const env=environment();const c=await request(env,'config');assert.equal(c.data.google,false);assert.deepEqual(c.data.forms,{feedback:null,partnership:null});
 env.GOOGLE_FEEDBACK_FORM_URL='https://evil.test/form';assert.equal((await request(env,'config')).data.forms.feedback,null);
 env.GOOGLE_FEEDBACK_FORM_URL='https://docs.google.com/forms/d/e/example/viewform';assert.ok((await request(env,'config')).data.forms.feedback);
 await seed(env);await env.DB.prepare('INSERT INTO cf_credentials(user_id,email,created_at) VALUES(?,?,?)').bind('customer','saved@example.test',epoch()).run();assert.equal((await env.DB.prepare('SELECT email_verified_at FROM cf_credentials').first()).email_verified_at,null);
});
test('Web Push enrollment is owner-bound, encrypted and produces an RFC8291 payload; expired endpoints retire',async()=>{
 const env=environment(),a=await verified(env);
 const vapid=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),vapidJwk=await crypto.subtle.exportKey('jwk',vapid.privateKey);
 env.VAPID_PRIVATE_KEY=vapidJwk.d;env.VAPID_PUBLIC_KEY=base64url(new Uint8Array(await crypto.subtle.exportKey('raw',vapid.publicKey)));env.VAPID_SUBJECT='mailto:test@sewak.test';env.NOTIFICATION_PROCESSING_ENABLED='true';
 const device=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']),subscription={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic-never-send',keys:{p256dh:base64url(new Uint8Array(await crypto.subtle.exportKey('raw',device.publicKey))),auth:base64url(crypto.getRandomValues(new Uint8Array(16)))}};
 const enrolled=await request(env,'notifications/subscribe',{subscription,label:'Synthetic device'},a.token);assert.equal(enrolled.status,200,JSON.stringify(enrolled.data));
 const row=await env.DB.prepare('SELECT * FROM push_subscriptions').first();assert.ok(!JSON.stringify(row).includes(subscription.endpoint));assert.ok(!JSON.stringify(row).includes(subscription.keys.auth));
 const b=await signup(env,'second.test@gmail.com'),proof=await link(env,b.user.uid);await request(env,'auth/verify-email',{token:proof.token});assert.equal((await request(env,'notifications/subscribe',{subscription,label:'Hijack'},b.token)).status,409);
 env.DB.database.exec("UPDATE notification_outbox SET status='suppressed'");await env.DB.prepare("INSERT INTO notifications(id,recipient_id,event_type,entity_id,category,title,message,idempotency_key) VALUES('push-test',?,'booking_accepted','safe','booking','Booking confirmed','Safe','push-test')").bind(a.user.uid).run();
 const calls=[];await processOutbox(env,async(url,init)=>{calls.push({url,init});return url.startsWith('https://api.resend')?Response.json({id:'synthetic'}):new Response(null,{status:410});});
 const push=calls.find(c=>c.url===subscription.endpoint);assert.ok(push);assert.equal(push.init.headers['content-encoding'],'aes128gcm');assert.ok(!Buffer.from(push.init.body).toString().includes('Booking confirmed'));assert.ok((await env.DB.prepare('SELECT revoked_at FROM push_subscriptions').first()).revoked_at);
});
test('delivery confirmation requires a valid raw-body webhook signature and replay remains idempotent',async()=>{
 const env=environment();await signup(env);env.NOTIFICATION_PROCESSING_ENABLED='true';await processOutbox(env,async()=>Response.json({id:'provider-webhook'}));
 const secret=crypto.getRandomValues(new Uint8Array(32));env.RESEND_WEBHOOK_SECRET='whsec_'+base64url(secret);
 const raw=JSON.stringify({type:'email.delivered',data:{email_id:'provider-webhook'}}),id='msg_synthetic',time=String(epoch()),key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=base64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(id+'.'+time+'.'+raw))));
 const req=(sig=signature,body=raw)=>new Request('https://sewak.test/api/email/webhook',{method:'POST',headers:{'svix-id':id,'svix-timestamp':time,'svix-signature':'v1,'+sig},body});
 await assert.rejects(emailWebhook(req('forged'),env));await assert.rejects(emailWebhook(req(signature,raw+' '),env));assert.equal((await env.DB.prepare('SELECT status FROM notification_outbox').first()).status,'accepted');
 await emailWebhook(req(),env);await emailWebhook(req(),env);assert.equal((await env.DB.prepare('SELECT status FROM notification_outbox').first()).status,'delivered');assert.equal(count(env,'email_webhook_receipts'),1);
});
test('inbox pagination and opt-outs remain consistent while security preferences cannot be suppressed',async()=>{
 const env=environment(),a=await verified(env);for(let i=0;i<25;i++)await env.DB.prepare('INSERT INTO notifications(id,recipient_id,event_type,entity_id,category,title,message,idempotency_key) VALUES(?,?,?,?,?,?,?,?)').bind('n'+String(i).padStart(2,'0'),a.user.uid,'booking','safe','booking','Safe','Safe','n'+i).run();
 const first=await request(env,'notifications',null,a.token);assert.equal(first.data.notifications.length,20);assert.equal(first.data.unread,25);const second=await request(env,'notifications?before='+encodeURIComponent(first.data.nextCursor),null,a.token);assert.equal(second.data.notifications.length,5);assert.equal(new Set([...first.data.notifications,...second.data.notifications].map(n=>n.id)).size,25);
 assert.equal((await request(env,'notifications/preferences',{language:'ne',categories:{booking:{inApp:false,email:false,push:false},security:{inApp:false,email:false,push:false}}},a.token)).status,200);
 const inbox=await request(env,'notifications',null,a.token);assert.equal(inbox.data.notifications.length,0);assert.equal(inbox.data.unread,0);const pref=await request(env,'notifications/preferences',null,a.token);assert.equal(pref.data.categories.security.inApp,true);assert.equal(pref.data.categories.security.email,true);
});
test('Google callback binds the browser, consumes state, refuses email auto-linking and preserves organization onboarding selection',async()=>{
 const env=environment(),existing=await verified(env);env.GOOGLE_CLIENT_ID='callback-client';env.GOOGLE_CLIENT_SECRET='synthetic-secret';
 const {publicKey,privateKey}=await generateKeyPair('RS256'),jwk=await exportJWK(publicKey);jwk.kid='callback-test';jwk.alg='RS256';jwk.use='sig';
 const start=async(role='user')=>{const r=await worker.fetch(new Request('https://sewak.test/api/auth/google/start',{method:'POST',headers:{Origin:'https://sewak.test','Content-Type':'application/json'},body:JSON.stringify({role})}),env);return {r,data:await r.json()};};
 assert.equal((await start('superadmin')).r.status,400);
 const initial=await start(),target=new URL(initial.data.url),state=target.searchParams.get('state');assert.equal(target.searchParams.get('code_challenge_method'),'S256');
 const callback=(state,cookie)=>worker.fetch(new Request('https://sewak.test/api/auth/google/callback?code=synthetic-code&state='+encodeURIComponent(state),{headers:{Cookie:cookie}}),env);
 assert.equal((await callback(state,'__Host-sewak_oauth=wrong')).status,400);
 const realFetch=globalThis.fetch;let claims={sub:'new-google-subject',email:existing.user.email,email_verified:true};let nonce=target.searchParams.get('nonce');
 globalThis.fetch=async url=>{if(String(url).includes('oauth2.googleapis.com/token'))return Response.json({id_token:await new SignJWT({...claims,nonce}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer('https://accounts.google.com').setAudience(env.GOOGLE_CLIENT_ID).setIssuedAt().setExpirationTime('5m').sign(privateKey)});if(String(url).includes('googleapis.com/oauth2/v3/certs'))return Response.json({keys:[jwk]});throw new Error('Unexpected test network call');};
 try {
  const conflict=await callback(state,initial.r.headers.get('set-cookie').split(';')[0]);assert.equal(conflict.status,409,await conflict.clone().text());assert.equal(count(env,'cf_oauth_identities'),0);
  assert.equal((await callback(state,initial.r.headers.get('set-cookie').split(';')[0])).status,400);
  const next=await start('orgadmin'),nextTarget=new URL(next.data.url);nonce=nextTarget.searchParams.get('nonce');claims={...claims,sub:'organization-subject',email:'google.org@gmail.com'};
  const result=await callback(nextTarget.searchParams.get('state'),next.r.headers.get('set-cookie').split(';')[0]);assert.equal(result.status,303,await result.clone().text());assert.equal(result.headers.get('location'),'https://sewak.test/');
  const identity=await env.DB.prepare("SELECT c.*,u.role,u.extra_json FROM cf_oauth_identities i JOIN cf_credentials c ON c.user_id=i.user_id JOIN users u ON u.id=c.user_id WHERE i.subject='organization-subject'").first();assert.equal(identity.password_hash,null);assert.ok(identity.email_verified_at);assert.equal(identity.role,'user');assert.equal(JSON.parse(identity.extra_json).registrationRole,'orgadmin');
 } finally {globalThis.fetch=realFetch;}
});
