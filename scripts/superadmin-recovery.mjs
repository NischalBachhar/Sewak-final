import assert from 'node:assert/strict';
import {verifiedOwnerTarget} from './superadmin-operator.mjs';
import {OWNER,LEGACY_ADMIN,inspectOwner,recoveryPlan,applyOwnerRecovery} from './superadmin-recovery-core.mjs';
import {verifyOwnerLogin} from './superadmin-login-verification.mjs';
import {confirmPhrase,privateInput,TerminalInputError} from './private-terminal.mjs';
import {SEWAK_ACCOUNT,targets} from './deployment-policy.mjs';

const args=process.argv.slice(2),operation=args[0]||'inspect';
let phase='argument validation',committed=false,writeAttempted=false;
try {
  assert.ok(['inspect','bootstrap','reset'].includes(operation),'Use inspect, bootstrap, or reset.');
  assert.ok(args.slice(1).every(a=>a==='--apply'||a==='--acknowledge-legacy-admin'),'Unknown argument.');
  const apply=args.includes('--apply'),legacy=args.includes('--acknowledge-legacy-admin');
  assert.ok(operation!=='inspect'||!apply,'Inspect is read-only.');
  if(apply&&(!process.stdin.isTTY||!process.stdout.isTTY))throw new TerminalInputError('terminal');
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
      phase='visible terminal confirmation';
      if(plan.legacyAcknowledged)await confirmPhrase('PRESERVE '+LEGACY_ADMIN,
        'Step 1: Preserve the legacy Super Admin profile. It has no Cloudflare credentials.');
      const confirmation=`${operation.toUpperCase()} ${OWNER.email} ${targets['sewak-final'].DB[1]}`;
      await confirmPhrase(confirmation,
        `${plan.legacyAcknowledged?'Step 2':'Step 1'}: Approve the production ${operation} for the account and database shown above. No write occurs until both password prompts finish and all security checks pass.`);
      phase='hidden password entry';
      console.log('Now enter your password twice in this terminal. Characters and asterisks will NOT appear. Press Enter after each entry. Never paste your password into an approval prompt or chat.');
      let password=await privateInput('New password (12–128 characters; hidden): ');
      let confirmationPassword=await privateInput('Confirm new password (hidden): ');
      // Never pass password values into assertion diagnostics.
      if(password!==confirmationPassword||password.length<12||password.length>128)throw new TerminalInputError('password');
      confirmationPassword='';
      phase='final binding check';await verifyBindings();
      phase='atomic production account operation';
      writeAttempted=true;
      const result=await applyOwnerRecovery(DB,identity,plan,password);committed=true;
      console.log(JSON.stringify({accountOperation:'committed',...result}));
      phase='application login and authorization verification';
      const verification=await verifyOwnerLogin(DB,result.uid,password);password='';
      console.log(JSON.stringify(verification));
      console.log('Verification session signed out. Sign in privately at https://sewak-final.nischalbachhar9.workers.dev/auth');
    }
  }
} catch(error) {
  // Network/SQL/assertion objects may contain request material. Never print them.
  if(error instanceof TerminalInputError)console.error(error.message);
  console.error(`Stopped during ${phase}. ${committed?'Account write committed; inspect before retrying.':writeAttempted?'A write was attempted; inspect its state before retrying.':'No production account write was attempted.'} See docs/SUPERADMIN_RECOVERY.md.`);
  process.exitCode=1;
}
