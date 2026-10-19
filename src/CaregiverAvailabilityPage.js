import React,{useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {apiRequest} from './apiClient';
import './CareInspired.css';

const formatTime=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');

export default function CaregiverAvailabilityPage(){
 const [day,setDay]=useState('');
 const [start,setStart]=useState('09:00');
 const [end,setEnd]=useState('17:00');
 const [state,setState]=useState({loading:true,blocks:[],error:''});
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [version,setVersion]=useState(0);
 const refresh=useCallback(()=>setVersion(value=>value+1),[]);
 useEffect(()=>{
  let active=true;
  apiRequest('/api/care-schedule').then(result=>{if(active)setState({loading:false,blocks:result.blocks||[],error:''});})
  .catch(error=>{if(active)setState({loading:false,blocks:[],error:error.message});});
  return ()=>{active=false;};
 },[version]);
 async function submit(event){
  event.preventDefault();if(busy)return;setBusy(true);setNotice('');
  try{
    await apiRequest('/api/care-schedule',{method:'POST',json:{action:'block',day,start,end}});
    setNotice('Time blocked. New booking requests cannot overlap this period.');refresh();
  }catch(error){setNotice(error.message);}finally{setBusy(false);}
 }
 async function remove(id){
  if(busy)return;setBusy(true);setNotice('');
  try{await apiRequest('/api/care-schedule',{method:'POST',json:{action:'unblock',id}});setNotice('Time made available again.');refresh();}
  catch(error){setNotice(error.message);}finally{setBusy(false);}
 }
 return <main className="care-timeoff-page" id="main-content">
  <header><p>CAREGIVER AVAILABILITY</p><h1>Manage your time</h1>
    <span>Block dates or hours when you cannot accept new care. Confirmed bookings stay protected.</span>
    <Link to="/caregiver?tab=schedule">← Back to schedule</Link>
  </header>
  <div className="care-timeoff-grid"><section className="care-timeoff-card">
    <h2>Block unavailable time</h2>
    <form onSubmit={submit}>
      <label htmlFor="timeoff-day">Date <input required id="timeoff-day" type="date" value={day} onChange={e=>setDay(e.target.value)} /></label>
      <div className="care-timeoff-hours">
        <label htmlFor="timeoff-start">From <input required id="timeoff-start" type="time" value={start} onChange={e=>setStart(e.target.value)}/></label>
        <label htmlFor="timeoff-end">Until <input required id="timeoff-end" type="time" value={end} onChange={e=>setEnd(e.target.value)}/></label>
      </div>
      <button disabled={busy||!day} type="submit">{busy?'Saving…':'Block this time →'}</button>
    </form><p className="care-timeoff-help">Blocked periods cannot overlap an already accepted booking. All times are in Nepal local time.</p>
  </section><section className="care-timeoff-card">
    <div className="care-timeoff-head"><h2>Upcoming unavailable times</h2><button type="button" onClick={refresh}>Refresh</button></div>
    {state.loading?<p role="status">Loading your availability…</p>:
    state.error?<p role="alert">{state.error}</p>:!state.blocks.length?<p>No blocks set. Your profile's normal availability still applies.</p>:
    <ul>{state.blocks.map(item=><li key={item.id}><div><strong>{item.day}</strong><span>{formatTime(item.startMin)} – {formatTime(item.endMin)}</span></div><button type="button" onClick={()=>remove(item.id)} disabled={busy}>Remove</button></li>)}</ul>}
  </section></div>
  {notice&&<p role="status" className="care-timeoff-notice">{notice}</p>}
 </main>;
}
