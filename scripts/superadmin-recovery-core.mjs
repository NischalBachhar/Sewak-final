// Operator-only code. Never expose these functions through a Worker route.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Repository} from '../worker/src/repository.ts';
import {newAccountProfile, epoch, digest, opaque} from '../worker/src/cloudflare-auth.ts';
import {hashPassword, verifyPassword} from '../worker/src/passwords.ts';

export const OWNER = Object.freeze({email:'nischalbachhar9@gmail.com', name:'Nischal Bachhar', cloudflareId:'07814ac610a382656508564ca444a1ec'});
export const LEGACY_ADMIN = 'hXaBhjmVrzVd4BXpwGUlwa8OtTz2';
export function assertOperator(identity) {
  assert.equal(identity?.id, OWNER.cloudflareId, 'Unauthorized Cloudflare operator.');
  assert.equal(identity?.email?.toLowerCase(), OWNER.email, 'Unauthorized Cloudflare operator.');
}
export async function inspectOwner(DB) {
  const owner = (await DB.prepare(`SELECT u.id,u.name,u.email,u.role,u.version,u.organization_id,
    u.is_suspended,u.is_blacklisted,c.user_id AS credential_user_id,c.disabled,c.credential_version,
    c.password_hash IS NOT NULL AS has_password FROM users u LEFT JOIN cf_credentials c ON c.user_id=u.id
    WHERE lower(u.email)=? OR lower(c.email)=?`).bind(OWNER.email,OWNER.email).all()).results;
  const admins = (await DB.prepare(`SELECT u.id,u.name,u.role,u.email,c.user_id AS credential_user_id
    FROM users u LEFT JOIN cf_credentials c ON c.user_id=u.id WHERE u.role='superadmin'`).all()).results;
  const bootstrap = await DB.prepare('SELECT email,expires_at,used_at FROM cf_bootstrap WHERE id=1').first();
  return {owner,admins,bootstrap};
}
export function recoveryPlan(state, operation, legacyAcknowledged=false) {
  assert.ok(['bootstrap','reset'].includes(operation), 'Choose bootstrap or reset.');
  assert.ok(state.owner.length<=1,'Ambiguous owner records require investigation.');
  const owner=state.owner[0];
  if(operation==='reset') {
    assert.ok(owner?.credential_user_id,'No Cloudflare owner credentials exist. Use inspected bootstrap procedure.');
    assert.equal(owner.role,'superadmin','Role recovery requires a separate administrator review; automatic elevation is forbidden.');
    assert.ok(!owner.disabled&&!owner.is_suspended&&!owner.is_blacklisted,'Inactive account requires a separate safety review.');
    return {operation,uid:owner.id,version:owner.credential_version,legacyAcknowledged:false};
  }
  assert.ok(!owner,'Owner already exists. Do not create a duplicate or adopt legacy records.');
  assert.ok(!state.bootstrap?.used_at,'Bootstrap has already been consumed; investigate instead of rearming it.');
  assert.ok(!state.bootstrap||state.bootstrap.email===OWNER.email,'Unexpected bootstrap reservation.');
  // Even disabled or unactivated credential-bearing administrators block bootstrap.
  // Only this individually reviewed, non-authenticating migration record is exempt.
  assert.ok(state.admins.every(a=>a.id===LEGACY_ADMIN&&!a.credential_user_id&&a.name===OWNER.name&&!a.email),
    'Another Super Admin exists. Use a recently authenticated administrator; bootstrap is forbidden.');
  assert.ok(!state.admins.length||legacyAcknowledged,'The reviewed legacy administrator requires explicit emergency acknowledgement.');
  return {operation,uid:'usr_'+randomUUID(),legacyAcknowledged:state.admins.length>0};
}
export async function applyOwnerRecovery(DB, identity, plan, password) {
  assertOperator(identity);
  assert.ok(typeof password==='string'&&password.length>=12&&password.length<=128,'Use 12–128 characters.');
  // Re-read after private input. SQL guards below also protect concurrent changes.
  const current=recoveryPlan(await inspectOwner(DB),plan.operation,plan.legacyAcknowledged);
  if(plan.operation==='reset')assert.equal(current.uid,plan.uid,'Owner changed; inspect again.');
  const repo=new Repository({DB}), now=epoch(), guard='owner-recovery:'+randomUUID();
  const hash=hashPassword(password);
  assert.ok(verifyPassword(password,hash),'Password hashing compatibility failed.');
  const audit={path:'adminAuditLogs/'+randomUUID(),data:{actorUid:'cloudflare:'+identity.id,
    action:plan.operation==='bootstrap'?'superadmin_operator_bootstrap':'superadmin_operator_password_reset',
    targetUid:plan.uid,targetRole:'superadmin',status:'complete',createdAt:new Date().toISOString(),
    operatorEmail:identity.email,identityVerification:'Cloudflare /user ID and email; pinned production binding',
    ...(plan.legacyAcknowledged?{legacyRecordPreserved:LEGACY_ADMIN}:{} )}};
  const statements=[],writes=[audit];
  if(plan.operation==='bootstrap') {
    assert.match(plan.uid,/^usr_[0-9a-f-]{36}$/,'Unexpected new account ID.');
    assert.equal((await repo.get('users/'+plan.uid)).version,0,'Never overwrite an existing profile.');
    writes.push({path:'users/'+plan.uid,data:newAccountProfile(plan.uid,OWNER.email,OWNER.name,'superadmin')});
    statements.push(DB.prepare(`INSERT INTO commit_guards(id,valid) VALUES(?,
      NOT EXISTS(SELECT 1 FROM cf_credentials WHERE email=?) AND
      NOT EXISTS(SELECT 1 FROM users WHERE id<>? AND lower(email)=?) AND
      NOT EXISTS(SELECT 1 FROM users u LEFT JOIN cf_credentials c ON c.user_id=u.id
        WHERE u.role='superadmin' AND u.id<>? AND NOT COALESCE((u.id=? AND c.user_id IS NULL AND u.name=? AND u.email IS NULL),0)) AND
      NOT EXISTS(SELECT 1 FROM cf_bootstrap WHERE used_at IS NOT NULL OR email<>?))`)
      .bind(guard,OWNER.email,plan.uid,OWNER.email,plan.uid,plan.legacyAcknowledged?LEGACY_ADMIN:'',OWNER.name,OWNER.email));
    statements.push(DB.prepare('INSERT INTO cf_credentials(user_id,email,password_hash,created_at) VALUES(?,?,?,?)').bind(plan.uid,OWNER.email,hash,now));
    // Consume the existing reservation and invalidate every old setup link forever.
    statements.push(DB.prepare(`INSERT INTO cf_bootstrap(id,email,token_hash,expires_at,used_at) VALUES(1,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,used_at=excluded.used_at`)
      .bind(OWNER.email,await digest(opaque()),now,now));
  } else {
    const profile=await repo.data('users/'+plan.uid);
    assert.ok(profile?.role==='superadmin'&&!profile.isSuspended&&!profile.isBlacklisted,'Owner state changed.');
    statements.push(DB.prepare(`INSERT INTO commit_guards(id,valid) VALUES(?,EXISTS(
      SELECT 1 FROM cf_credentials WHERE user_id=? AND email=? AND credential_version=? AND disabled=0))`)
      .bind(guard,plan.uid,OWNER.email,plan.version));
    statements.push(DB.prepare('UPDATE cf_credentials SET password_hash=?,credential_version=credential_version+1,password_changed_at=? WHERE user_id=?').bind(hash,now,plan.uid));
    statements.push(DB.prepare('UPDATE cf_invitations SET used_at=? WHERE user_id=? AND used_at IS NULL').bind(now,plan.uid));
    statements.push(DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind(plan.uid));
  }
  statements.push(DB.prepare('DELETE FROM commit_guards WHERE id=?').bind(guard));
  await repo.commit(writes,statements);
  const after=await inspectOwner(DB), saved=after.owner[0];
  assert.ok(after.owner.length===1&&saved.id===plan.uid&&saved.role==='superadmin'&&saved.has_password&&!saved.disabled,'Post-write verification failed; inspect before retrying.');
  assert.equal((await DB.prepare('SELECT COUNT(*) n FROM cf_sessions WHERE user_id=?').bind(plan.uid).first()).n,0);
  assert.ok(await DB.prepare('SELECT id FROM admin_audit_logs WHERE id=? AND target_uid=?').bind(audit.path.split('/')[1],plan.uid).first(),'Audit verification failed.');
  return {uid:plan.uid,role:saved.role,active:true,auditId:audit.path.split('/')[1],sessionsRevoked:true};
}
