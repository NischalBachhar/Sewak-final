import {sqlStatements} from '../../scripts/sql-statements.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {seed} from './harness.mjs';
import {OWNER,inspectOwner,recoveryPlan,applyOwnerRecovery} from '../../scripts/superadmin-recovery-core.mjs';
import {verifyOwnerLogin} from '../../scripts/superadmin-login-verification.mjs';
const require=createRequire(new URL('../../worker/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const {build}=require('esbuild');const sharp=require('sharp');

test('actual workerd bindings enforce D1 auth and private media, reject retired imports and round-trip a binary BLOB',async()=>{
 const bundle=await build({entryPoints:['worker/src/index.ts'],bundle:true,format:'esm',platform:'browser',external:['node:*'],target:'es2022',write:false});
 const options={modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-01',compatibilityFlags:['nodejs_compat'],durableObjects:{PASSWORD_HASHER:{className:'PasswordHasher',useSQLite:true}},d1Databases:{DB:'integration-main',MEDIA_DB:'integration-media'},bindings:{AUTH_AUDIENCE:'workerd-test',APP_WRITES_ENABLED:'true',EMAIL_PROVIDER:'resend',RESEND_API_KEY:'synthetic-never-send',EMAIL_FROM:'test@sewak.test',APP_BASE_URL:'https://sewak.test',OUTBOX_ENCRYPTION_KEY:'A'.repeat(43)}};
 const mf=new Miniflare(convertV4MiniflareOptions(options));
 try{
  const DB=await mf.getD1Database('DB'),MEDIA_DB=await mf.getD1Database('MEDIA_DB');
  for(const [db,file]of [[DB,'migrations/main/0001_sewak.sql'],[DB,'migrations/main/0002_auth_state.sql'],[DB,'migrations/main/0003_cloudflare_auth.sql'],[DB,'migrations/main/0004_catalog_onboarding.sql'],[DB,'migrations/main/0005_auth_notifications.sql'],[MEDIA_DB,'migrations/media/0001_profile_images.sql']])for(const sql of sqlStatements(readFileSync(file,'utf8')))await db.prepare(sql).run();
  // Exercise the operator transaction against real workerd/D1, then verify that
  // native Durable Object scrypt accepts the password hashed by the Node CLI.
  const operator={id:OWNER.cloudflareId,email:OWNER.email};
  const owner=await applyOwnerRecovery(DB,operator,recoveryPlan(await inspectOwner(DB),'bootstrap'),'Workerd-owner-password-2026!');
  const dispatch=(url,init)=>mf.dispatchFetch(url,init);
  assert.equal((await verifyOwnerLogin(DB,owner.uid,'Workerd-owner-password-2026!',dispatch,'http://localhost')).loginVerified,true);
  const resetPlan=recoveryPlan(await inspectOwner(DB),'reset');
  await applyOwnerRecovery(DB,operator,resetPlan,'Workerd-recovered-password-2026!');
  assert.equal((await verifyOwnerLogin(DB,owner.uid,'Workerd-recovered-password-2026!',dispatch,'http://localhost')).verificationSessionRevoked,true);
  await assert.rejects(applyOwnerRecovery(DB,operator,resetPlan,'Stale-password-must-not-apply!'));
  assert.equal((await DB.prepare('SELECT COUNT(*) n FROM cf_sessions WHERE user_id=?').bind(owner.uid).first()).n,0);
  assert.equal((await DB.prepare('SELECT COUNT(*) n FROM admin_audit_logs WHERE target_uid=?').bind(owner.uid).first()).n,2);
  await seed({DB,MEDIA_DB});
  const orgResponse=await mf.dispatchFetch('http://localhost/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'workerd.org@gmail.com',password:'Workerd-test-password-2026!',name:'Workerd Organization',sessionMode:'bearer',selectedRole:'orgadmin',organizationName:'Workerd Care',organizationType:'Caregiver Agency',businessPhone:'9800000000',businessAddress:'Test street 12',businessCity:'Hetauda',servicesOffered:['catalog_elderly_care']})});
  assert.equal(orgResponse.status,200,await orgResponse.clone().text()); const orgAccount=await orgResponse.json(); assert.equal(orgAccount.user.role,'orgadmin');
  assert.equal((await DB.prepare('SELECT COUNT(*) n FROM organization_services WHERE organization_id=?').bind(orgAccount.user.uid).first()).n,1);
  const listing=await mf.dispatchFetch('http://localhost/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'publicCaregivers',search:{serviceId:'care',minimumExperience:2,location:'hetauda'}})});
  assert.equal(listing.status,200,await listing.clone().text()); assert.equal((await listing.json()).total,1);
  const authBody={email:'workerd@gmail.com',password:'Workerd-test-password-2026!',name:'Workerd Test',sessionMode:'bearer'};
  const authResponse=await mf.dispatchFetch('http://localhost/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(authBody)});
  assert.equal(authResponse.status,200,await authResponse.clone().text());const registered=await authResponse.json();await DB.prepare('UPDATE cf_credentials SET email_verified_at=unixepoch() WHERE user_id=?').bind(registered.user.uid).run();
  const loggedIn=await mf.dispatchFetch('http://localhost/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:authBody.email,password:authBody.password,sessionMode:'bearer'})});
  assert.equal(loggedIn.status,200,await loggedIn.clone().text());
  const me=await mf.dispatchFetch('http://localhost/auth/me',{headers:{Authorization:`Bearer ${registered.token}`}});assert.equal((await me.json()).user.uid,registered.user.uid);
  assert.equal((await mf.dispatchFetch('http://localhost/api/records/users/customer')).status,401);
  assert.equal((await mf.dispatchFetch('http://localhost/api/records/users/customer',{headers:{Authorization:'Bearer forged'}})).status,401);
  assert.equal((await mf.dispatchFetch('http://localhost/api/migration/profiles/caregiver/image',{method:'PUT',body:'forged'})).status,404);
  const photo=await sharp({create:{width:320,height:240,channels:3,background:'#936c5d'}}).webp().toBuffer();
  const response=await mf.dispatchFetch('http://localhost/api/profiles/'+registered.user.uid+'/image',{method:'PUT',headers:{'Content-Type':'image/webp',Authorization:'Bearer '+registered.token},body:photo});
  assert.equal(response.status,200,await response.clone().text());const saved=await response.json();
  const row=await MEDIA_DB.prepare('SELECT typeof(data) type,length(data) bytes FROM media').first();assert.equal(row.type,'blob');assert.equal(row.bytes,photo.length);
  assert.equal((await mf.dispatchFetch(`http://localhost${saved.url}`)).status,403);
  const served=await mf.dispatchFetch(`http://localhost${saved.url}`,{headers:{Authorization:'Bearer '+registered.token}});assert.equal(served.status,200);assert.deepEqual(Buffer.from(await served.arrayBuffer()),photo);
  const profile=await DB.prepare('SELECT profile_image_id,updated_at FROM users WHERE id=?').bind(registered.user.uid).first();assert.equal(profile.profile_image_id,'profile_'+registered.user.uid);assert.ok(profile.updated_at);
  await mf.setOptions(convertV4MiniflareOptions({...options,bindings:{...options.bindings,APP_WRITES_ENABLED:'false'}}));
  assert.equal((await mf.dispatchFetch('http://localhost/api/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
  assert.deepEqual((await (await mf.getD1Database('DB')).prepare('PRAGMA foreign_key_check').all()).results,[]);
 }finally{await mf.dispose();}
});
