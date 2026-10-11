// Consume the fragment before React or route metadata runs. It never reaches
// the server, analytics, localStorage or a referrer. A reload requests a new link.
let token = '';
if (typeof window !== 'undefined' && ['/account/reset','/account/verify'].includes(window.location.pathname)) {
  token = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
  window.history.replaceState(null, '', window.location.pathname);
}
export function accountLinkToken() { return token; }
export function clearAccountLink() { token = ''; }
