import { ApiError, badInput, onlyKeys, requireThat, textField, type Data, type Env, type Identity } from './types.ts';
import { Repository, requireActor, type Write } from './repository.ts';
import { dummyPasswordHash } from './passwords.ts';

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
  const s=await env.DB.prepare('SELECT s.*,c.email,c.disabled,c.credential_version AS current_version FROM cf_sessions s JOIN cf_credentials c ON c.user_id=s.user_id WHERE s.token_hash=? AND s.audience=?').bind(await digest(input.token),audience(env)).first<Data>();
  requireThat(s&&!s.disabled&&s.transport===input.transport&&s.credential_version===s.current_version&&s.expires_at>now&&s.last_seen_at>now-IDLE,'Sign in again.',401,'unauthenticated');
  const repo=new Repository(env),profile=await repo.data('users/'+s.user_id);
  requireThat(profile&&!profile.isSuspended&&!profile.isBlacklisted,'This account cannot sign in.',401,'unauthenticated');
  if(profile.role==='caregiver'&&profile.organizationId){const org=await repo.data('organizations/'+profile.organizationId);requireThat(org&&!org.isSuspended&&!org.isBlacklisted,'This account cannot sign in.',401,'unauthenticated');}
  if(now-s.last_seen_at>=300)await env.DB.prepare('UPDATE cf_sessions SET last_seen_at=? WHERE id=? AND expires_at>?').bind(now,s.id,now).run();
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
  for(const [value,max]of buckets){const key=await digest(audience(env)+':'+operation+':'+value);const row=await env.DB.prepare('INSERT INTO cf_auth_limits(bucket,hits,reset_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN reset_at<=? THEN 1 ELSE hits+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING hits').bind(key,now+window,now,now).first<Data>();requireThat(row&&row.hits<=max,'Too many attempts. Try again later.',429,'rate-limited');}
  await env.DB.prepare('DELETE FROM cf_auth_limits WHERE bucket IN (SELECT bucket FROM cf_auth_limits WHERE reset_at<? LIMIT 20)').bind(now-window).run();
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

