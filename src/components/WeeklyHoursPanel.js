import React,{useCallback,useEffect,useState} from 'react';
import {apiRequest} from '../apiClient';
import './WeeklyHoursPanel.css';

const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const pad=value=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
export default function WeeklyHoursPanel(){
 const [weekday,setWeekday]=useState('1'),[start,setStart]=useState('09:00'),[end,setEnd]=useState('17:00');
 const [state,setState]=useState({loading:true,items:[],error:''}),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[counter,setCounter]=useState(0);
 const refresh=useCallback(()=>setCounter(x=>x+1),[]);
 useEffect(()=>{
  let active=true;
  apiRequest('/api/care-schedule').then(result=>{if(active)setState({loading:false,items:result.weeklyHours||[],error:''});})
   .catch(error=>{if(active)setState({loading:false,items:[],error:error.message});});
  return ()=>{active=false;};
 },[counter]);
 async function act(data){
  if(busy)return;setBusy(true);setNotice('');
  try{
   await apiRequest('/api/care-schedule',{method:'POST',json:data});
   setNotice(data.action==='weekly-add'?'Weekly working hours saved. Future care requests must fit your published hours.':'Weekly working window removed.');
   refresh();
  }catch(error){setNotice(error.message);}finally{setBusy(false);}
 }
 return <section className="care-weekly-panel" aria-labelledby="care-weekly-heading">
   <h2 id="care-weekly-heading">Recurring weekly hours</h2>
   <p>Tell families which days and hours you normally work. Once you set a window, new requests must fit your listed days and times. Already confirmed care stays confirmed.</p>
   <form onSubmit={event=>{event.preventDefault();act({action:'weekly-add',weekday:Number(weekday),start,end});}}>
    <label htmlFor="weekly-day">Day of week<select id="weekly-day" value={weekday} onChange={e=>setWeekday(e.target.value)}>{weekdays.map((day,index)=><option value={index} key={day}>{day}</option>)}</select></label>
    <label htmlFor="weekly-start">From<input id="weekly-start" type="time" value={start} required onChange={e=>setStart(e.target.value)}/></label>
    <label htmlFor="weekly-end">Until<input id="weekly-end" type="time" value={end} required onChange={e=>setEnd(e.target.value)}/></label>
    <button type="submit" disabled={busy}>Add hours →</button>
   </form>
   {state.loading?<p role="status">Loading weekly hours…</p>:state.error?<p role="alert">{state.error}</p>:
    state.items.length?<ul aria-label="Published weekly hours">{state.items.map(item=><li key={item.id}><span><strong>{weekdays[item.weekday]}</strong> · {pad(item.startMin)} – {pad(item.endMin)}</span><button type="button" disabled={busy} onClick={()=>act({action:'weekly-remove',id:item.id})}>Remove hours</button></li>)}</ul>:
    <p>You have not set any recurring working hours. Your normal profile availability applies.</p>}
   {notice&&<p role="status" className="care-weekly-notice">{notice}</p>}
  </section>;
}
