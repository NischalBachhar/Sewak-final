import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {seed} from './harness.mjs';
const require=createRequire(new URL('../../worker/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const {build}=require('esbuild');const sharp=require('sharp');

test('actual workerd bindings enforce auth and migration gates and round-trip a binary D1 BLOB',async()=>{
 const bundle=await build({entryPoints:['worker/src/index.ts'],bundle:true,format:'esm',platform:'browser',external:['node:*'],target:'es2022',write:false});
 const token='local-test-only-credential-'.repeat(3);
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-01',compatibilityFlags:['nodejs_compat'],durableObjects:{PASSWORD_HASHER:{className:'PasswordHasher',useSQLite:true}},d1Databases:{DB:'integration-main',MEDIA_DB:'integration-media'},bindings:{AUTH_AUDIENCE:'workerd-test',APP_WRITES_ENABLED:'false',MIGRATION_ENABLED:'true',MIGRATION_TOKEN:token}}));
 try{
  const DB=await mf.getD1Database('DB'),MEDIA_DB=await mf.getD1Database('MEDIA_DB');
  for(const [db,file]of [[DB,'migrations/main/0001_sewak.sql'],[DB,'migrations/main/0002_auth_state.sql'],[DB,'migrations/main/0003_cloudflare_auth.sql'],[MEDIA_DB,'migrations/media/0001_profile_images.sql']])for(const sql of readFileSync(file,'utf8').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  await seed({DB,MEDIA_DB});
  const authBody={email:'workerd@example.test',password:'Workerd-test-password-2026!',name:'Workerd Test',sessionMode:'bearer'};
  const authResponse=await mf.dispatchFetch('http://localhost/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(authBody)});
  assert.equal(authResponse.status,200,await authResponse.clone().text());const registered=await authResponse.json();
  const loggedIn=await mf.dispatchFetch('http://localhost/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:authBody.email,password:authBody.password,sessionMode:'bearer'})});
  assert.equal(loggedIn.status,200,await loggedIn.clone().text());
  const me=await mf.dispatchFetch('http://localhost/auth/me',{headers:{Authorization:`Bearer ${registered.token}`}});assert.equal((await me.json()).user.uid,registered.user.uid);
  assert.equal((await mf.dispatchFetch('http://localhost/api/records/users/customer')).status,401);
  assert.equal((await mf.dispatchFetch('http://localhost/api/records/users/customer',{headers:{Authorization:'Bearer forged'}})).status,401);
  assert.equal((await mf.dispatchFetch('http://localhost/api/migration/profiles/caregiver/image',{method:'PUT',body:'forged'})).status,401);
  const photo=await sharp({create:{width:320,height:240,channels:3,background:'#936c5d'}}).webp().toBuffer();
  const response=await mf.dispatchFetch('http://localhost/api/migration/profiles/caregiver/image',{method:'PUT',headers:{'Content-Type':'image/webp','X-Sewak-Migration-Token':token},body:photo});
  assert.equal(response.status,200,await response.clone().text());const saved=await response.json();
  const row=await MEDIA_DB.prepare('SELECT typeof(data) type,length(data) bytes FROM media').first();assert.equal(row.type,'blob');assert.equal(row.bytes,photo.length);
  const served=await mf.dispatchFetch(`http://localhost${saved.url}`);assert.equal(served.status,200);assert.deepEqual(Buffer.from(await served.arrayBuffer()),photo);
  const profile=await DB.prepare('SELECT profile_image_id,updated_at FROM caregivers WHERE id=?').bind('caregiver').first();assert.equal(profile.profile_image_id,'profile_caregiver');assert.equal(profile.updated_at,null);
  assert.equal((await mf.dispatchFetch('http://localhost/api/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
  assert.deepEqual((await DB.prepare('PRAGMA foreign_key_check').all()).results,[]);
 }finally{await mf.dispose();}
});
