// Include only the public validation error from a synthetic QA request.
// Never log or store its request payload, authentication token or credentials.
export function qaFailureDetail({label,status,error,password}) {
  const code = typeof error?.code === 'string' ? error.code : 'unknown-error';
  const raw = typeof error?.message === 'string' ? error.message : 'No server explanation';
  const protectedMessage = password ? raw.split(password).join('[redacted]') : raw;
  const sanitized = protectedMessage
    .replace(/swk_[A-Za-z0-9_-]{20,}/g, '[redacted]')
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+/g, '[synthetic-email]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 200);
  return `${label}: HTTP ${status} ${code} — ${sanitized}`;
}
