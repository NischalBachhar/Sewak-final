import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,seed,call,put,booking} from './harness.mjs';

test('account and audit pagination is admin-only and excludes private extension fields',async()=>{
 const env=environment();await seed(env);
 for(let i=0;i<28;i++)await put(env,'users/account_'+String(i).padStart(2,'0'),{role:'user',name:'Synthetic '+i,recoveryToken:'PRIVATE_TEST_TOKEN'});
 for(const uid of [undefined,'customer','caregiver','org'])assert.equal((await call(env,'/api/admin/accounts',{uid})).status,uid?403:401);
 const first=await call(env,'/api/admin/accounts',{uid:'admin'});assert.equal(first.status,200);assert.equal(first.data.items.length,25);
 const next=await call(env,'/api/admin/accounts?cursor='+first.data.nextCursor,{uid:'admin'});
 assert.ok(next.data.items.length>0);assert.ok(!next.data.items.some(i=>first.data.items.some(j=>j.id===i.id)));
 assert.ok(!JSON.stringify(first.data).includes('PRIVATE_TEST_TOKEN'));
 for(let i=0;i<28;i++)await put(env,'adminAuditLogs/audit_'+String(i).padStart(2,'0'),{action:'synthetic_test',actorUid:'admin',targetUid:'customer',createdAt:'2026-10-19T00:00:00.000Z',activationToken:'PRIVATE_AUDIT_TOKEN'});
 const log=await call(env,'/api/admin/audit',{uid:'admin'});assert.equal(log.data.items.length,25);
 const rest=await call(env,'/api/admin/audit?cursor='+encodeURIComponent(log.data.nextCursor),{uid:'admin'});assert.equal(rest.data.items.length,3);
 assert.ok(!JSON.stringify(log.data).includes('PRIVATE_AUDIT_TOKEN'));
 assert.equal((await call(env,'/api/admin/audit',{uid:'org'})).status,403);
 assert.equal((await call(env,'/api/admin/audit?cursor=invalid',{uid:'admin'})).status,400);
 await env.DB.prepare('UPDATE users SET is_suspended=1 WHERE id=?').bind('admin').run();
 assert.equal((await call(env,'/api/admin/audit',{uid:'admin'})).status,403);
});

test('account deletion requires restriction and exact confirmation, revokes access and preserves booking history',async()=>{
 const env=environment();await seed(env);
 assert.equal((await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[booking()]}})).status,200);
 const before=await env.DB.prepare('SELECT * FROM bookings').all();
 await env.DB.prepare('INSERT INTO cf_credentials(user_id,email,created_at) VALUES(?,?,?)').bind('customer','customer@example.test',1).run();
 await env.DB.prepare("INSERT INTO cf_sessions(id,token_hash,user_id,audience,transport,credential_version,created_at,last_seen_at,expires_at) VALUES('session','synthetic','customer','test','bearer',1,1,1,9999999999)").run();
 const remove=(uid,confirmation='Test Customer')=>call(env,'/api/actions/deleteCareAccount',{uid,method:'POST',json:{targetUid:'customer',confirmation}});
 assert.equal((await remove('customer')).status,403);
 assert.equal((await remove('admin')).status,409);
 assert.equal((await call(env,'/api/actions/applyAccountSafetyAction',{uid:'admin',method:'POST',json:{targetType:'customer',targetId:'customer',reason:'Synthetic safety review'}})).status,200);
 assert.equal((await remove('admin','wrong')).status,400);
 assert.equal((await remove('admin')).status,200);
 assert.equal((await env.DB.prepare('SELECT disabled FROM cf_credentials WHERE user_id=?').bind('customer').first()).disabled,1);
 assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM cf_sessions WHERE user_id=?').bind('customer').first()).n,0);
 assert.ok((await env.DB.prepare("SELECT json_extract(extra_json,'$.deletedAt') stamp FROM users WHERE id='customer'").first()).stamp);
 assert.deepEqual(await env.DB.prepare('SELECT * FROM bookings').all(),before);
 assert.equal((await call(env,'/api/care-notifications',{uid:'customer'})).status,403);
 assert.ok((await call(env,'/api/admin/audit',{uid:'admin'})).data.items.some(i=>i.action==='care_account_deleted'));
 assert.equal((await remove('admin')).status,409);
 assert.deepEqual((await env.DB.prepare('PRAGMA foreign_key_check').all()).results,[]);
});

test('caregiver approval updates both records, an audit and a private notification in one transaction',async()=>{
 const env=environment();await seed(env);
 await env.DB.prepare('UPDATE caregivers SET is_approved=0 WHERE id=?').bind('caregiver').run();
 await env.DB.prepare('UPDATE users SET is_approved=0 WHERE id=?').bind('caregiver').run();
 const approve=uid=>call(env,'/api/actions/approveCaregiverAccount',{uid,method:'POST',json:{caregiverId:'caregiver'}});
 assert.equal((await approve('org')).status,403);
 assert.equal((await approve('admin')).status,200);
 assert.equal((await env.DB.prepare('SELECT is_approved n FROM caregivers WHERE id=?').bind('caregiver').first()).n,1);
 assert.equal((await env.DB.prepare('SELECT is_approved n FROM users WHERE id=?').bind('caregiver').first()).n,1);
 assert.ok((await call(env,'/api/admin/audit',{uid:'admin'})).data.items.some(i=>i.action==='caregiver_approved'));
 assert.ok((await call(env,'/api/care-notifications',{uid:'caregiver'})).data.items.some(i=>i.eventType==='caregiver-approved'));
 assert.equal((await approve('admin')).status,409);
});

test('restricted recipients cannot receive new private messages or phantom notifications',async()=>{
 const env=environment();await seed(env);
 const entry=booking();assert.equal((await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[entry]}})).status,200);
 await env.DB.prepare('UPDATE users SET is_suspended=1,version=version+1 WHERE id=?').bind('caregiver').run();
 const before=(await env.DB.prepare('SELECT COUNT(*) n FROM care_notifications').first()).n;
 const result=await call(env,'/api/care-messages',{uid:'customer',method:'POST',json:{kind:'booking',contextId:entry.path.split('/')[1],body:'Synthetic blocked message'}});
 assert.equal(result.status,409);assert.equal(result.data.error.code,'recipient-unavailable');
 assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM care_messages').first()).n,0);
 assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM care_notifications').first()).n,before);
});
