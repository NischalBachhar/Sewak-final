import { auth } from './authClient';

const configuredOrigin = process.env.REACT_APP_API_ORIGIN || '';
export const apiOrigin = configuredOrigin.replace(/\/$/, '');
if (apiOrigin && !/^https:\/\//.test(apiOrigin) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(apiOrigin)) throw new Error('API origin must use HTTPS.');
if (apiOrigin && typeof window !== 'undefined' && apiOrigin !== window.location.origin) throw new Error('The web app requires a same-origin Worker API for its secure session cookie.');
export async function apiRequest(path, options = {}) {
  const user = auth.currentUser;
  const headers = new Headers(options.headers || {});
  if (auth.csrfToken) headers.set('X-CSRF-Token', auth.csrfToken);
  if (options.json !== undefined) headers.set('Content-Type', 'application/json');
  let response;
  try { response = await fetch(`${apiOrigin}${path}`, { ...options, headers, body: options.json === undefined ? options.body : JSON.stringify(options.json), credentials: 'same-origin', cache: 'no-store' }); }
  catch { throw Object.assign(new Error('Unable to connect. Check your connection and retry.'), { code: 'unavailable' }); }
  if (auth.currentUser?.uid !== user?.uid) throw Object.assign(new Error('The signed-in account changed. Please retry.'), { code: 'aborted' });
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
