import { createRemoteJWKSet, jwtVerify } from 'jose';
import { appBase } from './delivery.ts';
import { authLimit, digest, epoch, newAccountProfile, newSession, opaque, sessionResponse } from './cloudflare-auth.ts';
import { base64url } from './secret-box.ts';
import { registrationEmail } from './email-auth.ts';
import { Repository } from './repository.ts';
import { badInput, onlyKeys, requireThat, type Data, type Env } from './types.ts';
const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{timeoutDuration:5000});
export function googleConfigured(env:Env){try{return !!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&appBase(env));}catch{return false;}}
export async function verifyGoogleToken(token:string,env:Env,nonce:string,keys:Parameters<typeof jwtVerify>[1]=jwks) {
 const {payload}=await jwtVerify(token,keys,{audience:env.GOOGLE_CLIENT_ID,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256'],maxTokenAge:'10m'});
 requireThat(payload.nonce===nonce&&payload.email_verified===true&&typeof payload.email==='string'&&typeof payload.sub==='string'&&payload.sub.length>0&&payload.sub.length<=255,'Google sign-in could not be verified.',400,'invalid-oauth');
 return payload;
}
export async function googleRoute(request:Request,env:Env,headers:Headers,body:Data) {
 requireThat(googleConfigured(env),'Google sign-in is not configured.',503,'oauth-unavailable');
 const url=new URL(request.url),redirect=appBase(env)+'/api/auth/google/callback';
 requireThat(url.origin===appBase(env),'Use the configured Sewak website.',403,'csrf-rejected');
 if(url.pathname.endsWith('/start')) {
  badInput(request.method==='POST');onlyKeys(body,['role']);badInput(['user','orgadmin'].includes(body.role));
  requireThat(request.headers.get('Origin')===url.origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site','Use the Sewak website.',403,'csrf-rejected');await authLimit(request,env,'google-start');
  const state=opaque(),browser=opaque(),nonce=opaque(),verifier=opaque();
  await env.DB.batch([env.DB.prepare('DELETE FROM cf_oauth_states WHERE expires_at<?').bind(epoch()),env.DB.prepare('INSERT INTO cf_oauth_states(state_hash,nonce,verifier,browser_hash,role,expires_at) VALUES(?,?,?,?,?,?)').bind(await digest(state),nonce,verifier,await digest(browser),body.role,epoch()+600)]);
  headers.append('Set-Cookie',`__Host-sewak_oauth=${browser}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`);
  const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');target.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,redirect_uri:redirect,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)))),code_challenge_method:'S256',prompt:'select_account'}).toString();
  return Response.json({url:target.href},{headers});
 }
 badInput(request.method==='GET');await authLimit(request,env,'google-callback');
 const state=url.searchParams.get('state'),code=url.searchParams.get('code');badInput(state&&state.length<=128&&code&&code.length<=4096,'Google sign-in was cancelled or expired.');
 const cookies=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('__Host-sewak_oauth='));
 requireThat(cookies.length===1,'Restart Google sign-in.',400,'invalid-oauth');
 const saved=await env.DB.prepare('DELETE FROM cf_oauth_states WHERE state_hash=? AND browser_hash=? AND expires_at>? RETURNING *').bind(await digest(state!),await digest(cookies[0].slice('__Host-sewak_oauth='.length)),epoch()).first<Data>();
 requireThat(saved,'Restart Google sign-in.',400,'invalid-oauth');
 headers.append('Set-Cookie','__Host-sewak_oauth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
 const exchange=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:code!,client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,redirect_uri:redirect,grant_type:'authorization_code',code_verifier:saved.verifier}),signal:AbortSignal.timeout(10000),redirect:'error'});
 requireThat(exchange.ok,'Google sign-in failed. Restart sign-in.',400,'invalid-oauth');const tokens=await exchange.json() as Data;
 const claim=await verifyGoogleToken(tokens.id_token,env,saved.nonce),email=registrationEmail(claim.email,saved.role,env),repo=new Repository(env);
 const linked=await env.DB.prepare("SELECT c.* FROM cf_oauth_identities i JOIN cf_credentials c ON c.user_id=i.user_id WHERE i.provider='google' AND i.subject=?").bind(claim.sub).first<Data>();
 let uid:string,profile:Data,version:number;
 const extra:D1PreparedStatement[]=[];const writes=[];
 if(linked) {
  uid=linked.user_id;version=linked.credential_version;profile=(await repo.data('users/'+uid))!;
  requireThat(!linked.disabled&&profile&&!profile.isSuspended&&!profile.isBlacklisted&&['user','caregiver','orgadmin'].includes(profile.role),'This account cannot sign in.',403,'account-unavailable');
  requireThat(linked.email===email&&linked.email_verified_at,'Sign in through your existing account recovery process.',403,'identity-changed');
  if(profile.role==='caregiver'&&profile.organizationId){const org=await repo.data('organizations/'+profile.organizationId);requireThat(org&&!org.isSuspended&&!org.isBlacklisted);}
 } else {
  requireThat(env.APP_WRITES_ENABLED==='true','Registration is temporarily read-only.',503,'maintenance');
  requireThat(!await env.DB.prepare('SELECT user_id FROM cf_credentials WHERE email=? UNION ALL SELECT email FROM cf_bootstrap WHERE email=?').bind(email,email).first(),'An account already uses this email. Sign in with its existing method. Google accounts are never linked by email alone.',409,'account-exists');
  uid='usr_'+crypto.randomUUID();version=1;profile={...newAccountProfile(uid,email,typeof claim.name==='string'?claim.name.slice(0,120):'Sewak member'),registrationRole:saved.role};
  writes.push({path:'users/'+uid,data:profile});extra.push(env.DB.prepare('INSERT INTO cf_credentials(user_id,email,created_at,email_verified_at) VALUES(?,?,?,?)').bind(uid,email,epoch(),epoch()),env.DB.prepare("INSERT INTO cf_oauth_identities(provider,subject,user_id) VALUES('google',?,?)").bind(claim.sub,uid));
 }
 const session=await newSession(env,uid,version,'cookie'),guard='oauth:'+session.id;
 extra.push(env.DB.prepare('INSERT INTO commit_guards(id,valid) VALUES(?,EXISTS(SELECT 1 FROM cf_credentials WHERE user_id=? AND credential_version=? AND disabled=0))').bind(guard,uid,version),session.statement,env.DB.prepare('DELETE FROM commit_guards WHERE id=?').bind(guard));
 await repo.commit(writes,extra);await sessionResponse(env,headers,uid,email,profile,session,'cookie');headers.set('Location',appBase(env)+'/');return new Response(null,{status:303,headers});
}
