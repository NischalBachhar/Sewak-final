'use strict';
// Pure planner for a reviewed local export: { "collection/id": { ...fields } }.
// Never changes booking snapshots, ownership, roles, claims or safety flags.
function planMigration(records) {
  const changes = new Map(), blocked = [];
  const put = (path, after) => changes.set(path, { path, before: records[path] ?? null, after });
  const current = path => changes.get(path)?.after || records[path];
  for (const [path, record] of Object.entries(records)) {
    if (/^(services|vendors|publicCaregivers|publicServices)\//.test(path) && record.category === 'household') put(path, { ...record, category: 'vendor' });
  }
  const services = Object.entries(records).filter(([path]) => path.startsWith('services/'));
  for (const [path, vendor] of Object.entries(records).filter(([path]) => path.startsWith('vendors/'))) {
    const mapped = [];
    for (const value of vendor.servicesOffered || []) {
      const exact = records[`services/${value}`];
      if (exact && ((exact.organizationId && exact.organizationId !== vendor.organizationId) ||
          (exact.category === 'household' ? 'vendor' : exact.category) !== (vendor.category === 'household' ? 'vendor' : vendor.category))) {
        blocked.push({ path, field: 'servicesOffered', reason: 'Existing service ID has a different owner or category; require an explicit reviewed correction.' }); mapped.push(value); continue;
      }
      const matches = exact ? [[`services/${value}`, exact]] : services.filter(([, service]) =>
        [service.label, service.serviceName].some(label => typeof label === 'string' && label.trim().toLowerCase() === String(value).trim().toLowerCase()) &&
        (!service.organizationId || service.organizationId === vendor.organizationId) &&
        (service.category === 'household' ? 'vendor' : service.category) === (vendor.category === 'household' ? 'vendor' : vendor.category));
      if (matches.length !== 1) { blocked.push({ path, field: 'servicesOffered', reason: 'Service reference is missing or ambiguous; supply an explicit reviewed mapping.' }); mapped.push(value); }
      else mapped.push(matches[0][0].slice('services/'.length));
    }
    if (JSON.stringify(mapped) !== JSON.stringify(vendor.servicesOffered || [])) put(path, { ...current(path), servicesOffered: [...new Set(mapped)] });
  }
  // Preserve every original report ID so existing moderation updates its receipt.
  // A separate immutable booking lock prevents a new report after legacy backfill.
  const reports = Object.entries(records).filter(([path]) => /^(blacklistReports|caregiverReports)\//.test(path)).sort(([a], [b]) => a.localeCompare(b));
  for (const [path, report] of reports) {
    const id = path.split('/')[1], booking = records[`bookings/${report.bookingId}`];
    const reporter = report.reportedBy || report.caregiverId;
    if (!booking || !reporter || reporter !== booking.caregiverId || !['pending', 'approved', 'rejected'].includes(report.status) || typeof report.reason !== 'string' || !report.createdAt) {
      blocked.push({ path, reason: 'Cannot verify booking, reporter, status, reason or timestamp; keep private until reviewed.' }); continue;
    }
    const target = `blacklistReports/${id}`;
    if (path !== target && records[target] && records[target].legacySourcePath !== path && JSON.stringify(records[target]) !== JSON.stringify(report)) {
      blocked.push({ path, reason: 'Canonical report ID collision; review manually.' }); continue;
    }
    if (!current(target)) put(target, { ...report, reportedBy: reporter, userId: booking.userId, userType: 'user', legacySourcePath: path });
    const receiptPath = `reportReceipts/${id}`;
    const receipt = { bookingId: report.bookingId, reportedBy: reporter, reason: report.reason, status: report.status, createdAt: report.createdAt };
    if (!current(receiptPath)) put(receiptPath, receipt);
    else if (current(receiptPath).reportedBy !== reporter) { blocked.push({ path: receiptPath, reason: 'Existing receipt identity differs; do not overwrite.' }); continue; }
    const lockPath = `reportLocks/${report.bookingId}`;
    if (!current(lockPath)) put(lockPath, { reportId: id, reportedBy: reporter });
  }
  return { version: 1, changes: [...changes.values()], blocked };
}
module.exports = { planMigration };
