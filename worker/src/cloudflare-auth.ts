import { appOrigin, emailReady, sendEmail } from './email.ts';
import { googleReady, googleIdentity } from './google-auth.ts';
import { registrationKeys, registrationWrites } from './onboarding.ts';
import { ApiError, badInput, onlyKeys, requireThat, textField, type Data, type Env, type Identity } from './types.ts';
import { Repository, requireActor, validAccountRole, type Write } from './repository.ts';
import { dummyPasswordHash } from './passwords.ts';
import { traceD1 } from './d1-diagnostics.ts';

const COOKIE='__Host-sewak_session', LIFE=7*86400, IDLE=86400;
const enc=new TextEncoder();
export const epoch=()=>Math.floor(Date.now()/1000);
export async function digest(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function opaque(){return 'swk_'+btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function normalizedEmail(value:unknown){const email=textField(value,'Email',3,254).toLowerCase();badInput(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email),'Enter a valid email address.');return email;}
function passwordInput(value:unknown){badInput(typeof value==='string'&&value.length>=12&&value.length<=128,'Use a password containing 12–128 characters.');return value as string;}
async function passwordWork(env:Env,password:string,hash?:string){
  requireThat(env.PASSWORD_HASHER,'Password authentication is not configured.',503,'unavailable');
  const shard=(await digest(hash||password)).slice(0,2);
  const stub=env.PASSWORD_HASHER!.get(env.PASSWORD_HASHER!.idFromName(shard));
  const r=await stub.fetch('https://password-hasher.internal/',{method:'POST',body:JSON.stringify({password,...(hash?{hash}:{})})});
  if(!r.ok)throw new ApiError(503,'unavailable','Password authentication is temporarily unavailable.');return r.json() as Promise<Data>;
}
export const makePassword=async(env:Env,password:string)=>(await passwordWork(env,passwordInput(password))).hash as string;
const checkPassword=async(env:Env,password:string,hash:string)=>Boolean((await passwordWork(env,password,hash)).valid);
function audience(env:Env){requireThat(env.AUTH_AUDIENCE,'Authentication is not configured.',503,'unavailable');return env.AUTH_AUDIENCE!;}
function cookieToken(request:Request){const values=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));requireThat(values.length<=1,'Sign in again.',401,'unauthenticated');return values[0]?.slice(COOKIE.length+1)||null;}
function tokenInput(request:Request){const bearer=request.headers.get('Authorization'),cookie=cookieToken(request);requireThat(!(bearer&&cookie),'Use one authentication method.',400,'invalid-argument');if(bearer){requireThat(/^Bearer swk_[A-Za-z0-9_-]{43}$/.test(bearer),'Sign in again.',401,'unauthenticated');return {token:bearer.slice(7),transport:'bearer'};}if(cookie){requireThat(/^swk_[A-Za-z0-9_-]{43}$/.test(cookie),'Sign in again.',401,'unauthenticated');return {token:cookie,transport:'cookie'};}return null;}
export async function authenticateSession(request:Request,env:Env):Promise<Identity|null>{
  const input=tokenInput(request);if(!input)return null;const now=epoch();
  const tokenHash=await digest(input.token);const s=await traceD1('auth.session.lookup',()=>env.DB.prepare('SELECT s.*,c.email,c.disabled,c.credential_version AS current_version FROM cf_sessions s JOIN cf_credentials c ON c.user_id=s.user_id WHERE s.token_hash=? AND s.audience=?').bind(tokenHash,audience(env)).first<Data>());
  requireThat(s&&!s.disabled&&s.transport===input.transport&&s.credential_version===s.current_version&&s.expires_at>now&&s.last_seen_at>now-IDLE,'Sign in again.',401,'unauthenticated');
  const repo=new Repository(env),profile=await traceD1('auth.session.profile',()=>repo.data('users/'+s.user_id));
  requireThat(profile&&validAccountRole(profile.role)&&!profile.isSuspended&&!profile.isBlacklisted,'This account cannot sign in.',401,'unauthenticated');
  if(profile.role==='caregiver'&&profile.organizationId){const org=await repo.data('organizations/'+profile.organizationId);requireThat(org&&!org.isSuspended&&!org.isBlacklisted,'This account cannot sign in.',401,'unauthenticated');}
  if(now-s.last_seen_at>=300)await traceD1('auth.session.refresh',()=>env.DB.prepare('UPDATE cf_sessions SET last_seen_at=? WHERE id=? AND expires_at>?').bind(now,s.id,now).run());
  return {uid:s.user_id,email:s.email,authTime:s.created_at,sessionId:s.id,transport:input.transport as 'cookie'|'bearer',csrfToken:await digest('csrf:'+input.token)};
}
export function enforceCsrf(request:Request,identity:Identity|null){
  if(['GET','HEAD','OPTIONS'].includes(request.method))return;
  if(identity?.transport==='cookie')requireThat(request.headers.get('Origin')===new URL(request.url).origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site'&&request.headers.get('X-CSRF-Token')===identity.csrfToken,'Refresh the page and retry.',403,'csrf-rejected');
}
function mode(request:Request,body:Data){const transport=body.sessionMode||'cookie';badInput(['cookie','bearer'].includes(transport),'Invalid session mode.');if(transport==='cookie')requireThat(request.headers.get('Origin')===new URL(request.url).origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site','Use the Sewak website to sign in.',403,'csrf-rejected');else requireThat(!request.headers.get('Origin')&&!request.headers.get('Cookie')&&!request.headers.get('Sec-Fetch-Site'),'Bearer sign-in is for native clients.',403,'csrf-rejected');return transport as 'cookie'|'bearer';}
export async function authLimit(request:Request,env:Env,operation:string,email=''){
  const now=epoch(),window=operation==='register'||operation==='bootstrap'?3600:900;
  const buckets:[[string,number],...[string,number][]]=[['ip:'+ (request.headers.get('CF-Connecting-IP')||'local'),operation==='register'?10:operation==='bootstrap'?5:30]];
  if(email)buckets.push(['email:'+email,10]);
  for(const [value,max]of buckets){const key=await digest(audience(env)+':'+operation+':'+value);const row=await traceD1(value.startsWith('ip:')?'auth.rate.ip-upsert':'auth.rate.email-upsert',()=>env.DB.prepare('INSERT INTO cf_auth_limits(bucket,hits,reset_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN reset_at<=? THEN 1 ELSE hits+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING hits').bind(key,now+window,now,now).first<Data>());requireThat(row&&row.hits<=max,'Too many attempts. Try again later.',429,'rate-limited');}
  await traceD1('auth.rate.cleanup',()=>env.DB.prepare('DELETE FROM cf_auth_limits WHERE bucket IN (SELECT bucket FROM cf_auth_limits WHERE reset_at<? LIMIT 20)').bind(now-window).run());
}
function userResult(uid:string,email:string,profile:Data){return {id:uid,uid,email,displayName:profile.name||'',role:profile.role,profile:{...profile,registrationIncomplete:profile.role==='user'&&profile.profileComplete!==true&&profile.registrationComplete!==true}};}
function setCookie(headers:Headers,token:string,max=LIFE){headers.append('Set-Cookie',`${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${max}`);}
async function newSession(env:Env,uid:string,version:number,transport:'cookie'|'bearer'){
  const token=opaque(),id=crypto.randomUUID(),now=epoch();
  return {token,id,statement:env.DB.prepare('INSERT INTO cf_sessions(id,token_hash,user_id,audience,transport,credential_version,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,await digest(token),uid,audience(env),transport,version,now,now,now+LIFE)};
}
async function sessionResponse(env:Env,headers:Headers,uid:string,email:string,profile:Data,session:{token:string;id:string},transport:'cookie'|'bearer'){
  if(transport==='cookie')setCookie(headers,session.token);
  return {user:userResult(uid,email,profile),session:{id:session.id,expiresAt:epoch()+LIFE,transport},...(transport==='bearer'?{token:session.token}:{csrfToken:await digest('csrf:'+session.token)})};
}
export async function revokeUserSessions(env:Env,uid:string){await env.DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind(uid).run();}
export function newAccountProfile(uid:string,email:string,name:string,role='user'):Data{return {uid,email,name,role,roleSource:'d1',isApproved:role==='superadmin',isSuspended:false,isBlacklisted:false,profileComplete:false,createdAt:new Date().toISOString()};}
export async function invitationStatement(env:Env,uid:string,createdBy:string,purpose='activate',version=1){const token=opaque(),id=crypto.randomUUID();return {token,statement:env.DB.prepare('INSERT INTO cf_invitations(id,user_id,token_hash,expires_at,created_by,purpose,credential_version) VALUES(?,?,?,?,?,?,?)').bind(id,uid,await digest(token),epoch()+86400,createdBy,purpose,version)};}

async function accountEmail(env:Env,c:Data,purpose:'verify'|'reset') {
  const token=opaque(),hash=await digest(token),expires=epoch()+(purpose==='reset'?1800:86400);
  await env.DB.prepare('INSERT INTO cf_email_tokens(token_hash,user_id,purpose,credential_version,expires_at) VALUES(?,?,?,?,?)')
    .bind(hash,c.user_id,purpose,c.credential_version,expires).run();
  const link=appOrigin(env)+'/account/email?mode='+purpose+'#token='+token;
  try{await sendEmail(env,c.email,purpose==='reset'?'Reset your Sewak password':'Verify your Sewak email',
    (purpose==='reset'?'Use this link within 30 minutes to choose a new Sewak password.':'Confirm your email within 24 hours to enable Sewak email updates.')+'\n\n'+link+'\n\nIf you did not request this, you can ignore this email.', 'auth-'+hash);}
  catch(error){await env.DB.prepare('DELETE FROM cf_email_tokens WHERE token_hash=?').bind(hash).run();throw error;}
}
function googleCookie(headers:Headers,value:string,max:number){headers.append('Set-Cookie',`__Host-sewak_google=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${max}`);}

export async function authRoute(request:Request,env:Env,headers:Headers,body:Data,identity:Identity|null,context?:ExecutionContext){
  const path=new URL(request.url).pathname.replace(/^\/api/,'');
  const repo=new Repository(env);const actor=await repo.actor(identity);
  if(path==='/auth/options'&&request.method==='GET')return {google:googleReady(env),email:emailReady(env)};
  if(path==='/auth/google/callback'&&request.method==='GET'){
    requireThat(googleReady(env),'Google sign-in is not configured.',503,'unavailable');
    const url=new URL(request.url);requireThat(url.origin===appOrigin(env),'Invalid sign-in origin.',403,'csrf-rejected');
    googleCookie(headers,'',0);
    const state=url.searchParams.get('state')||'',cookies=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('__Host-sewak_google='));
    requireThat(/^swk_[A-Za-z0-9_-]{43}$/.test(state)&&cookies.length===1&&cookies[0].slice('__Host-sewak_google='.length)===state,'Google sign-in expired. Please try again.',400,'google-failed');
    const pending=await env.DB.prepare('DELETE FROM cf_google_states WHERE token_hash=? AND audience=? AND expires_at>? RETURNING *').bind(await digest(state),audience(env),epoch()).first<Data>();
    requireThat(pending,'Google sign-in expired. Please try again.',400,'google-failed');
    if(url.searchParams.has('error')){headers.set('Location',appOrigin(env)+'/auth?google=cancelled');return new Response(null,{status:303,headers});}
    const code=url.searchParams.get('code')||'';badInput(code.length>0&&code.length<=4096,'Invalid Google response.');
    const google=await googleIdentity(env,code,pending.verifier,pending.nonce);
    await authLimit(request,env,'google',google.email);
    let c=await env.DB.prepare('SELECT * FROM cf_credentials WHERE google_sub=? OR email=?').bind(google.sub,google.email).all<Data>();
    requireThat(c.results.length<=1,'This Google account cannot be connected.',409,'account-exists');
    let credentials=c.results[0],profile:Data,session;
    if(credentials){
      requireThat(!pending.link_user_id||(actor?.uid===pending.link_user_id&&credentials.user_id===pending.link_user_id),'Choose the same Gmail address as your Sewak account.',400,'google-link-required');
      requireThat(!credentials.disabled&&credentials.email===google.email,'This account cannot sign in.',403,'permission-denied');
      requireThat(credentials.google_sub===google.sub || (actor?.uid===credentials.user_id&&pending.link_user_id===credentials.user_id&&pending.credential_version===credentials.credential_version&&credentials.password_hash),
        'Sign in with your Sewak password first, then connect Google in notification preferences.',409,'google-link-required');
      profile=(await repo.data('users/'+credentials.user_id))!;
      requireThat(profile&&validAccountRole(profile.role)&&!profile.isSuspended&&!profile.isBlacklisted,'This account cannot sign in.',403,'permission-denied');
      if(profile.role==='caregiver'&&profile.organizationId){const org=await repo.data('organizations/'+profile.organizationId);requireThat(org&&!org.isSuspended&&!org.isBlacklisted,'This account cannot sign in.',403,'permission-denied');}
      session=await newSession(env,credentials.user_id,credentials.credential_version,'cookie');
      await repo.commit([], [env.DB.prepare('INSERT INTO commit_guards(id,valid) VALUES(?,EXISTS(SELECT 1 FROM cf_credentials WHERE user_id=? AND credential_version=? AND disabled=0 AND (google_sub IS NULL OR google_sub=?)))').bind('google:'+session.id,credentials.user_id,credentials.credential_version,google.sub),
        env.DB.prepare('UPDATE cf_credentials SET google_sub=?,email_verified_at=COALESCE(email_verified_at,?) WHERE user_id=?').bind(google.sub,epoch(),credentials.user_id),session.statement,
        env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind('google:'+session.id),
        env.DB.prepare('DELETE FROM cf_sessions WHERE user_id=? AND id IN (SELECT id FROM cf_sessions WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT -1 OFFSET 10)').bind(credentials.user_id,credentials.user_id)]);
    }else{
      await authLimit(request,env,'register',google.email);
      requireThat(!pending.link_user_id,'Choose the same Gmail address as your Sewak account.',400,'google-link-required');
      requireThat(!await env.DB.prepare('SELECT 1 FROM cf_bootstrap WHERE email=?').bind(google.email).first(),'Use your account setup invitation first.',409,'account-exists');
      const uid='usr_'+crypto.randomUUID();profile=newAccountProfile(uid,google.email,google.name);
      credentials={user_id:uid,email:google.email,credential_version:1};session=await newSession(env,uid,1,'cookie');
      await repo.commit([{path:'users/'+uid,data:profile}], [env.DB.prepare('INSERT INTO cf_credentials(user_id,email,created_at,email_verified_at,google_sub) VALUES(?,?,?,?,?)').bind(uid,google.email,epoch(),epoch(),google.sub),session.statement]);
    }
    setCookie(headers,session.token);headers.set('Location',appOrigin(env)+'/');return new Response(null,{status:303,headers});
  }
  if(path==='/auth/me'&&request.method==='GET'){
    if(!actor)return {user:null,csrfToken:null};
    return {user:userResult(actor.uid,actor.email,actor.profile!),csrfToken:identity!.transport==='cookie'?identity!.csrfToken:null,session:{id:identity!.sessionId,transport:identity!.transport}};
  }
  if(path==='/auth/sessions'&&request.method==='GET'){const user=requireActor(actor);return {sessions:(await env.DB.prepare('SELECT id,transport,created_at,last_seen_at,expires_at FROM cf_sessions WHERE user_id=? AND audience=? AND expires_at>? AND last_seen_at>? ORDER BY created_at DESC').bind(user.uid,audience(env),epoch(),epoch()-IDLE).all()).results};}
  badInput(request.method==='POST','Unsupported authentication method.');
  if(path==='/auth/google/start'){
    onlyKeys(body,[]);mode(request,body);requireThat(request.headers.get('Origin')===appOrigin(env),'Use the Sewak website.',403,'csrf-rejected');
    requireThat(googleReady(env),'Google sign-in is not configured yet.',503,'unavailable');await authLimit(request,env,'google-start');
    await env.DB.prepare('DELETE FROM cf_google_states WHERE expires_at<?').bind(epoch()).run();
    const state=opaque(),verifier=opaque(),nonce=opaque(),challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(verifier))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const c=actor?await env.DB.prepare('SELECT credential_version FROM cf_credentials WHERE user_id=?').bind(actor.uid).first<Data>():null;
    await env.DB.prepare('INSERT INTO cf_google_states(token_hash,verifier,nonce,audience,expires_at,link_user_id,credential_version) VALUES(?,?,?,?,?,?,?)')
      .bind(await digest(state),verifier,nonce,audience(env),epoch()+600,actor?.uid||null,c?.credential_version||null).run();
    googleCookie(headers,state,600);
    const query=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,redirect_uri:appOrigin(env)+'/api/auth/google/callback',response_type:'code',scope:'openid email profile',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'});
    return {url:'https://accounts.google.com/o/oauth2/v2/auth?'+query};
  }
  if(path==='/auth/forgot-password'){
    onlyKeys(body,['email']);mode(request,body);const email=normalizedEmail(body.email);await authLimit(request,env,'forgot-password',email);
    requireThat(emailReady(env),'Email recovery is temporarily unavailable. Please try again later.',503,'email-unavailable');
    const c=await env.DB.prepare('SELECT * FROM cf_credentials WHERE email=? AND disabled=0 AND password_hash IS NOT NULL').bind(email).first<Data>();
    const deliver=async()=>{if(c){const profile=await repo.data('users/'+c.user_id);if(profile&&!profile.isSuspended&&!profile.isBlacklisted){try{await accountEmail(env,c,'reset');}catch{ console.warn('Sewak recovery email could not be submitted'); }}}};
    // Do not expose provider network latency as an account-existence oracle.
    if(context)context.waitUntil(deliver());else await deliver();
    return {message:'If this address has an eligible Sewak account, a password reset link will arrive shortly. Check your inbox and spam folder.'};
  }
  if(path==='/auth/reset-password'||path==='/auth/verify-email'){
    const reset=path.endsWith('/reset-password');onlyKeys(body,reset?['token','password']:['token']);mode(request,body);
    badInput(typeof body.token==='string'&&/^swk_[A-Za-z0-9_-]{43}$/.test(body.token),'This link is invalid or expired.');if(reset)passwordInput(body.password);
    await authLimit(request,env,reset?'reset-password':'verify-email');const hash=await digest(body.token),purpose=reset?'reset':'verify';
    const token=await env.DB.prepare('SELECT t.*,c.email,c.disabled,c.credential_version AS current_version FROM cf_email_tokens t JOIN cf_credentials c ON c.user_id=t.user_id WHERE t.token_hash=? AND t.purpose=?').bind(hash,purpose).first<Data>();
    requireThat(token&&!token.used_at&&token.expires_at>epoch()&&!token.disabled&&token.credential_version===token.current_version,'This link is invalid or expired. Request a new one.',400,'invalid-email-token');
    const profile=await repo.data('users/'+token.user_id);requireThat(profile&&!profile.isSuspended&&!profile.isBlacklisted,'This link is unavailable.',400,'invalid-email-token');
    const password=reset?await makePassword(env,body.password):null,guard='email:'+crypto.randomUUID();
    await repo.commit([], [env.DB.prepare('INSERT INTO commit_guards(id,valid) VALUES(?,EXISTS(SELECT 1 FROM cf_email_tokens t JOIN cf_credentials c ON c.user_id=t.user_id WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>? AND t.credential_version=c.credential_version AND c.disabled=0))').bind(guard,hash,epoch()),
      env.DB.prepare(reset?'UPDATE cf_credentials SET password_hash=?,credential_version=credential_version+1,password_changed_at=?,email_verified_at=COALESCE(email_verified_at,?) WHERE user_id=?':'UPDATE cf_credentials SET email_verified_at=COALESCE(email_verified_at,?) WHERE user_id=?').bind(...(reset?[password,epoch(),epoch(),token.user_id]:[epoch(),token.user_id])),
      env.DB.prepare('UPDATE cf_email_tokens SET used_at=? WHERE user_id=? AND purpose=? AND used_at IS NULL').bind(epoch(),token.user_id,purpose),
      ...(reset?[env.DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind(token.user_id),env.DB.prepare('UPDATE cf_invitations SET used_at=? WHERE user_id=? AND used_at IS NULL').bind(epoch(),token.user_id)]:[]),env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind(guard)]);
    if(reset)setCookie(headers,'',0);
    return reset?{changed:true,signedOut:true}:{verified:true};
  }
  if(path==='/auth/send-verification'){
    onlyKeys(body,[]);const user=requireActor(actor);await authLimit(request,env,'send-verification',user.email);
    const c=await env.DB.prepare('SELECT * FROM cf_credentials WHERE user_id=? AND disabled=0').bind(user.uid).first<Data>();requireThat(c,'Sign in again.',401,'unauthenticated');
    if(!c.email_verified_at)await accountEmail(env,c,'verify');return {message:c.email_verified_at?'Your email is already verified.':'Check your inbox for a verification link.'};
  }
  if(path==='/auth/login'){
    onlyKeys(body,['email','password','sessionMode']);const transport=mode(request,body),email=normalizedEmail(body.email);badInput(typeof body.password==='string'&&body.password.length<=128,'Invalid credentials.');await authLimit(request,env,'login',email);
    const c=await traceD1('auth.login.credentials',()=>env.DB.prepare('SELECT * FROM cf_credentials WHERE email=?').bind(email).first<Data>());const valid=await traceD1('auth.login.hasher',()=>checkPassword(env,body.password,c?.password_hash||dummyPasswordHash));
    requireThat(c&&valid&&!c.disabled,'The email or password is incorrect.',401,'invalid-credentials');const profile=await traceD1('auth.login.profile',()=>repo.data('users/'+c.user_id));requireThat(profile&&validAccountRole(profile.role)&&!profile.isSuspended&&!profile.isBlacklisted,'The email or password is incorrect.',401,'invalid-credentials');
    if(profile.role==='caregiver'&&profile.organizationId){const org=await repo.data('organizations/'+profile.organizationId);requireThat(org&&!org.isSuspended&&!org.isBlacklisted,'The email or password is incorrect.',401,'invalid-credentials');}
    const session=await newSession(env,c.user_id,c.credential_version,transport);
    await traceD1('auth.login.session-commit',()=>repo.commit([], [env.DB.prepare('INSERT INTO commit_guards(id,valid) VALUES(?,(SELECT credential_version=? AND disabled=0 FROM cf_credentials WHERE user_id=?))').bind('auth:'+session.id,c.credential_version,c.user_id),session.statement,env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind('auth:'+session.id),env.DB.prepare('DELETE FROM cf_sessions WHERE user_id=? AND id IN (SELECT id FROM cf_sessions WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT -1 OFFSET 10)').bind(c.user_id,c.user_id)]));
    return sessionResponse(env,headers,c.user_id,c.email,profile,session,transport);
  }
  if(path==='/auth/register'||path==='/auth/bootstrap'){
    const bootstrap=path.endsWith('/bootstrap');onlyKeys(body,['email','password','name','sessionMode',...(bootstrap?['bootstrapToken']:registrationKeys)]);const transport=mode(request,body),email=normalizedEmail(body.email),name=textField(body.name,'Name',2,120);passwordInput(body.password);await authLimit(request,env,bootstrap?'bootstrap':'register',email);
    let setup:Data|null=null;if(bootstrap){requireThat(typeof body.bootstrapToken==='string'&&body.bootstrapToken.length<=128,'Setup is unavailable.',403,'setup-unavailable');setup=await env.DB.prepare('SELECT * FROM cf_bootstrap WHERE id=1').first<Data>();requireThat(setup&&!setup.used_at&&setup.expires_at>epoch()&&setup.email===email&&setup.token_hash===await digest(body.bootstrapToken),'Setup is unavailable.',403,'setup-unavailable');}
    if(!bootstrap){const reserved=await env.DB.prepare('SELECT email FROM cf_bootstrap WHERE id=1 AND email=?').bind(email).first();requireThat(!reserved,'Use your one-time account setup invitation.',409,'account-exists');}
    const uid='usr_'+crypto.randomUUID();
    let profile=newAccountProfile(uid,email,name,bootstrap?'superadmin':'user');
    const writes:Write[]=!bootstrap && body.selectedRole!==undefined ? await registrationWrites(repo,profile,body) : [{path:'users/'+uid,data:profile}];
    profile=writes[0].data!;
    const hash=await traceD1('auth.register.hasher',()=>makePassword(env,body.password)),session=await newSession(env,uid,1,transport);
    const statements: D1PreparedStatement[]=[];if(bootstrap){statements.push(env.DB.prepare('INSERT INTO commit_guards(id,valid) VALUES(?,EXISTS(SELECT 1 FROM cf_bootstrap WHERE id=1 AND used_at IS NULL AND expires_at>? AND token_hash=?) AND NOT EXISTS(SELECT 1 FROM cf_credentials c JOIN users u ON u.id=c.user_id WHERE u.role=\'superadmin\' AND c.disabled=0))').bind('bootstrap:'+uid,epoch(),setup!.token_hash));statements.push(env.DB.prepare('UPDATE cf_bootstrap SET used_at=? WHERE id=1 AND used_at IS NULL').bind(epoch()));}
    statements.push(env.DB.prepare('INSERT INTO cf_credentials(user_id,email,password_hash,created_at) VALUES(?,?,?,?)').bind(uid,email,hash,epoch()),session.statement);if(bootstrap)statements.push(env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind('bootstrap:'+uid));
    try{await traceD1('auth.register.commit',()=>repo.commit(writes,statements));}catch(e){if(e instanceof ApiError&&e.code==='already-exists')throw new ApiError(409,'account-exists','Unable to create this account. Try signing in.');throw e;}
    if(!bootstrap&&emailReady(env)){const deliver=async()=>{try{await accountEmail(env,{user_id:uid,email,credential_version:1},'verify');}catch{ console.warn('Sewak verification email could not be submitted'); }};if(context)context.waitUntil(deliver());else await deliver();}
    return sessionResponse(env,headers,uid,email,profile,session,transport);
  }
  if(path==='/auth/activate'){
    onlyKeys(body,['token','password','sessionMode']);const transport=mode(request,body);badInput(typeof body.token==='string'&&body.token.length<=128);passwordInput(body.password);await authLimit(request,env,'activate');
    const tokenHash=await digest(body.token),invite=await env.DB.prepare('SELECT i.*,c.email,c.disabled,c.credential_version AS current_version,c.password_hash FROM cf_invitations i JOIN cf_credentials c ON c.user_id=i.user_id WHERE i.token_hash=?').bind(tokenHash).first<Data>();requireThat(invite&&!invite.used_at&&invite.expires_at>epoch()&&!invite.disabled&&invite.credential_version===invite.current_version&&(invite.purpose==='recover'||!invite.password_hash),'Invitation is invalid or expired.',400,'invalid-invitation');
    const profile=await repo.data('users/'+invite.user_id);requireThat(profile&&!profile.isSuspended&&!profile.isBlacklisted,'Invitation unavailable.');const hash=await makePassword(env,body.password),session=await newSession(env,invite.user_id,invite.credential_version+1,transport);
    await repo.commit([], [env.DB.prepare("INSERT INTO commit_guards(id,valid) VALUES(?,EXISTS(SELECT 1 FROM cf_invitations i JOIN cf_credentials c ON c.user_id=i.user_id WHERE i.token_hash=? AND i.used_at IS NULL AND i.expires_at>? AND (i.purpose='recover' OR c.password_hash IS NULL) AND c.credential_version=i.credential_version AND c.disabled=0))").bind('activate:'+session.id,tokenHash,epoch()),env.DB.prepare('UPDATE cf_credentials SET password_hash=?,credential_version=credential_version+1,password_changed_at=? WHERE user_id=?').bind(hash,epoch(),invite.user_id),env.DB.prepare('UPDATE cf_invitations SET used_at=? WHERE user_id=? AND used_at IS NULL').bind(epoch(),invite.user_id),env.DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind(invite.user_id),session.statement,env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind('activate:'+session.id)]);
    return sessionResponse(env,headers,invite.user_id,invite.email,profile,session,transport);
  }
  if(path==='/auth/logout'){onlyKeys(body,[]);if(identity)await env.DB.prepare('DELETE FROM cf_sessions WHERE id=? AND user_id=?').bind(identity.sessionId,identity.uid).run();setCookie(headers,'',0);return {signedOut:true};}
  const user=requireActor(actor);
  if(path==='/auth/change-password'){
    onlyKeys(body,['currentPassword','newPassword']);badInput(typeof body.currentPassword==='string'&&body.currentPassword.length<=128);passwordInput(body.newPassword);await authLimit(request,env,'change-password',user.email);
    const c=await env.DB.prepare('SELECT * FROM cf_credentials WHERE user_id=?').bind(user.uid).first<Data>();requireThat(c&&await checkPassword(env,body.currentPassword,c.password_hash||dummyPasswordHash),'The current password is incorrect.',401,'invalid-credentials');const hash=await makePassword(env,body.newPassword);
    await repo.commit([], [env.DB.prepare('INSERT INTO commit_guards(id,valid) VALUES(?,(SELECT credential_version=? FROM cf_credentials WHERE user_id=?))').bind('password:'+identity!.sessionId,c.credential_version,user.uid),env.DB.prepare('UPDATE cf_credentials SET password_hash=?,credential_version=credential_version+1,password_changed_at=? WHERE user_id=?').bind(hash,epoch(),user.uid),env.DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind(user.uid),env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind('password:'+identity!.sessionId)]);setCookie(headers,'',0);return {changed:true,signedOut:true};
  }
  if(path==='/auth/revoke-sessions'){onlyKeys(body,['sessionId','all']);badInput(body.all===true||typeof body.sessionId==='string'&&body.sessionId.length<=100);if(body.all===true)await revokeUserSessions(env,user.uid);else await env.DB.prepare('DELETE FROM cf_sessions WHERE id=? AND user_id=?').bind(body.sessionId,user.uid).run();const signedOut=body.all===true||body.sessionId===identity!.sessionId;if(signedOut)setCookie(headers,'',0);return {revoked:true,signedOut};}
  if(path==='/auth/complete-registration'){
    onlyKeys(body,['name',...registrationKeys]);
    const name=textField(body.name,'Name',2,120);
    badInput(['user','caregiver','orgadmin'].includes(body.selectedRole), 'Choose Customer, Caregiver or Organization.');
    if(user.profile?.registrationComplete===true || user.profile?.profileComplete===true || user.role!=='user') {
      requireThat(user.role===body.selectedRole, 'An existing account cannot change its account type through registration.');
      return {completed:true};
    }
    const writes=await registrationWrites(repo,{...user.profile!,name},body);
    await repo.commit(writes);return {completed:true};
  }
  throw new ApiError(404,'not-found','Authentication endpoint not found.');
}
