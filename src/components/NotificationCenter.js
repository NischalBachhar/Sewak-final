import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../apiClient';
import AccessibleDialog from './AccessibleDialog';
import './NotificationCenter.css';
const post=(path,json)=>apiRequest('/api/notifications/'+path,{method:'POST',json});
export default function NotificationCenter({uid}) {
 const [open,setOpen]=useState(false),[items,setItems]=useState([]),[unread,setUnread]=useState(0),[cursor,setCursor]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[prefs,setPrefs]=useState(null),[devices,setDevices]=useState(null),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{const r=await apiRequest('/api/notifications');setItems(r.notifications);setUnread(r.unread);setCursor(r.nextCursor);},[]);
 useEffect(()=>{let active=true;const poll=()=>{if(document.visibilityState==='hidden'||!active)return;refresh().catch(()=>{});};poll();const timer=setInterval(poll,60000);window.addEventListener('focus',poll);document.addEventListener('visibilitychange',poll);window.addEventListener('sewak:data-changed',poll);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',poll);document.removeEventListener('visibilitychange',poll);window.removeEventListener('sewak:data-changed',poll);};},[uid,refresh]);
 const run=async fn=>{setError('');setLoading(true);try{await fn();}catch(e){setError(e.message);}finally{setLoading(false);}};
 const loadSettings=async()=>{const [p,d]=await Promise.all([apiRequest('/api/notifications/preferences'),apiRequest('/api/notifications/devices')]);setPrefs(p);setDevices(d);};
 const enablePush=async()=>{
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw new Error('Push is not supported here. Your in-app inbox remains available.');
  if(Notification.permission==='denied')throw new Error('Notifications are blocked. Change this site’s browser settings to enable them.');
  if(await Notification.requestPermission()!=='granted')throw new Error('Permission was not granted. Your in-app inbox remains available.');
  const registration=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
  const existing=await registration.pushManager.getSubscription();
  const key=Uint8Array.from(atob(devices.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  try{const saved=await post('subscribe',{subscription:subscription.toJSON(),label:'This browser'});localStorage.setItem('sewak.pushDevice.'+uid,saved.id);}catch(e){if(e.code==='subscription-owned')await subscription.unsubscribe();throw e;}
  setNotice('This browser is subscribed.');await loadSettings();
 };
 return <><button className="notification-bell" type="button" aria-label={`Notifications, ${unread} unread`} onClick={()=>{setOpen(true);run(refresh);}}><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6"/></svg>{unread>0&&<span>{unread>99?'99+':unread}</span>}</button>
 {open&&<AccessibleDialog className="notification-backdrop" onDismiss={()=>setOpen(false)}><section className="notification-panel"><div className="notification-heading"><h2>Notifications</h2><button type="button" onClick={()=>setOpen(false)}>Close</button></div><p aria-live="polite">{unread} unread notifications</p>
 <div className="notification-actions"><button disabled={loading} onClick={()=>run(async()=>{await post('read',{all:true});await refresh();})}>Mark all as read</button><button disabled={loading} onClick={()=>run(loadSettings)}>Notification settings</button><button disabled={loading} onClick={()=>run(refresh)}>Refresh</button></div>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{loading&&<p role="status">Loading…</p>}
 {prefs&&<section aria-label="Notification settings"><h3>Notification settings</h3><p>Security notices remain enabled. No promotional messages are sent.</p><div className="notification-preferences">{Object.entries(prefs.categories).map(([category,channels])=><fieldset key={category}><legend>{category}</legend>{Object.entries(channels).map(([channel,enabled])=><label key={channel}><input type="checkbox" checked={enabled} disabled={category==='security'&&channel!=='push'} onChange={e=>setPrefs({...prefs,categories:{...prefs.categories,[category]:{...channels,[channel]:e.target.checked}}})}/>{channel==='inApp'?'In-app':channel}</label>)}</fieldset>)}</div><button disabled={loading} onClick={()=>run(async()=>{await post('preferences',prefs);setNotice('Preferences saved.');await refresh();})}>Save preferences</button>
 <p>To receive Sewak notifications on your iPhone, add Sewak to your Home Screen and enable notifications. Requires a compatible iOS version and installed Home Screen app.</p>{devices?.enabled?<button disabled={loading} onClick={()=>run(enablePush)}>Enable notifications on this device</button>:<p>Web Push is not configured. In-app notifications are available.</p>}
 <button disabled={loading} onClick={()=>run(async()=>{const r=await navigator.serviceWorker?.getRegistration('/');const s=await r?.pushManager.getSubscription();if(s)await s.unsubscribe();const id=localStorage.getItem('sewak.pushDevice.'+uid);if(id){await post('unsubscribe',{id});localStorage.removeItem('sewak.pushDevice.'+uid);}setNotice('This browser is unsubscribed.');await loadSettings();})}>Unsubscribe this browser</button>
 <ul>{devices?.devices.map(d=><li key={d.id}>{d.device_label}<button disabled={loading} onClick={()=>run(async()=>{await post('unsubscribe',{id:d.id});await loadSettings();})}>Remove device</button></li>)}</ul><button onClick={()=>setPrefs(null)}>Close settings</button></section>}
 {!loading&&!items.length&&<p>You’re all caught up. New notifications will appear here.</p>}
 <ul className="notification-list">{items.map(n=><li key={n.id} className={n.read_at?'is-read':'is-unread'}><strong>{n.title}</strong><p>{n.message}</p><time dateTime={new Date(n.created_at*1000).toISOString()}>{new Date(n.created_at*1000).toLocaleString('en-NP',{timeZone:'Asia/Kathmandu'})} NPT</time><div><Link to={/^\/(user|caregiver|organization|superadmin)(\/|$)/.test(n.target)?n.target:'/'} onClick={()=>setOpen(false)}>View details</Link>{!n.read_at&&<button disabled={loading} onClick={()=>run(async()=>{await post('read',{id:n.id});await refresh();})}>Mark as read</button>}</div></li>)}</ul>
 {cursor&&<button disabled={loading} onClick={()=>run(async()=>{const r=await apiRequest('/api/notifications?before='+encodeURIComponent(cursor));setItems([...items,...r.notifications]);setCursor(r.nextCursor);})}>Load more</button>}
 </section></AccessibleDialog>}</>;
}
