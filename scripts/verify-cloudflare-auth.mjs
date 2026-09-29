// Explicit operator QA: synthetic identities only, credentials remain in memory.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {openTarget} from './d1-target.mjs';
import {cloudflare} from './cloudflare-operator.mjs';
import {assertLiveBindings} from './deployment-policy.mjs';
import {entities} from '../worker/src/model.mjs';
const worker=process.argv[process.argv.indexOf('--worker')+1];
assert.ok(['sewak','sewak-final'].includes(worker),'Exact Sewak Worker required');
assert.ok(process.argv.includes('--apply-synthetic-qa'),'Explicit synthetic auth QA flag required');
const staging=worker==='sewak',config=readFileSync(staging?'wrangler.toml':'wrangler.production.toml','utf8'),ids=[...config.matchAll(/^database_id = "([^"]+)"/gm)].map(m=>m[1]);
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,'860970f755498a4fe10e16c2fa99ce55');
assert.equal(/APP_WRITES_ENABLED = "false"/.test(config),true);
assert.equal(ids.includes('36fa1df1-aa5d-43a1-ad0e-a4e310c513c3'),!staging);
const origin=`https://${worker}.nischalbachhar9.workers.dev`,target=await openTarget({remote:true,mainId:ids[0],mediaId:ids[1]}),{DB,MEDIA_DB}=target;
const run=randomUUID(),password=randomBytes(32).toString('base64url')+'!Aa9',users=[],checks=[],report={auth:'cloudflare-d1',worker,startedAt:new Date().toISOString(),pass:false,checks};
const output=`.local-tools/cloudflare-auth/${worker}-qa-${run}.json`;mkdirSync('.local-tools/cloudflare-auth',{recursive:true});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function appHash(){const rows={};for(const table of [...new Set(Object.values(entities).map(e=>e.table))])rows[table]=(await DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all()).results;rows.media=(await MEDIA_DB.prepare('SELECT id,owner_id,file_size,digest FROM media ORDER BY id').all()).results;return hash(rows);}
const before=await appHash();let bootstrapOwned=false,browser;
async function request(path,{body,headers={},method=body?'POST':'GET',expected=200,label=path}={}){
 report.activeRequest={label,method,path,startedAt:new Date().toISOString()};
 const r=await fetch(origin+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(45000)});
 const data=r.headers.get('Content-Type')?.startsWith('application/json')?await r.json():Buffer.from(await r.arrayBuffer());
 checks.push({label,status:r.status});delete report.activeRequest;assert.equal(r.status,expected,`${label}: HTTP ${r.status} ${data?.error?.code||''}`);return {r,data};
}
const authorization=u=>({Authorization:'Bearer '+u.token});
try{
 // Staging can contain real accounts. Preserve them and create/clean only this
 // run's random identities; appHash below proves existing profiles unchanged.
 if(staging)report.preexistingAccounts=(await DB.prepare('SELECT COUNT(*) n FROM cf_credentials').first()).n;
 const health=(await request('/api/health')).data;assert.equal(health.auth,'cloudflare-d1');assert.equal(health.writesEnabled,false);
 const settings=await cloudflare(`/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${worker}/settings`);const bindings=settings.bindings;
 assertLiveBindings(worker,bindings,false);
 for(const [name,id]of [['DB',ids[0]],['MEDIA_DB',ids[1]]])assert.equal(bindings.find(b=>b.name===name)?.id,id,'Exact remote database binding');
 report.version=(await cloudflare(`/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${worker}/deployments`)).deployments[0].versions[0].version_id;
 for(const role of ['user','caregiver','orgadmin','superadmin']){
  const email=`qa-${role}-${run}@example.invalid`;let path='/auth/register',body={email,password,name:'Synthetic QA '+role,sessionMode:'bearer'};
  if(staging&&role==='superadmin'){
   assert.equal(await DB.prepare('SELECT id FROM cf_bootstrap').first(),null,'No existing staging bootstrap may be overwritten');const token='swk_'+randomBytes(32).toString('base64url');
   await DB.prepare('INSERT INTO cf_bootstrap(id,email,token_hash,expires_at) VALUES(1,?,?,?)').bind(email,createHash('sha256').update(token).digest('hex'),Math.floor(Date.now()/1000)+600).run();bootstrapOwned=true;path='/auth/bootstrap';body.bootstrapToken=token;
  }
  const result=await request(path,{body,label:'create synthetic '+role});const u={uid:result.data.user.uid,email,token:result.data.token,session:result.data.session.id,role};users.push(u);
  assert.match(u.uid,/^usr_/);assert.match(u.token,/^swk_[\w-]{43}$/);
  // Test-only roles apply exclusively to the just-created random QA identities.
  if(role!=='user')await DB.prepare('UPDATE users SET role=?,profile_complete=1 WHERE id=? AND email=?').bind(role,u.uid,email).run();
  else await DB.prepare('UPDATE users SET profile_complete=1 WHERE id=? AND email=?').bind(u.uid,email).run();
  const me=(await request('/auth/me',{headers:authorization(u),label:role+' session mapping'})).data;assert.equal(me.user.uid,u.uid);assert.equal(me.user.role,role);
  const row=await DB.prepare('SELECT password_hash FROM cf_credentials WHERE user_id=?').bind(u.uid).first();assert.match(row.password_hash,/^scrypt-v1\$32768\$8\$3\$/);assert.ok(!JSON.stringify(row).includes(password));
 }
 const [customer,caregiver,org,admin]=users;
 for(const u of users){await request('/api/records/users/'+u.uid,{headers:authorization(u),label:u.role+' private self read'});await request('/api/query',{body:{path:'users',limit:1},headers:authorization(u),expected:u.role==='superadmin'?200:403,label:u.role+' server role enforcement'});if(u!==admin)await request('/api/records/users/'+admin.uid,{headers:authorization(u),expected:403,label:u.role+' cross-user rejection'});}
 await request('/api/records/users/'+customer.uid,{expected:401,label:'anonymous private read'});
 await request('/auth/me',{headers:{Authorization:'Bearer forged.firebase.token'},expected:401,label:'invalid token'});
 await request('/auth/me',{headers:{Authorization:'Bearer swk_'+randomBytes(32).toString('base64url')},expected:401,label:'unknown opaque token'});
 const web=await request('/auth/login',{headers:{Origin:origin},body:{email:customer.email,password},label:'real web password login'}),cookie=web.r.headers.get('set-cookie');
 for(const attribute of ['Secure','HttpOnly','SameSite=Lax','Path=/'])assert.ok(cookie.includes(attribute));assert.equal(web.data.token,undefined);
 const cookieHeaders={Cookie:cookie.split(';')[0],Origin:origin,'X-CSRF-Token':web.data.csrfToken};
 await request('/api/records/users/'+customer.uid,{headers:cookieHeaders,label:'cookie private read'});
 await request('/auth/revoke-sessions',{headers:{Cookie:cookieHeaders.Cookie,Origin:origin},body:{sessionId:'nonexistent'},expected:403,label:'missing CSRF'});
 await request('/auth/revoke-sessions',{headers:{...cookieHeaders,Origin:'https://evil.invalid'},body:{sessionId:'nonexistent'},expected:403,label:'foreign Origin'});
 await request('/auth/me',{headers:{...cookieHeaders,...authorization(customer)},expected:400,label:'mixed transports rejected'});
 await request('/api/commit',{headers:cookieHeaders,body:{writes:[]},expected:503,label:'application maintenance gate'});
 await request('/api/actions/provisionSuperAdminAccount',{headers:authorization(admin),body:{},expected:503,label:'admin maintenance gate'});
 for(const [headers,status,label]of [[{},403,'anonymous'],[authorization(caregiver),403,'cross-user'],[authorization(customer),404,'authorized missing']])await request('/api/media/profile_'+customer.uid,{headers,expected:status,label:label+' private media'});
 // Exercise private binary reads while normal image writes stay blocked. The
 // operator fixture belongs only to this run's new identity and is removed.
 {
  const require=createRequire(new URL('../worker/package.json',import.meta.url)),bytes=await require('sharp')({create:{width:32,height:24,channels:3,background:'#71665a'}}).webp().toBuffer(),digest=createHash('sha256').update(bytes).digest('hex'),id='profile_'+customer.uid,now=new Date().toISOString();
  await MEDIA_DB.prepare(`INSERT INTO media(id,owner_id,owner_type,mime_type,file_size,width,height,data,digest,created_at,updated_at) VALUES(?,?,?,'image/webp',?,32,24,X'${bytes.toString('hex')}',?,?,?)`).bind(id,customer.uid,'user',bytes.length,digest,now,now).run();
  await DB.prepare('UPDATE users SET profile_image_id=?,fields_present=json_insert(fields_present,\'$[#]\',\'profile_image_id\') WHERE id=?').bind(id,customer.uid).run();
  const image=await request('/api/media/'+id,{headers:authorization(customer),label:'remote authenticated media bytes'});assert.match(image.r.headers.get('Content-Type'),/^image\/webp/);assert.ok(image.data.length>0);assert.ok(image.data.equals(bytes));
  await request('/api/media/'+id,{expected:403,label:'existing private media anonymous rejection'});await request('/api/media/'+id,{headers:authorization(caregiver),expected:403,label:'existing private media cross-user rejection'});
 }
 const expired=await request('/auth/login',{body:{email:customer.email,password,sessionMode:'bearer'},label:'mobile password login'});
 await DB.prepare('UPDATE cf_sessions SET expires_at=0 WHERE id=? AND user_id=?').bind(expired.data.session.id,customer.uid).run();await request('/auth/me',{headers:{Authorization:'Bearer '+expired.data.token},expected:401,label:'expired session'});
 const changed=randomBytes(32).toString('base64url');await request('/auth/change-password',{headers:authorization(caregiver),body:{currentPassword:password,newPassword:changed},label:'password change'});await request('/auth/me',{headers:authorization(caregiver),expected:401,label:'password revokes old session'});
 await request('/auth/logout',{headers:authorization(org),body:{},label:'logout'});await request('/auth/me',{headers:authorization(org),expected:401,label:'logout revokes session'});
 const missing=`qa-rate-${run}@example.invalid`;for(let i=0;i<10;i++)await request('/auth/login',{body:{email:missing,password,sessionMode:'bearer'},expected:401,label:'failed login '+(i+1)});await request('/auth/login',{body:{email:missing.toUpperCase(),password,sessionMode:'bearer'},expected:429,label:'persistent normalized-email rate limit'});
 const {chromium}=await import('@playwright/test');browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext(),external=[];
 const forbidden=url=>/googleapis\.com|firebaseio\.com|firebaseapp\.com|firebasestorage\.app/.test(new URL(url).hostname);
 await context.route('**/*',route=>forbidden(route.request().url())?route.abort('internetdisconnected'):route.continue());
 context.on('request',r=>{if(forbidden(r.url()))external.push(new URL(r.url()).hostname);});
 const page=await context.newPage();await page.goto(origin+'/auth');await page.getByLabel('Email',{exact:true}).fill(customer.email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(url=>url.pathname==='/user');await page.goto(origin+'/user/profile');await page.getByRole('button',{name:'Save Profile',exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Save Profile',exact:true}).waitFor();
 const stored=await page.evaluate(()=>({local:Object.keys(localStorage),visibleCookie:document.cookie}));assert.ok(!stored.visibleCookie.includes('__Host-sewak_session'));assert.ok(!stored.local.some(k=>/firebase|token|session/i.test(k)));assert.deepEqual(external,[]);report.browser={realCookieLogin:true,sessionRestored:true,privateProfile:true,firebaseRequests:0,firebaseNetworkBlocked:true,httpOnly:true};await context.close();
 await request('/auth/revoke-sessions',{headers:authorization(customer),body:{all:true},label:'all-session revocation'});await request('/auth/me',{headers:cookieHeaders,expected:401,label:'cookie revoked with all sessions'});
 assert.equal((await request('/api/health',{label:'writes remain disabled'})).data.writesEnabled,false);
 report.checksPassed=true;
}catch(error){report.failure={name:error.name,message:error.message};}
finally{
 if(browser)await browser.close();
 try{
  // A network timeout can happen after commit but before response delivery.
  // Recover only this run's exact synthetic IDs before removing its records.
  for(const role of ['user','caregiver','orgadmin','superadmin']){const email=`qa-${role}-${run}@example.invalid`,row=await DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();if(row&&!users.some(u=>u.uid===row.id))users.push({uid:row.id,email,role});}
  for(const u of users){assert.ok(u.email.includes(run));await MEDIA_DB.prepare('DELETE FROM media WHERE owner_id=?').bind(u.uid).run();await DB.batch([DB.prepare('DELETE FROM cf_invitations WHERE user_id=?').bind(u.uid),DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind(u.uid),DB.prepare('DELETE FROM cf_credentials WHERE user_id=? AND email=?').bind(u.uid,u.email),DB.prepare('DELETE FROM users WHERE id=? AND email=?').bind(u.uid,u.email)]);assert.equal(await DB.prepare('SELECT id FROM users WHERE id=?').bind(u.uid).first(),null);}
  if(staging||bootstrapOwned)await DB.prepare('DELETE FROM cf_bootstrap WHERE email=?').bind(`qa-superadmin-${run}@example.invalid`).run();
  assert.equal(await appHash(),before,'Original application/media rows remain exact after synthetic QA cleanup');report.cleanupVerified=true;report.applicationRecordsUnchanged=true;
 }catch(error){report.cleanupFailure={name:error.name,message:error.message};}
 report.pass=Boolean(report.checksPassed&&report.cleanupVerified);report.completedAt=new Date().toISOString();writeFileSync(output,JSON.stringify(report,null,2));await target.close();
 console.log(JSON.stringify({pass:report.pass,worker,checks:checks.length,report:output,cleanupVerified:report.cleanupVerified,...(report.failure?{failure:report.failure}:{}),...(report.cleanupFailure?{cleanupFailure:report.cleanupFailure}:{})}));
 if(!report.pass)process.exitCode=1;
}
