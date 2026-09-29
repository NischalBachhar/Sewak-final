import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { activateAccount, bootstrapAccount } from './authClient';
import './AuthPage.css';
export default function AccountSetupPage() {
  const [params] = useSearchParams(), navigate = useNavigate();
  const bootstrap = params.get('mode') === 'bootstrap';
  // The one-time token is delivered in the fragment, never server/access logs.
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname + window.location.search); }, []);
  const [email, setEmail] = useState(''), [name, setName] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const submit = async event => { event.preventDefault(); if (password !== confirm) { setError('Passwords must match.'); return; } setBusy(true); setError('');
    try { if (bootstrap) await bootstrapAccount({ email, name, password, bootstrapToken: token }); else await activateAccount(token, password); navigate('/'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="auth-shell"><div className="auth-card"><h1>Set up your Sewak account</h1>{error && <p role="alert">{error}</p>}
    {!token ? <p>This setup link is missing or was already used. Request a new invitation from your administrator.</p> : <form onSubmit={submit}>
      {bootstrap && <><label htmlFor="setup-name">Full name</label><input id="setup-name" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={120} />
      <label htmlFor="setup-email">Email</label><input id="setup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></>}
      <label htmlFor="setup-password">New password</label><input id="setup-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={12} maxLength={128} />
      <label htmlFor="setup-confirm">Confirm password</label><input id="setup-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={12} maxLength={128} />
      <button disabled={busy} type="submit">{busy ? 'Setting up…' : 'Set password'}</button></form>}</div></div>;
}
