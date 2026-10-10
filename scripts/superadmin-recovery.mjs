import assert from 'node:assert/strict';
import {verifiedOwnerTarget} from './superadmin-operator.mjs';
import {OWNER,LEGACY_ADMIN,inspectOwner,recoveryPlan,applyOwnerRecovery} from './superadmin-recovery-core.mjs';
import {verifyOwnerLogin} from './superadmin-login-verification.mjs';
import {privateInput} from './private-terminal.mjs';
import {SEWAK_ACCOUNT,targets} from './deployment-policy.mjs';

const args=process.argv.slice(2),operation=args[0]||'inspect';
let phase='argument validation',committed=false;
try {
  assert.ok(['inspect','bootstrap','reset'].includes(operation),'Use inspect, bootstrap, or reset.');
  assert.ok(args.slice(1).every(a=>a==='--apply'||a==='--acknowledge-legacy-admin'),'Unknown argument.');
  const apply=args.includes('--apply'),legacy=args.includes('--acknowledge-legacy-admin');
  assert.ok(operation!=='inspect'||!apply,'Inspect is read-only.');
  if(apply)assert.ok(process.stdin.isTTY&&process.stdout.isTTY,'Interactive terminal required.');
  assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,SEWAK_ACCOUNT,'Select the documented Sewak account.');
  phase='Cloudflare identity and production binding verification';
  const {DB,identity,verifyBindings}=await verifiedOwnerTarget();
  phase='read-only account inspection';
  const state=await inspectOwner(DB);
  console.log(JSON.stringify({operator:identity.email,worker:'sewak-final',database:targets['sewak-final'].DB,...state},null,2));
  if(operation!=='inspect') {
    phase='recovery eligibility (see runbook for blocked states)';
    const plan=recoveryPlan(state,operation,legacy);
    console.log(`Proposed ${operation}: ${OWNER.name}, ${OWNER.email}, internal role superadmin. Other profiles and associations are preserved.`);
    if(!apply)console.log('Read-only plan. Add --apply only after approving this production change.');
    else {
      phase='private terminal confirmation';
      if(plan.legacyAcknowledged)assert.equal(await privateInput(`Legacy profile ${LEGACY_ADMIN} has no Cloudflare credentials.\nType PRESERVE ${LEGACY_ADMIN} to approve the reviewed migration exception (hidden): `),'PRESERVE '+LEGACY_ADMIN);
      const confirmation=`${operation.toUpperCase()} ${OWNER.email} ${targets['sewak-final'].DB[1]}`;
      assert.equal(await privateInput(`Production write approval. Type exactly:\n${confirmation}\nConfirmation (hidden): `),confirmation);
      let password=await privateInput('New password (12–128 characters; hidden): ');
      let confirmationPassword=await privateInput('Confirm new password (hidden): ');
      // Never pass password values into assertion diagnostics.
      if(password!==confirmationPassword)throw new Error('Passwords do not match.');
      confirmationPassword='';
      phase='final binding check';await verifyBindings();
      phase='atomic production account operation';
      const result=await applyOwnerRecovery(DB,identity,plan,password);committed=true;
      console.log(JSON.stringify({accountOperation:'committed',...result}));
      phase='application login and authorization verification';
      const verification=await verifyOwnerLogin(DB,result.uid,password);password='';
      console.log(JSON.stringify(verification));
      console.log('Verification session signed out. Sign in privately at https://sewak-final.nischalbachhar9.workers.dev/auth');
    }
  }
} catch {
  // Network/SQL/assertion objects may contain request material. Never print them.
  console.error(`Stopped during ${phase}. ${committed?'Account write committed; inspect before retrying.':'If a write was attempted, inspect its state before retrying.'} No secrets were printed. See docs/SUPERADMIN_RECOVERY.md.`);
  process.exitCode=1;
}
