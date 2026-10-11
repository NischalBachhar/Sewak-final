import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authRequest, refreshSession, signOut } from './authClient';
import { useAuth } from './AuthContext';
import { accountLinkToken, clearAccountLink } from './accountLink';
import './AuthPage.css';
export default function AccountEmailPage({ pending = false }) {
 const {user,finishRegistration}=useAuth();
 const reset=window.location.pathname==='/account/reset',forgot=window.location.pathname==='/account/forgot';
 const [email,setEmail]=useState(user?.email||''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[status,setStatus]=useState(null),[done,setDone]=useState(false);
 const check=async()=>{const next=await authRequest('verification-status');setStatus(next);if(next.verified){await refreshSession();await finishRegistration();}return next;};
 useEffect(()=>{if(pending)authRequest('verification-status').then(setStatus).catch(e=>setError(e.message));},[pending]);
 const run=async fn=>{setBusy(true);setError('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const submit=event=>{event.preventDefault();run(async()=>{
  if(forgot){const result=await authRequest('forgot-password',{email});setMessage(result.message);return;}
  if(reset&&password!==confirm)throw new Error('The passwords do not match.');
  await authRequest(reset?'reset-password':'verify-email',{token:accountLinkToken(),...(reset?{password}:{})});clearAccountLink();setPassword('');setConfirm('');setDone(true);setMessage(reset?'Password changed. Sign in with your new password.':'Your email is verified. You can now sign in to Sewak.');
  if(reset)await refreshSession();
  else if(user){await refreshSession();await finishRegistration();}
 });};
 return <main className="auth-shell" style={{minHeight:'100svh',padding:20}}><section className="auth-card" style={{maxWidth:520,width:'100%',margin:'auto'}}>
  <h1>{pending?'Verify your Gmail':forgot?'Forgot password?':reset?'Reset your password':'Verify your email'}</h1>
  {pending&&<><p>Please verify ownership of <strong>{user?.email}</strong> to activate your Sewak account.</p><p>Check your inbox and Spam folder. Verification links expire after 30 minutes.</p><p role="status">{status?.verified?'Email verified':`Pending verification${status?.deliveryStatus?` · Email ${status.deliveryStatus.replaceAll('_',' ')}`:''}`}</p><p>Email verification does not verify caregiver credentials or background checks.</p></>}
  {error&&<p role="alert" className="error-message">{error}</p>}{message&&<p role="status" className="success-message">{message}</p>}
  {pending?<><div className="form"><button disabled={busy} onClick={()=>run(check)}>Check verification status</button><button disabled={busy} onClick={()=>run(async()=>{const r=await authRequest('resend-verification',{});setStatus(r);setMessage(r.verified?'Already verified.':'Verification email queued. Please allow a minute before resending.');})}>Resend verification email</button></div>
   <details style={{marginTop:20}}><summary>Entered the wrong email?</summary><form className="form" onSubmit={e=>{e.preventDefault();run(async()=>{await authRequest('change-email',{email,password});setPassword('');setMessage('A verification link is queued for the new address. Your saved address changes only after verification.');});}}><label>New Gmail address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Current password<input required type="password" autoComplete="current-password" maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>Verify new address</button></form></details><button className="link-button" onClick={()=>run(signOut)} disabled={busy}>Sign out</button>
  </>:!done?<form className="form" onSubmit={submit}>
   {forgot?<><p>Enter your registered email. If eligible, you’ll receive recovery instructions. Google-only accounts should use Continue with Google. Administrators retain their protected recovery process.</p><label>Email<input required autoComplete="email" type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label></>:reset?<><p>Use 8–128 characters. Long passphrases are welcome.</p><label>New password<input required type={visible?'text':'password'} autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm password<input required type={visible?'text':'password'} autoComplete="new-password" minLength={8} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button type="button" aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?'Hide passwords':'Show passwords'}</button></>:<p>Continue to verify ownership of your email. Already used this link? Sign in to check your account status.</p>}
   {!forgot&&!accountLinkToken()?<p role="alert">This link is missing or expired. Request a new link.</p>:<button className="btn btn-primary" disabled={busy}>{busy?'Please wait…':forgot?'Send recovery instructions':reset?'Change password':'Verify email'}</button>}
  </form>:null}
  {!pending&&<Link to="/auth">Return to sign in</Link>}
 </section></main>;
}