export async function authRoute(request:Request,env:Env,headers:Headers,body:Data,identity:Identity|null){
  const path=new URL(request.url).pathname.replace(/^\/api/,'');
  const repo=new Repository(env);const actor=await repo.actor(identity);
  if(path==='/auth/me'&&request.method==='GET'){
    if(!actor)return {user:null,csrfToken:null};
    return {user:userResult(actor.uid,actor.email,actor.profile!),csrfToken:identity!.transport==='cookie'?identity!.csrfToken:null,session:{id:identity!.sessionId,transport:identity!.transport}};
  }
  if(path==='/auth/sessions'&&request.method==='GET'){const user=requireActor(actor);return {sessions:(await env.DB.prepare('SELECT id,transport,created_at,last_seen_at,expires_at FROM cf_sessions WHERE user_id=? AND audience=? AND expires_at>? AND last_seen_at>? ORDER BY created_at DESC').bind(user.uid,audience(env),epoch(),epoch()-IDLE).all()).results};}
  badInput(request.method==='POST','Unsupported authentication method.');
  if(path==='/auth/login'){
    onlyKeys(body,['email','password','sessionMode']);const transport=mode(request,body),email=normalizedEmail(body.email);badInput(typeof body.password==='string'&&body.password.length<=128,'Invalid credentials.');await authLimit(request,env,'login',email);
    const c=await env.DB.prepare('SELECT * FROM cf_credentials WHERE email=?').bind(email).first<Data>();const valid=await checkPassword(env,body.password,c?.password_hash||dummyPasswordHash);
    requireThat(c&&valid&&!c.disabled,'The email or password is incorrect.',401,'invalid-credentials');const profile=await repo.data('users/'+c.user_id);requireThat(profile&&!profile.isSuspended&&!profile.isBlacklisted,'The email or password is incorrect.',401,'invalid-credentials');
    const session=await newSession(env,c.user_id,c.credential_version,transport);
    await repo.commit([], [env.DB.prepare('INSERT INTO commit_guards(id,valid) VALUES(?,(SELECT credential_version=? AND disabled=0 FROM cf_credentials WHERE user_id=?))').bind('auth:'+session.id,c.credential_version,c.user_id),session.statement,env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind('auth:'+session.id),env.DB.prepare('DELETE FROM cf_sessions WHERE user_id=? AND id IN (SELECT id FROM cf_sessions WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT -1 OFFSET 10)').bind(c.user_id,c.user_id)]);
    return sessionResponse(env,headers,c.user_id,c.email,profile,session,transport);
  }
  if(path==='/auth/register'||path==='/auth/bootstrap'){
    const bootstrap=path.endsWith('/bootstrap');onlyKeys(body,['email','password','name','sessionMode',...(bootstrap?['bootstrapToken']:[])]);const transport=mode(request,body),email=normalizedEmail(body.email),name=textField(body.name,'Name',2,120);passwordInput(body.password);await authLimit(request,env,bootstrap?'bootstrap':'register',email);
    let setup:Data|null=null;if(bootstrap){requireThat(typeof body.bootstrapToken==='string'&&body.bootstrapToken.length<=128,'Setup is unavailable.',403,'setup-unavailable');setup=await env.DB.prepare('SELECT * FROM cf_bootstrap WHERE id=1').first<Data>();requireThat(setup&&!setup.used_at&&setup.expires_at>epoch()&&setup.email===email&&setup.token_hash===await digest(body.bootstrapToken),'Setup is unavailable.',403,'setup-unavailable');}
    if(!bootstrap){const reserved=await env.DB.prepare('SELECT email FROM cf_bootstrap WHERE id=1 AND email=?').bind(email).first();requireThat(!reserved,'Use your one-time account setup invitation.',409,'account-exists');}
    const uid='usr_'+crypto.randomUUID(),profile=newAccountProfile(uid,email,name,bootstrap?'superadmin':'user'),hash=await makePassword(env,body.password),session=await newSession(env,uid,1,transport);
    const statements=[];if(bootstrap){statements.push(env.DB.prepare('INSERT INTO commit_guards(id,valid) VALUES(?,EXISTS(SELECT 1 FROM cf_bootstrap WHERE id=1 AND used_at IS NULL AND expires_at>? AND token_hash=?) AND NOT EXISTS(SELECT 1 FROM cf_credentials c JOIN users u ON u.id=c.user_id WHERE u.role=\'superadmin\' AND c.disabled=0))').bind('bootstrap:'+uid,epoch(),setup!.token_hash));statements.push(env.DB.prepare('UPDATE cf_bootstrap SET used_at=? WHERE id=1 AND used_at IS NULL').bind(epoch()));}
    statements.push(env.DB.prepare('INSERT INTO cf_credentials(user_id,email,password_hash,created_at) VALUES(?,?,?,?)').bind(uid,email,hash,epoch()),session.statement);if(bootstrap)statements.push(env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind('bootstrap:'+uid));
    try{await repo.commit([{path:'users/'+uid,data:profile}],statements);}catch(e){if(e instanceof ApiError&&e.code==='already-exists')throw new ApiError(409,'account-exists','Unable to create this account. Try signing in.');throw e;}
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
    onlyKeys(body,['name','selectedRole','organizationName']);const name=textField(body.name,'Name',2,120);badInput(['user','orgadmin'].includes(body.selectedRole));requireThat(user.role==='user','This account is already configured.');const writes:Write[]=[{path:'users/'+user.uid,data:{...user.profile!,name,registrationComplete:true}}];
    if(body.selectedRole==='orgadmin'){requireThat(env.APP_WRITES_ENABLED==='true','Organization applications are temporarily read-only.',503,'maintenance');const organizationName=textField(body.organizationName,'Organization name',2,160),path='organizationApplications/'+user.uid;if(!await repo.data(path))writes.push({path,data:{applicantId:user.uid,applicantName:name,applicantEmail:user.email,organizationName,businessPhone:'',businessAddress:'',businessCity:'',status:'pending',createdAt:new Date().toISOString()}});}
    await repo.commit(writes);return {completed:true};
  }
  throw new ApiError(404,'not-found','Authentication endpoint not found.');
}
