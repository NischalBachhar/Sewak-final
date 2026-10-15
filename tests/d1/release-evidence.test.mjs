import test from 'node:test';
import assert from 'node:assert/strict';
import {assertReleaseEvidence} from '../../scripts/release-evidence.mjs';

const now = Date.parse('2026-10-11T08:00:00.000Z');
function reports(writesEnabled = true) {
  return {
    validation: {
      pass: true, backend: 'cloudflare-d1', worker: 'sewak-final', version: 'v-123',
      checkedAt: new Date(now - 10 * 60_000).toISOString(),
      health: {healthy: true, auth: 'cloudflare-d1', writesEnabled},
      checks: {DB: {integrity: 'ok', foreignKeyViolations: 0}, MEDIA_DB: {integrity: 'ok', foreignKeyViolations: 0}, EVIDENCE_DB: {integrity: 'ok', foreignKeyViolations: 0}},
    },
    qa: {
      pass: true, auth: 'cloudflare-d1', worker: 'sewak-final', version: 'v-123',
      qaMode: writesEnabled ? 'production-write-enabled' : 'maintenance-read-only',
      writesEnabled, checksPassed: true, cleanupVerified: true, applicationRecordsUnchanged: true,
      completedAt: new Date(now - 5 * 60_000).toISOString(),
    },
    writesEnabled, now,
  };
}
test('accepts fresh matching production evidence', () => {
  assert.doesNotThrow(() => assertReleaseEvidence(reports()));
  assert.doesNotThrow(() => assertReleaseEvidence(reports(false)));
});
for (const [label, modify] of [
  ['a stale D1 report', r => {r.validation.checkedAt = new Date(now - 61 * 60_000).toISOString();}],
  ['a future-dated D1 report', r => {r.validation.checkedAt = new Date(now + 5 * 60_000).toISOString();}],
  ['a stale Auth report', r => {r.qa.completedAt = new Date(now - 61 * 60_000).toISOString();}],
  ['an invalid Auth timestamp', r => {r.qa.completedAt = 'not-a-time';}],
  ['a failed Auth report', r => {r.qa.pass = false;}],
  ['an Auth report from an old Worker version', r => {r.qa.version = 'old-worker';}],
  ['a read-only Auth report for writes-enabled production', r => {r.qa.qaMode = 'maintenance-read-only';}],
  ['a mismatched Auth writes mode', r => {r.qa.writesEnabled = false;}],
  ['unverified cleanup', r => {r.qa.cleanupVerified = false;}],
  ['unexpected changes to application data', r => {r.qa.applicationRecordsUnchanged = false;}],
  ['incomplete Auth checks', r => {r.qa.checksPassed = false;}],
  ['a failed Auth cleanup', r => {r.qa.cleanupFailure = {message: 'failure'};}],
  ['failed D1 integrity', r => {r.validation.checks.DB.integrity = 'failed';}],
  ['D1 foreign-key violations', r => {r.validation.checks.MEDIA_DB.foreignKeyViolations = 1;}],
  ['missing evidence database validation', r => {delete r.validation.checks.EVIDENCE_DB;}],
  ['evidence database corruption', r => {r.validation.checks.EVIDENCE_DB.integrity = 'failed';}],
  ['a mismatched D1 write mode', r => {r.validation.health.writesEnabled = false;}],
  ['a wrong Auth worker', r => {r.qa.worker = 'sewak';}],
  ['a missing Auth report', r => {r.qa = undefined;}],
]) {
  test('rejects ' + label, () => {
    const r = reports(); modify(r);
    assert.throws(() => assertReleaseEvidence(r));
  });
}
