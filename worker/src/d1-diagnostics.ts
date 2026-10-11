// Static-stage operational diagnosis. NEVER log D1 SQL, parameter values,
// exception messages, account IDs, email addresses, tokens, or request bodies.
// This does not change authorization or replace the original exception.
const allowedStages = new Set([
  "auth.session.lookup",
  "auth.session.profile",
  "auth.session.refresh",
  "auth.rate.ip-upsert",
  "auth.rate.email-upsert",
  "auth.rate.cleanup",
  "auth.login.credentials",
  "auth.login.hasher",
  "auth.login.profile",
  "auth.login.session-commit",
  "auth.register.hasher",
  "auth.register.commit",
  "public.caregivers.count",
  "public.caregivers.page",
  "public.services.page",
  "query.records.page"
]);
export function safeD1Category(error: unknown): string {
  // Only classify raw error text; it is NEVER emitted.
  const value = error instanceof Error ? error.message : String(error);
  if (/SQLITE_FULL|quota|daily.limit|row.limit|storage.limit|overload|resource.exhausted/i.test(value)) return 'resource-limit';
  if (/no such (table|column)|SQLITE_ERROR|syntax error|mismatched|wrong number of|no column named/i.test(value)) return 'sql-schema';
  if (/constraint|FOREIGN KEY|UNIQUE|SQLITE_CONSTRAINT/i.test(value)) return 'constraint';
  if (/SQLITE_BUSY|SQLITE_LOCKED|database is locked|timed out/i.test(value)) return 'db-contention';
  if (/7403|unauthorized|not authorized|forbidden/i.test(value)) return 'access-denied';
  if (/D1_ERROR|D1Database|D1_EXEC_ERROR/i.test(value)) return 'd1-other';
  return 'unclassified';
}
export async function traceD1<T>(stage: string, work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    // Untrusted stage labels are discarded, not printed or sent to the client.
    console.error('Sewak DB operation failed', {
      stage: allowedStages.has(stage) ? stage : 'unknown-stage',
      category: safeD1Category(error),
    });
    throw error;
  }
}
