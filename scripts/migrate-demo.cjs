'use strict';
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { planMigration } = require('./migration-plan.cjs');
async function main() {
  const [mode = '--dry-run', file, journal = '.local-tools/migration-journal.json'] = process.argv.slice(2);
  if (!['--dry-run', '--apply-demo', '--rollback-demo'].includes(mode) || !file) throw new Error('Usage: node scripts/migrate-demo.cjs --dry-run export.json | --apply-demo export.json [journal.json] | --rollback-demo journal.json');
  const input = JSON.parse(fs.readFileSync(file, 'utf8'));
  const plan = mode === '--rollback-demo' ? input : planMigration(input);
  if (mode === '--dry-run') { process.stdout.write(JSON.stringify(plan, null, 2) + '\n'); return; }
  if (process.env.GCLOUD_PROJECT !== 'demo-sewak-test' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw new Error('Apply/rollback are restricted to the isolated demo emulator. Production execution is deliberately unsupported.');
  if (mode === '--apply-demo' && plan.blocked.length) throw new Error('Resolve all blocked mappings in the reviewed export before applying.');
  const req = createRequire(resolve('functions/package.json'));
  const { initializeApp } = req('firebase-admin/app');
  const { getFirestore, Timestamp } = req('firebase-admin/firestore');
  initializeApp({ projectId: 'demo-sewak-test' }); const db = getFirestore();
  const encode = value => value instanceof Timestamp ? { __timestamp: value.toDate().toISOString() } : Array.isArray(value) ? value.map(encode) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)])) : value;
  const decode = value => value?.__timestamp ? Timestamp.fromDate(new Date(value.__timestamp)) : Array.isArray(value) ? value.map(decode) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)])) : value;
  // Small transaction for each change: conflicts stop execution; journal written
  // BEFORE mutation so an interrupted run remains recoverable and retryable.
  if (mode === '--apply-demo') fs.writeFileSync(journal, JSON.stringify(plan, null, 2), { flag: 'wx' });
  for (const change of mode === '--rollback-demo' ? [...plan.changes].reverse() : plan.changes) {
    if (!/^(services|vendors|publicCaregivers|publicServices|blacklistReports|reportReceipts|reportLocks)\/[^/]+$/.test(change.path)) throw new Error('Unexpected migration path.');
    const before = mode === '--rollback-demo' ? change.after : change.before;
    const after = mode === '--rollback-demo' ? change.before : change.after;
    await db.runTransaction(async tx => {
      const ref = db.doc(change.path), snap = await tx.get(ref), actual = snap.exists ? encode(snap.data()) : null;
      if (isDeepStrictEqual(actual, after)) return;
      if (!isDeepStrictEqual(actual, before)) throw new Error(`Concurrent change at ${change.path}; stopped without overwriting it.`);
      if (after === null) tx.delete(ref); else tx.set(ref, decode(after));
    });
  }
  process.stdout.write(`${mode}: ${plan.changes.length} reviewed changes processed.\n`);
}
main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
