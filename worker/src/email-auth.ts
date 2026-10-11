import { authLimit, digest, epoch, makePassword, normalizedEmail, opaque, checkPassword } from './cloudflare-auth.ts';
import { appBase, emailConfigured, emailTemplate } from './delivery.ts';
import { seal } from './secret-box.ts';
import { Repository, requireActor, type Write } from './repository.ts';
import { badInput, onlyKeys, requireThat, type Actor, type Data, type Env } from './types.ts';
export function registrationEmail(value:unknown,role:unknown,env:Env) {
 const email=normalizedEmail(value),[local,domain]=email.split('@');
 const gmail=domain==='gmail.com'&&/^[a-z0-9]+(?:\.[a-z0-9]+)*(?:\+[a-z0-9.!#$%&'*\-/=?^_`{|}~]+)?$/.test(local)&&local.length<=64;
 const business=role==='orgadmin'&&(env.ORGANIZATION_EMAIL_DOMAINS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(domain);
 badInput(gmail||business,'Use a valid Gmail address (Gmail aliases are supported).');
 // Preserve dots and plus tags. Ownership, not canonicalization, activates an account.
 return email;
}
export function deliveryRequired(env:Env){requireThat(emailConfigured(env),'Email delivery is not configured. Please try again later.',503,'delivery-unavailable');}
export async function emailTokenStatements(env:Env,uid:string,email:string,version:number,purpose='verify') {
 deliveryRequired(env);
 const id=crypto.randomUUID(),token=opaque(),outbox='auth:'+id,time=epoch();
 const subject=purpose==='reset'?'Reset Your Sewak Password':purpose==='change_email'?'Verify your new Sewak email':'Verify your Gmail';
 const message=purpose==='reset'?'Use this single-use link to reset your Sewak password. It expires in 30 minutes. If you did not request this, ignore this message.':'Verify ownership of your email to activate your Sewak account. This single-use link expires in 30 minutes. Email ownership is not caregiver background or professional verification.';
 const link=appBase(env)+(purpose==='reset'?'/account/reset':'/account/verify')+'#token='+encodeURIComponent(token);
 const payload={tokenId:id,from:env.EMAIL_FROM,to:email,...emailTemplate(subject,message,link)};
 return [
  env.DB.prepare('INSERT INTO commit_guards(id,valid) VALUES(?,NOT EXISTS(SELECT 1 FROM cf_email_tokens WHERE user_id=? AND created_at>? AND purpose=?))').bind('email:'+id,uid,time-60,purpose),
  env.DB.prepare("UPDATE cf_email_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL AND (purpose=? OR (? IN ('verify','change_email') AND purpose IN ('verify','change_email')))").bind(time,uid,purpose,purpose),
  env.DB.prepare('INSERT INTO cf_email_tokens(id,user_id,token_hash,purpose,email,credential_version,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,uid,await digest(token),purpose,email,version,time+1800,time),
  env.DB.prepare('INSERT INTO notification_outbox(id,user_id,channel,encrypted_payload,priority,idempotency_key,expires_at) VALUES(?,?,\'email\',?,0,?,?)').bind(outbox,uid,await seal(env,payload,outbox),outbox,time+1800),
  env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind('email:'+id)
 ];
}
export async function emailAuthRoute(request:Request,env:Env,body:Data,actor:Actor|null) {
 const path=new URL(request.url).pathname.split('/').at(-1),repo=new Repository(env);
 if(path==='verification-status') {
  const user=requireActor(actor),c=await env.DB.prepare('SELECT email,email_verified_at FROM cf_credentials WHERE user_id=?').bind(user.uid).first<Data>();
  const last=await env.DB.prepare("SELECT o.status,t.created_at FROM cf_email_tokens t JOIN notification_outbox o ON o.id='auth:'||t.id WHERE t.user_id=? AND t.purpose IN ('verify','change_email') ORDER BY t.created_at DESC LIMIT 1").bind(user.uid).first<Data>();
  return {email:c!.email,verified:!!c!.email_verified_at,deliveryStatus:last?.status||null,resendAfter:Math.max(0,(last?.created_at||0)+60-epoch())};
 }
 badInput(request.method==='POST');
 if(path==='forgot-password') {
  onlyKeys(body,['email']);const email=normalizedEmail(body.email);await authLimit(request,env,'forgot-password',email);deliveryRequired(env);
  const c=await env.DB.prepare('SELECT c.*,u.role FROM cf_credentials c JOIN users u ON u.id=c.user_id WHERE c.email=?').bind(email).first<Data>();
  if(c&&!c.disabled&&['user','caregiver','orgadmin'].includes(c.role)) {
   if(c.password_hash) {
    const recent=await env.DB.prepare("SELECT id FROM cf_email_tokens WHERE user_id=? AND purpose='reset' AND created_at>?").bind(c.user_id,epoch()-60).first();
    if(!recent)try {await repo.commit([],await emailTokenStatements(env,c.user_id,c.email,c.credential_version,'reset'));}catch(e){if(!(e instanceof Error&&'code' in e&&e.code==='aborted'))throw e;}
   } else {
    // Generic public response; instructions are sent only to the account owner.
    const id='google-guidance:'+c.user_id+':'+Math.floor(epoch()/900);
    const payload={from:env.EMAIL_FROM,to:c.email,...emailTemplate('Signing in to Sewak','If you created your account with Google, use Continue with Google. Provisioned accounts should use their account invitation.',appBase(env)+'/auth')};
    await env.DB.prepare("INSERT OR IGNORE INTO notification_outbox(id,user_id,channel,encrypted_payload,priority,idempotency_key,expires_at) VALUES(?,?,'email',?,0,?,?)").bind(id,c.user_id,await seal(env,payload,id),id,epoch()+1800).run();
   }
  }
  return {message:'If this account is eligible, recovery instructions will be emailed. Google-only users should use Continue with Google. Administrators must use their protected recovery process.'};
 }
 if(path==='resend-verification'||path==='change-email') {
  onlyKeys(body,path==='change-email'?['email','password']:[]);const user=requireActor(actor);
  await authLimit(request,env,path,user.email);deliveryRequired(env);
  const c=await env.DB.prepare('SELECT * FROM cf_credentials WHERE user_id=?').bind(user.uid).first<Data>();
  requireThat(c&&!c.disabled);
  if(path==='resend-verification'&&c.email_verified_at)return {verified:true};
  let email=c.email;
  if(path==='change-email') {
   requireThat(!c.email_verified_at&&['user','caregiver','orgadmin'].includes(user.role),'Only pending accounts can correct their address here.');
   badInput(typeof body.password==='string'&&body.password.length<=128);
   requireThat(c.password_hash&&await checkPassword(env,body.password,c.password_hash),'The password is incorrect.',401,'invalid-credentials');
   email=registrationEmail(body.email,user.role,env);
   requireThat(!await env.DB.prepare('SELECT user_id FROM cf_credentials WHERE email=? AND user_id<>?').bind(email,user.uid).first(),'This address cannot be used.',409,'account-exists');
  }
  const guard='email-issue:'+crypto.randomUUID();
  await repo.commit([], [env.DB.prepare('INSERT INTO commit_guards(id,valid) VALUES(?,EXISTS(SELECT 1 FROM cf_credentials WHERE user_id=? AND credential_version=? AND disabled=0))').bind(guard,user.uid,c.credential_version),...await emailTokenStatements(env,user.uid,email,c.credential_version,path==='change-email'?'change_email':'verify'),env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind(guard)]);
  return {verified:false,deliveryStatus:'pending',resendAfter:60};
 }
 if(path==='verify-email'||path==='reset-password') {
  const reset=path==='reset-password';onlyKeys(body,reset?['token','password']:['token']);
  badInput(typeof body.token==='string'&&/^swk_[\w-]{43}$/.test(body.token),'Invalid or expired link.');await authLimit(request,env,path);
  const hash=await digest(body.token),t=await env.DB.prepare('SELECT t.*,c.disabled,c.credential_version AS current_version,c.email AS current_email,u.role FROM cf_email_tokens t JOIN cf_credentials c ON c.user_id=t.user_id JOIN users u ON u.id=t.user_id WHERE t.token_hash=?').bind(hash).first<Data>();
  requireThat(t&&!t.disabled&&!t.used_at&&t.expires_at>epoch()&&t.credential_version===t.current_version&&(reset?t.purpose==='reset'&&['user','caregiver','orgadmin'].includes(t.role):['verify','change_email'].includes(t.purpose)),'This link is invalid, expired or already used. Sign in to check verification or request a new link.',400,'invalid-token');
  const password=reset?await makePassword(env,body.password):null,guard='consume:'+crypto.randomUUID();
  const statements=[env.DB.prepare('INSERT INTO commit_guards(id,valid) VALUES(?,EXISTS(SELECT 1 FROM cf_email_tokens t JOIN cf_credentials c ON c.user_id=t.user_id JOIN users u ON u.id=c.user_id WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>? AND c.credential_version=t.credential_version AND c.disabled=0 AND (?=0 OR u.role IN (\'user\',\'caregiver\',\'orgadmin\'))))').bind(guard,hash,epoch(),reset?1:0)];
  const writes:Write[]=[];
  if(reset)statements.push(env.DB.prepare('UPDATE cf_credentials SET password_hash=?,credential_version=credential_version+1,password_changed_at=?,email_verified_at=COALESCE(email_verified_at,?) WHERE user_id=?').bind(password,epoch(),epoch(),t.user_id),env.DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind(t.user_id),env.DB.prepare('UPDATE cf_invitations SET used_at=? WHERE user_id=? AND used_at IS NULL').bind(epoch(),t.user_id));
  else if(t.purpose==='change_email') {
   const profile=await repo.data('users/'+t.user_id);writes.push({path:'users/'+t.user_id,data:{...profile!,email:t.email}});
   if(t.role==='orgadmin'){const org=await repo.data('organizations/'+t.user_id);if(org)writes.push({path:'organizations/'+t.user_id,data:{...org,adminEmail:t.email}});const app=await repo.data('organizationApplications/'+t.user_id);if(app)writes.push({path:'organizationApplications/'+t.user_id,data:{...app,applicantEmail:t.email}});}
   if(t.role==='caregiver'){const provider=await repo.data('vendors/'+t.user_id);if(provider)writes.push({path:'vendors/'+t.user_id,data:{...provider,email:t.email}});}
   statements.push(env.DB.prepare('UPDATE cf_credentials SET email=?,email_verified_at=?,credential_version=credential_version+1 WHERE user_id=?').bind(t.email,epoch(),t.user_id),env.DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind(t.user_id),env.DB.prepare('UPDATE push_subscriptions SET revoked_at=? WHERE user_id=?').bind(epoch(),t.user_id));
  } else statements.push(env.DB.prepare('UPDATE cf_credentials SET email_verified_at=? WHERE user_id=? AND email=?').bind(epoch(),t.user_id,t.email));
  statements.push(env.DB.prepare('UPDATE cf_email_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL').bind(epoch(),t.user_id),env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind(guard));
  await repo.commit(writes,statements);return reset?{changed:true,signedOut:true}:{verified:true};
 }
 return null;
}
