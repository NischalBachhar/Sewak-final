import { requireThat, type Env, type Data } from './types.ts';
import { appOrigin } from './email.ts';

export const googleReady=(env:Env)=>Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.APP_ORIGIN);
const decode=(part:string)=>Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function googleIdentity(env:Env,code:string,verifier:string,nonce:string) {
  const response=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:appOrigin(env)+'/api/auth/google/callback',grant_type:'authorization_code',code_verifier:verifier}),
  });
  requireThat(response.ok,'Google sign-in could not be completed. Please try again.',400,'google-failed');
  const tokens=await response.json<Data>();
  requireThat(typeof tokens.id_token==='string'&&tokens.id_token.length<12000,'Invalid Google response.',400,'google-failed');
  const parts=tokens.id_token.split('.');
  requireThat(parts.length===3,'Invalid Google response.',400,'google-failed');
  let header:Data,claims:Data;
  try{header=JSON.parse(new TextDecoder().decode(decode(parts[0])));claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));}
  catch{throw new Error('Invalid Google token');}
  requireThat(header.alg==='RS256'&&typeof header.kid==='string','Invalid Google response.',400,'google-failed');
  const keysResponse=await fetch('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(10000)});
  requireThat(keysResponse.ok,'Google sign-in is temporarily unavailable.',503,'unavailable');
  const {keys}=await keysResponse.json<{keys:(JsonWebKey&{kid?:string})[]}>();
  const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.use==='sig'&&k.alg==='RS256');
  requireThat(jwk,'Invalid Google response.',400,'google-failed');
  const key=await crypto.subtle.importKey('jwk',jwk!,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  const now=Math.floor(Date.now()/1000);
  requireThat(valid&&['https://accounts.google.com','accounts.google.com'].includes(claims.iss)&&claims.aud===env.GOOGLE_CLIENT_ID
    &&(!claims.azp||claims.azp===env.GOOGLE_CLIENT_ID)&&claims.nonce===nonce&&Number.isFinite(claims.exp)&&claims.exp>now
    &&Number.isFinite(claims.iat)&&claims.iat<=now+60&&claims.iat>=now-600
    &&typeof claims.sub==='string'&&claims.sub.length>0&&claims.sub.length<=255,
    'Invalid or expired Google response.',400,'google-failed');
  requireThat(claims.email_verified===true&&typeof claims.email==='string'&&/^[^@\s]+@gmail\.com$/i.test(claims.email),
    'Choose a verified Gmail account to continue.',400,'gmail-required');
  return {sub:claims.sub as string,email:claims.email.toLowerCase() as string,name:typeof claims.name==='string'?claims.name.slice(0,120):'Sewak member'};
}
