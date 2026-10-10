import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import {environment,put} from './harness.mjs';
import {createWorker} from '../../worker/src/index.ts';
import {OWNER,LEGACY_ADMIN,assertOperator,inspectOwner,recoveryPlan,applyOwnerRecovery} from '../../scripts/superadmin-recovery-core.mjs';
import {verifiedOwnerTarget} from '../../scripts/superadmin-operator.mjs';
import {privateInput} from '../../scripts/private-terminal.mjs';
import {verifyOwnerLogin} from '../../scripts/superadmin-login-verification.mjs';
import {SEWAK_ACCOUNT,targets} from '../../scripts/deployment-policy.mjs';
import {hashPassword,verifyPassword} from '../../worker/src/passwords.ts';
import {digest,opaque,epoch,invitationStatement} from '../../worker/src/cloudflare-auth.ts';
const identity={id:OWNER.cloudflareId,email:OWNER.email},password='Synthetic-owner-password-2026!',worker=createWorker();
async function request(env,path,body,token){const r=await worker.fetch(new Request('https://sewak.test'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json()};}
async function bootstrap(env){return applyOwnerRecovery(env.DB,identity,recoveryPlan(await inspectOwner(env.DB),'bootstrap'),password);}
async function login(env,pw=password){return request(env,'/auth/login',{email:OWNER.email,password:pw,sessionMode:'bearer'});}
async function legacy(env){await put(env,'users/'+LEGACY_ADMIN,{uid:LEGACY_ADMIN,name:OWNER.name,role:'superadmin'});}
async function snapshot(DB){return JSON.stringify((await DB.prepare('SELECT * FROM users ORDER BY id').all()).results);}

test('missing owner bootstrap uses shared scrypt, grants server authorization, audits and permanently prevents duplication',async()=>{
 const env=environment();await put(env,'users/ordinary',{uid:'ordinary',role:'user',name:'Unchanged'});
 const result=await bootstrap(env),c=await env.DB.prepare('SELECT * FROM cf_credentials WHERE user_id=?').bind(result.uid).first();
 assert.ok(verifyPassword(password,c.password_hash));assert.match(c.password_hash,/^scrypt-v1\$32768\$8\$3\$/);
 const signed=await login(env);assert.equal(signed.status,200);assert.equal(signed.data.user.role,'superadmin');
 assert.equal((await request(env,'/api/records/users/ordinary',null,signed.data.token)).status,200);
 assert.equal((await request(env,'/api/query',{path:'users',limit:1},signed.data.token)).status,200);
 assert.equal((await env.DB.prepare('SELECT action FROM admin_audit_logs WHERE id=?').bind(result.auditId).first()).action,'superadmin_operator_bootstrap');
 assert.ok((await env.DB.prepare('SELECT used_at FROM cf_bootstrap').first()).used_at);
 await assert.rejects(bootstrap(env));assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM cf_credentials').first()).n,1);
});
test('existing Super Admin reset preserves every profile, organization association and prior audit; revokes sessions and invitations',async()=>{
 const env=environment(),result=await bootstrap(env);
 await put(env,'users/organization',{uid:'organization',role:'orgadmin'});
 await put(env,'organizations/organization',{organizationId:'organization',adminUid:'organization',organizationName:'Unchanged'});
 await env.DB.prepare('UPDATE users SET organization_id=? WHERE id=?').bind('organization',result.uid).run();
 const before=await snapshot(env.DB),orgBefore=JSON.stringify((await env.DB.prepare('SELECT * FROM organizations').all()).results);
 const old=await login(env),invite=await invitationStatement(env,result.uid,result.uid,'recover');await invite.statement.run();
 const plan=recoveryPlan(await inspectOwner(env.DB),'reset'),next='Another-synthetic-password-2026!';
 await applyOwnerRecovery(env.DB,identity,plan,next);
 assert.equal(await snapshot(env.DB),before);assert.equal(JSON.stringify((await env.DB.prepare('SELECT * FROM organizations').all()).results),orgBefore);
 assert.equal((await request(env,'/auth/me',null,old.data.token)).status,401);
 assert.equal((await login(env)).status,401);assert.equal((await login(env,next)).status,200);
 assert.equal((await request(env,'/auth/activate',{token:invite.token,password,sessionMode:'bearer'})).status,400);
 assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM admin_audit_logs').first()).n,2);
 assert.equal((await env.DB.prepare('SELECT credential_version FROM cf_credentials').first()).credential_version,2);
});
test('only the verified operator can bootstrap or reset; role loss and account safety never trigger silent elevation',async()=>{
 for(const bad of [{id:'attacker',email:OWNER.email},{id:OWNER.cloudflareId,email:'attacker@example.test'},null])assert.throws(()=>assertOperator(bad));
 const env=environment(),plan=recoveryPlan(await inspectOwner(env.DB),'bootstrap');
 await assert.rejects(applyOwnerRecovery(env.DB,{id:'attacker',email:OWNER.email},plan,password));
 assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM cf_credentials').first()).n,0);
 await bootstrap(env);
 for(const role of ['user','orgadmin','caregiver']){
  await env.DB.prepare('UPDATE users SET role=?').bind(role).run();
  assert.throws(()=>recoveryPlan({owner:[{id:'x',role,credential_user_id:'x'}],admins:[]},'reset'));
  await assert.rejects(applyOwnerRecovery(env.DB,identity,{operation:'reset',uid:plan.uid},password));
 }
 await env.DB.prepare("UPDATE users SET role='superadmin',is_suspended=1").run();
 assert.throws(()=>recoveryPlan({owner:[{id:'x',role:'superadmin',credential_user_id:'x',is_suspended:1}]},'reset'));
});
test('reviewed legacy exception preserves record; unknown, disabled and unactivated admins block bootstrap',async()=>{
 const env=environment();await legacy(env);const before=await snapshot(env.DB);
 const state=await inspectOwner(env.DB);assert.throws(()=>recoveryPlan(state,'bootstrap'));
 const plan=recoveryPlan(state,'bootstrap',true);await applyOwnerRecovery(env.DB,identity,plan,password);
 const record=(await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(LEGACY_ADMIN).all()).results;
 assert.equal(JSON.stringify(record),before);
 for(const disabled of [0,1]){
  const other=environment();await legacy(other);
  await other.DB.prepare('INSERT INTO cf_credentials(user_id,email,created_at,disabled) VALUES(?,?,?,?)').bind(LEGACY_ADMIN,'legacy@example.test',epoch(),disabled).run();
  assert.throws(()=>recoveryPlan({owner:[],admins:[{id:LEGACY_ADMIN,name:OWNER.name,credential_user_id:LEGACY_ADMIN}]},'bootstrap',true));
  await assert.rejects(applyOwnerRecovery(other.DB,identity,{operation:'bootstrap',uid:'new',legacyAcknowledged:true},password));
 }
 const other=environment();await put(other,'users/unknown',{uid:'unknown',role:'superadmin'});
 assert.throws(()=>recoveryPlan({owner:[],admins:[{id:'unknown'}]},'bootstrap',true));
});
test('concurrent owner creation, credential change, and audit failure roll back all account mutations',async()=>{
 const env=environment(),plan=recoveryPlan(await inspectOwner(env.DB),'bootstrap'),original=env.DB.batch;
 env.DB.batch=async statements=>{await put(env,'users/racer',{uid:'racer',email:OWNER.email,role:'user'});return original(statements);};
 await assert.rejects(applyOwnerRecovery(env.DB,identity,plan,password));
 assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM cf_credentials').first()).n,0);
 assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM admin_audit_logs').first()).n,0);
 const broken=environment();broken.DB.database.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON admin_audit_logs BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END;");
 await assert.rejects(bootstrap(broken));assert.equal((await broken.DB.prepare('SELECT COUNT(*) n FROM users').first()).n,0);
 const reset=environment();await bootstrap(reset);const resetPlan=recoveryPlan(await inspectOwner(reset.DB),'reset');
 await reset.DB.prepare('UPDATE cf_credentials SET credential_version=credential_version+1').run();
 await assert.rejects(applyOwnerRecovery(reset.DB,identity,resetPlan,'Another-synthetic-password!'));
 assert.equal((await login(reset)).status,200);
});
test('incorrect config, Cloudflare identity and live DB target fail before any D1 query',async()=>{
 const config=readFileSync(new URL('../../wrangler.production.toml',import.meta.url),'utf8'),env={CLOUDFLARE_ACCOUNT_ID:SEWAK_ACCOUNT};
 const bindings=[{name:'DB',id:targets['sewak-final'].DB[1]},{name:'MEDIA_DB',id:targets['sewak-final'].MEDIA_DB[1]},{name:'AUTH_AUDIENCE',text:'sewak-production'},{name:'APP_WRITES_ENABLED',text:'true'}];
 for(const kind of ['config','identity','binding','metadata','unauthorized']){
  let queried=false;
  const fetchImpl=async url=>{
   if(url.endsWith('/query'))queried=true;
   let result=url.endsWith('/user')?(kind==='identity'?{...identity,id:'wrong'}:identity):url.endsWith('/settings')?{bindings:kind==='binding'?bindings.map(b=>b.name==='DB'?{...b,id:'wrong'}:b):bindings}:{uuid:targets['sewak-final'].DB[1],name:kind==='metadata'?'wrong':'sewak-db'};
   return Response.json({success:kind!=='unauthorized',result},{status:kind==='unauthorized'?403:200});
  };
  await assert.rejects(verifiedOwnerTarget({fetchImpl,token:'synthetic',env,config:kind==='config'?config.replace('sewak-production','wrong'):config}));assert.equal(queried,false);
 }
});
test('Super Admin invitation reset is short-lived, single-use, rate-limited and audited; public signup cannot grant admin',async()=>{
 const env=environment(),admin=await bootstrap(env),signed=await login(env);
 const invitation=await request(env,'/api/actions/createAccountRecoveryInvitation',{targetUid:admin.uid},signed.data.token);
 assert.equal(invitation.status,200);
 const stored=await env.DB.prepare('SELECT expires_at FROM cf_invitations').first();assert.ok(stored.expires_at<=epoch()+900);
 const body={token:invitation.data.invitation.activationToken,password:'Recovered-synthetic-password!',sessionMode:'bearer'};
 assert.equal((await request(env,'/auth/activate',body)).status,200);
 assert.equal((await request(env,'/auth/me',null,signed.data.token)).status,401);
 assert.equal((await request(env,'/auth/activate',body)).status,400);
 assert.equal((await login(env,body.password)).data.user.role,'superadmin');
 assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM admin_audit_logs WHERE action='account_password_recovered'").first()).n,1);
 for(const role of ['superadmin','super_admin'])assert.equal((await request(env,'/auth/register',{email:'attacker@example.test',password,name:'Attacker',role,sessionMode:'bearer'})).status,400);
 for(let i=0;i<31;i++)await request(env,'/auth/activate',{token:opaque(),password,sessionMode:'bearer'});
 assert.equal((await request(env,'/auth/activate',{token:opaque(),password,sessionMode:'bearer'})).status,429);
});
test('private terminal hides input, handles cancellation and refuses non-interactive secrets',async()=>{
 const input=new EventEmitter();Object.assign(input,{isTTY:true,setRawMode(value){this.isRaw=value;},resume(){},pause(){}});
 let output='';const sink={isTTY:true,write(value){output+=value;}};
 const promise=privateInput('Password: ',{input,output:sink});input.emit('keypress','test-secret',{});input.emit('keypress','',{name:'return'});
 assert.equal(await promise,'test-secret');assert.equal(output,'Password: \n');assert.equal(input.isRaw,false);
 const cancelled=privateInput('Password: ',{input,output:sink});input.emit('keypress','',{ctrl:true,name:'c'});await assert.rejects(cancelled);assert.equal(input.isRaw,false);
 assert.throws(()=>privateInput('Password: ',{input:{isTTY:false},output:sink}));
});

test('verification uses the actual login and admin-only listing and cleans sessions even on failure',async()=>{
 const env=environment(),owner=await bootstrap(env);
 const fetchImpl=(url,init)=>worker.fetch(new Request(url,init),env);
 assert.equal((await verifyOwnerLogin(env.DB,owner.uid,password,fetchImpl,'https://sewak.test')).loginVerified,true);
 const failure=(url,init)=>url.endsWith('/api/query')?Promise.resolve(new Response(null,{status:403})):fetchImpl(url,init);
 await assert.rejects(verifyOwnerLogin(env.DB,owner.uid,password,failure,'https://sewak.test'));
 assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM cf_sessions').first()).n,0);
});

test('public bootstrap cannot bypass an existing legacy, disabled, or unactivated administrator',async()=>{
 for(const disabled of [null,0,1]){
  const env=environment();await legacy(env);
  if(disabled!==null)await env.DB.prepare('INSERT INTO cf_credentials(user_id,email,created_at,disabled) VALUES(?,?,?,?)').bind(LEGACY_ADMIN,'other@example.test',epoch(),disabled).run();
  const token=opaque();await env.DB.prepare('INSERT INTO cf_bootstrap(id,email,token_hash,expires_at) VALUES(1,?,?,?)').bind(OWNER.email,await digest(token),epoch()+300).run();
  assert.equal((await request(env,'/auth/bootstrap',{email:OWNER.email,name:OWNER.name,password,bootstrapToken:token,sessionMode:'bearer'})).status,409);
  assert.equal((await inspectOwner(env.DB)).owner.length,0);
  assert.equal((await env.DB.prepare('SELECT used_at FROM cf_bootstrap').first()).used_at,null);
 }
});
