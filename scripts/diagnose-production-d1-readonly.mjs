// Production D1 diagnostic. SELECT only; no user records, SQL, bind values,
// authentication material or exception text are ever logged.
import {openTarget} from './d1-target.mjs';
import {SEWAK_ACCOUNT, targets} from './deployment-policy.mjs';
import {safeD1Category} from '../worker/src/d1-diagnostics.ts';
if (process.env.CLOUDFLARE_ACCOUNT_ID !== SEWAK_ACCOUNT) throw new Error('Select the Sewak production account with CLOUDFLARE_ACCOUNT_ID.');
const {DB,MEDIA_DB,close}=await openTarget({remote:true,mainId:targets['sewak-final'].DB[1],mediaId:targets['sewak-final'].MEDIA_DB[1]});
const missingToken='0'.repeat(64),missingUid='usr_'+'0'.repeat(36);
const probes=[
 ['auth.session.lookup',DB,'SELECT s.*,c.email,c.disabled,c.credential_version AS current_version FROM cf_sessions s JOIN cf_credentials c ON c.user_id=s.user_id WHERE s.token_hash=? AND s.audience=? LIMIT 1',[missingToken,'sewak-production']],
 ['auth.session.profile',DB,'SELECT id,version,fields_present,extra_json,uid,name,email,role,organization_id,is_suspended,is_blacklisted FROM users WHERE id=? LIMIT 1',[missingUid]],
 ['auth.session.refresh-shape',DB,'SELECT last_seen_at,expires_at FROM cf_sessions WHERE id=? AND expires_at>? LIMIT 1',[missingUid,0]],
 ['auth.login.credentials',DB,'SELECT * FROM cf_credentials WHERE email=? LIMIT 1',['never-used-sewak-diagnostic@example.invalid']],
 ['auth.rate.schema',DB,'SELECT bucket,hits,reset_at FROM cf_auth_limits WHERE bucket=? LIMIT 1',[missingToken]],
 ['auth.login.commit-shape',DB,'SELECT credential_version,disabled FROM cf_credentials WHERE user_id=? LIMIT 1',[missingUid]],
 ['public.caregivers.shape',DB,'SELECT t.id,t.version,t.fields_present,t.extra_json,t.is_approved,t.is_available,t.organization_id,o.is_approved,u.is_suspended FROM caregivers t LEFT JOIN organizations o ON o.id=t.organization_id LEFT JOIN users u ON u.id=t.id WHERE t.id=? LIMIT 1',[missingUid]],
 ['public.services.shape',DB,'SELECT id,version,fields_present,extra_json,is_active,organization_id FROM services WHERE id=? LIMIT 1',[missingUid]],
 ['media.readonly',MEDIA_DB,'SELECT id FROM media WHERE id=? LIMIT 1',[missingUid]],
];
let failures=0;
try {
 for(const [stage,db,sql,params] of probes){
  try {await db.prepare(sql).bind(...params).first();console.log(JSON.stringify({stage,pass:true}));}
  catch(error){failures++;console.log(JSON.stringify({stage,pass:false,category:safeD1Category(error)}));}
 }
} finally {await close();}
console.log(JSON.stringify({pass:failures===0,probes:probes.length,failures,mode:'remote-read-only'}));
if(failures)process.exitCode=1;
