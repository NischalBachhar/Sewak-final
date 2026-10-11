import React, { useEffect, useState } from 'react';
import { authRequest } from '../authClient';
export default function GoogleSignIn({role='user'}) {
 const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;fetch('/api/config').then(r=>r.json()).then(c=>{if(active)setEnabled(c.google===true);}).catch(()=>{});return()=>{active=false;};},[]);
 if(!enabled)return null;
 return <><button type="button" className="btn btn-outline" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const result=await authRequest('google/start',{role});const target=new URL(result.url);if(target.origin!=='https://accounts.google.com')throw new Error('Invalid sign-in destination.');window.location.assign(target.href);}catch(e){setError(e.message);setBusy(false);}}}>Continue with Google</button>{error&&<p role="alert">{error}</p>}</>;
}
