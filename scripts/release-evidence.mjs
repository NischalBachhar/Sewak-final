// Production releases must use fresh, matching D1 and synthetic Auth QA evidence.
// This is deliberately dependency-free so it can be tested without Cloudflare credentials.
const maxAgeMs = 60 * 60 * 1000;
const requireEvidence = (condition, message) => {
  if (!condition) throw new Error(message);
};

function checkTimestamp(value, label, now) {
  const timestamp = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  requireEvidence(Number.isFinite(timestamp) && timestamp <= now + 60_000 && now - timestamp < maxAgeMs,
    label + ' must be a recent timestamp (less than 60 minutes old).');
}

export function assertReleaseEvidence({validation, qa, writesEnabled, now = Date.now()}) {
  requireEvidence(validation?.pass === true &&
    validation.backend === 'cloudflare-d1' &&
    validation.worker === 'sewak-final' &&
    typeof validation.version === 'string' && validation.version.length > 0,
    'Supply a passing production Cloudflare D1 report with a Worker version.');
  checkTimestamp(validation.checkedAt, 'D1 verification', now);
  requireEvidence(validation.health?.healthy === true &&
    validation.health.auth === 'cloudflare-d1' &&
    validation.health.writesEnabled === writesEnabled,
    'Production health/auth or writes mode differs from the release configuration.');
  for (const database of ['DB', 'MEDIA_DB', 'EVIDENCE_DB']) {
    requireEvidence(validation.checks?.[database]?.integrity === 'ok' &&
      validation.checks[database].foreignKeyViolations === 0,
      database + ' integrity must pass with zero foreign-key violations.');
  }
  const expectedMode = writesEnabled ? 'production-write-enabled' : 'maintenance-read-only';
  requireEvidence(qa?.pass === true &&
    qa.auth === 'cloudflare-d1' &&
    qa.worker === 'sewak-final' &&
    qa.qaMode === expectedMode &&
    qa.writesEnabled === writesEnabled &&
    qa.version === validation.version &&
    qa.checksPassed === true &&
    qa.cleanupVerified === true &&
    qa.applicationRecordsUnchanged === true &&
    !qa.failure && !qa.cleanupFailure,
    'Production Auth QA must pass with matching Worker version, mode, and verified synthetic cleanup.');
  checkTimestamp(qa.completedAt, 'Production Auth QA', now);
}
