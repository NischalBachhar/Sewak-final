import { auth } from './authClient';

const configuredOrigin = process.env.REACT_APP_API_ORIGIN || '';
export const apiOrigin = configuredOrigin.replace(/\/$/, '');
if (apiOrigin && !/^https:\/\//.test(apiOrigin) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(apiOrigin)) throw new Error('API origin must use HTTPS.');
if (apiOrigin && typeof window !== 'undefined' && apiOrigin !== window.location.origin) throw new Error('The web app requires a same-origin Worker API for its secure session cookie.');
const PUBLIC_PROJECTIONS = new Set(['publicCaregivers', 'publicServices', 'publicReviews']);
function anonymousPublicRead(path, options) {
  // Public projections are independently authorized by the Worker. Keeping
  // stale session cookies off these reads lets signed-out families browse care.
  if (path === '/api/query' && options.method === 'POST') {
    return PUBLIC_PROJECTIONS.has(options.json?.path);
  }
  if (options.method === undefined || options.method === 'GET') {
    const parts = path.split('/');
    return parts.length === 5 && parts[1] === 'api' && parts[2] === 'records' && PUBLIC_PROJECTIONS.has(parts[3]) && Boolean(parts[4]);
  }
  return false;
}
export async function apiRequest(path, options = {}) {
  const publicRead = anonymousPublicRead(path, options);
  const user = auth.currentUser;
  const headers = new Headers(options.headers || {});
  if (!publicRead && auth.csrfToken) headers.set('X-CSRF-Token', auth.csrfToken);
  if (options.json !== undefined) headers.set('Content-Type', 'application/json');
  // Ignore any caller-provided credential mode; private routes always use the
  // same-origin secure cookie and public projections always omit credentials.
  let response;
  try { response = await fetch(`${apiOrigin}${path}`, { ...options, headers, body: options.json === undefined ? options.body : JSON.stringify(options.json), credentials: publicRead ? 'omit' : 'same-origin', cache: 'no-store' }); }
  catch { throw Object.assign(new Error('Unable to connect. Check your connection and retry.'), { code: 'unavailable' }); }
  if (!publicRead && auth.currentUser?.uid !== user?.uid) throw Object.assign(new Error('The signed-in account changed. Please retry.'), { code: 'aborted' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Object.assign(new Error(body.error?.message || 'The service is temporarily unavailable. Please retry.'), { code: body.error?.code || 'unavailable', status: response.status });
  }
  return options.binary ? response.blob() : response.json();
}
export const notifyDataChanged = () => window.dispatchEvent(new Event('sewak:data-changed'));
// Retain the existing callable result shape while all operations go to Workers.
export const httpsCallable = (_unused, operation) => async (data = {}) => {
  const result = await apiRequest(`/api/actions/${encodeURIComponent(operation)}`, { method: 'POST', json: data });
  notifyDataChanged();
  return { data: result };
};
