import React, { useEffect, useState } from 'react';
import { resetPassword, verifyEmail } from './authClient';
import './AuthPage.css';

export default function AccountEmailPage() {
  const reset = new URLSearchParams(window.location.search).get('mode') === 'reset';
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    // Tokens stay out of referrers, access logs, storage and browser history.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy || done) return;
    if (reset && password !== confirm) { setError('Passwords must match.'); return; }
    setBusy(true); setError('');
    try { if (reset) await resetPassword(token, password); else await verifyEmail(token); setDone(true); setPassword(''); setConfirm(''); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main id="main-content" className="auth-shell auth-email-shell"><section className="auth-card">
    <h1>{reset ? 'Reset your password' : 'Verify your email'}</h1>
    {error && <p role="alert">{error}</p>}
    {done ? <p role="status">{reset ? 'Password updated. Your previous sessions have been signed out. Sign in with your new password.' : 'Your email is verified. You can enable email updates in notification preferences.'}</p> : !token ? <p>This link is missing or expired. Request a new link from Sewak.</p> : <form className="form" onSubmit={submit}>
      {reset ? <><label htmlFor="reset-password">New password</label><input id="reset-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} />
        <label htmlFor="reset-confirm">Confirm new password</label><input id="reset-confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} onChange={e => setConfirm(e.target.value)} />
        <p>Use 12–128 characters. This changes your Sewak password. Your Google password is managed by Google.</p></> : <p>Confirm this email belongs to you. You choose whether to receive care updates.</p>}
      <button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Please wait…' : reset ? 'Save new password' : 'Verify email'}</button>
    </form>}
    <a className="auth-home-link" href="/auth">Back to sign in</a>
  </section></main>;
}
