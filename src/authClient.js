// Session tokens live only in the Secure HttpOnly cookie. Never localStorage.
export const auth = { currentUser: null, csrfToken: null };
const listeners = new Set();
let initial;
let generation = 0, loaded = false;
function publish(result) {
  loaded = true;
  auth.currentUser = result?.user || null;
  auth.csrfToken = result?.csrfToken || null;
  for (const listener of listeners) listener(auth.currentUser);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('sewak:data-changed'));
  return auth.currentUser;
}
async function request(path, body) {
  const response = await fetch('/api/auth/' + path, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(auth.csrfToken ? { 'X-CSRF-Token': auth.csrfToken } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path === 'me') return { user: null };
    throw Object.assign(new Error(result.error?.message || 'Please retry.'), { code: result.error?.code || 'unavailable', status: response.status });
  }
  return result;
}
export async function refreshSession() { const before = generation; const result = await request('me'); return before === generation ? publish(result) : auth.currentUser; }
export function onSessionChanged(listener) {
  listeners.add(listener);
  if (!initial) initial = refreshSession().catch(error => { initial = null; for (const fn of listeners) fn(null, error); });
  else if (loaded) listener(auth.currentUser);
  return () => listeners.delete(listener);
}
async function startSession(path, body) { const version = ++generation; const result = await request(path, body); return version === generation ? publish(result) : auth.currentUser; }
export async function signIn(email, password) { return startSession('login', { email, password }); }
export async function register({ email, password, name }) { return startSession('register', { email, password, name }); }
export async function signOut() { ++generation; try { await request('logout', {}); } catch (error) { if (error.code !== 'unauthenticated') throw error; } publish(null); initial = null; }
export async function changePassword(currentPassword, newPassword) { ++generation; await request('change-password', { currentPassword, newPassword }); publish(null); initial = null; }
export async function activateAccount(token, password) { return startSession('activate', { token, password }); }
export async function bootstrapAccount({ email, password, name, bootstrapToken }) { return startSession('bootstrap', { email, password, name, bootstrapToken }); }
export async function revokeSessions(input = { all: true }) { const result = await request('revoke-sessions', input); if (result.signedOut) publish(null); return result; }
export const listSessions = () => request('sessions');
