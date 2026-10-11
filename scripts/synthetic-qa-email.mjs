// Controlled production-only Gmail aliases for synthetic auth QA.
// The base Gmail address is supplied by the operator at runtime, never stored in Git.
export function controlledQaGmail(value) {
  const input = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const match = /^([a-z0-9](?:[a-z0-9.]{4,28}[a-z0-9]))@gmail\.com$/.exec(input);
  if (!match || match[1].includes('..')) {
    throw new Error('Set SEWAK_QA_GMAIL to a Gmail address you control (no +alias). Production synthetic QA cannot run without it.');
  }
  return match[1] + '@gmail.com';
}
const roleCodes = {user:'u', caregiver:'c', orgadmin:'o', superadmin:'s', rate:'r'};
export function syntheticQaEmail({role,run,staging=false,gmailBase=null}) {
  if (!Object.hasOwn(roleCodes,role)) throw new Error('Unsupported synthetic QA role');
  if (typeof run !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(run)) {
    throw new Error('Invalid synthetic QA run ID');
  }
  if (staging) return `qa-${role}-${run}@example.invalid`;
  const primary = controlledQaGmail(gmailBase).slice(0,-10);
  const suffix = run.replace(/-/g,'').slice(0,24).toLowerCase();
  return `${primary}+swkq-${roleCodes[role]}-${suffix}@gmail.com`;
}
