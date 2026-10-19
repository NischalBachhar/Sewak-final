import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from './apiClient';
import { useAuth } from './AuthContext';
import './CareInspired.css';

export default function CareNotificationsPage() {
  const {userRole} = useAuth();
  const [items,setItems] = useState([]);
  const [unread,setUnread] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState('');
  const [version,setVersion] = useState(0);
  const [reminders,setReminders] = useState(true);
  const [notice,setNotice] = useState('');
  const [filter,setFilter] = useState('all');
  const refresh=useCallback(()=>setVersion(value=>value+1),[]);
  useEffect(()=>{
    let active=true;
    setLoading(true);
    setError('');
    apiRequest('/api/care-notifications').then(result=>{
      if(active){setItems(result.items||[]);setUnread(result.unread||0);setReminders(result.preferences?.bookingReminders!==false);setLoading(false);}
    }).catch(err=>{if(active){setError(err.message);setLoading(false);}});
    return ()=>{active=false;};
  },[version]);
  async function mark(action,id){
    if(busy)return;
    setBusy(id||'all');setError('');
    try{
      await apiRequest('/api/care-notifications',{method:'POST',json:{action,...(id?{id}:{})}});
      window.dispatchEvent(new Event('sewak-notifications-changed'));
      refresh();
    }catch(err){setError(err.message);}
    finally{setBusy('');}
  }
  async function saveReminders(event){
    const enabled=event.target.checked;
    if(busy)return;
    const previous=reminders;
    setReminders(enabled);
    setBusy('preferences');setError('');setNotice('');
    try{
      await apiRequest('/api/care-notifications',{method:'POST',json:{action:'preferences',bookingReminders:enabled}});
      setReminders(enabled);setNotice('Reminder preference saved.');
    }catch(err){setReminders(previous);setError(err.message);}finally{setBusy('');}
  }
  const visibleItems = filter === 'unread' ? items.filter(item=>!item.readAt) : items;
  const home=userRole==='caregiver'?'/caregiver':userRole==='orgadmin'?'/organization':userRole==='superadmin'?'/superadmin':'/user/home';
  return <main id="main-content" className="care-notices" aria-labelledby="care-notices-title">
    <header className="care-notices__header"><div>
      <p>YOUR SEWAK UPDATES</p><h1 id="care-notices-title">Notifications</h1>
      <span>Booking requests, confirmations and important care updates in one place.</span>
    </div><Link to={home}>Back to workspace →</Link></header>
    <section className="care-notices__panel" aria-labelledby="notification-preferences-title">
      <h2 id="notification-preferences-title">Notification preferences</h2>
      <label><input type="checkbox" checked={reminders} onChange={saveReminders} disabled={loading||!!busy}/> Remind me about upcoming care appointments</label>
      <p>Updates appear in Sewak. Booking decisions and private message alerts remain available. Email and Web Push delivery are not enabled.</p>
      {notice&&<p role="status">{notice}</p>}
    </section>
    <section className="care-notices__panel" aria-label="Notification activity">
      <div className="care-notices__toolbar">
        <strong>{loading?'Checking updates…':unread?unread+' unread':'All caught up'}</strong>
        <button type="button" onClick={()=>mark('read-all')} disabled={!!busy||loading||unread===0}>Mark all as read</button>
      </div>
      {!loading && items.length>0 && <div className="sewak2-notice-filters" role="group" aria-label="Filter notifications"><button type="button" className={filter==='all'?'is-active':''} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All ({items.length})</button><button type="button" className={filter==='unread'?'is-active':''} aria-pressed={filter==='unread'} onClick={()=>setFilter('unread')}>Unread ({unread})</button></div>}
      {error&&<div role="alert"><p>{error}</p><button type="button" onClick={refresh}>Retry</button></div>}
      {loading?<p role="status">Loading notifications…</p>:!items.length?<div className="care-notices__empty">
        <h2>No updates yet</h2><p>You'll see updates here once your care bookings begin.</p>
        <Link to={home}>Return to Sewak →</Link>
      </div>:!visibleItems.length ? <p role="status" className="sewak2-no-results">You have no unread notifications.</p> : <ul>{visibleItems.map(item=><li key={item.id} className={item.readAt?'':'is-unread'}>
        <span className="care-notices__bullet" aria-hidden="true" />
        <div><small>{item.eventType.replaceAll('-',' ')}</small><strong>{item.title}</strong><p>{item.body}</p>
          <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-NP',{timeZone:'Asia/Kathmandu'})}</time>
        </div><div className="care-notices__actions">
          <Link to={item.link}>View details →</Link>
          {!item.readAt&&<button type="button" disabled={!!busy} onClick={()=>mark('read',item.id)}>Mark read</button>}
        </div>
      </li>)}</ul>}
    </section>
  </main>;
}
