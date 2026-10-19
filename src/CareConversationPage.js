import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { apiRequest } from './apiClient';
import './MarketplaceExpansion.css';

export default function CareConversationPage() {
 const { kind, contextId } = useParams();
 const { search } = useLocation();
 const { user,userRole } = useAuth();
 const caregiverId = kind === 'job' ? (userRole==='caregiver' ? user?.uid : new URLSearchParams(search).get('caregiverId')) : null;
 const [state,setState]=useState({loading:true,messages:[],error:''});
 const [body,setBody]=useState('');
 const [sending,setSending]=useState(false);
 const [notice,setNotice]=useState('');
 const [refreshKey,setRefreshKey]=useState(0);
 const refresh=useCallback(()=>setRefreshKey(v=>v+1),[]);
 const validKind=['booking','job'].includes(kind);
 const query=new URLSearchParams({kind:kind||'',contextId:contextId||'',...(kind==='job'&&caregiverId?{caregiverId}:{})}).toString();
 useEffect(()=>{
   if(!validKind || !contextId || (kind==='job' && !caregiverId)){setState({loading:false,messages:[],error:'Select an authorized care conversation.'});return;}
   let active=true;
   setState(old=>({...old,loading:true,error:''}));
   apiRequest('/api/care-messages?'+query).then(value=>{if(active)setState({loading:false,messages:value.messages||[],error:''});})
     .catch(error=>{if(active)setState({loading:false,messages:[],error:error.message});});
   return ()=>{active=false;};
 },[query,validKind,kind,contextId,caregiverId,refreshKey]);
 async function submit(e){
   e.preventDefault();if(sending||body.trim().length<1)return;
   setSending(true);setNotice('');
   try {
     await apiRequest('/api/care-messages',{method:'POST',json:{kind,contextId,...(kind==='job'?{caregiverId}:{}),body:body.trim()}});
     setBody('');refresh();
   }catch(error){setNotice(error.message);}finally{setSending(false);}
 }
 const back=userRole==='caregiver'?(kind==='job'?'/caregiver/opportunities':'/caregiver?tab=jobs'):(kind==='job'?'/user/jobs':'/user/mybookings');
 return <main id="main-content" className="care-conversation-page">
   <header><p>PRIVATE SEWAK CONVERSATION</p><h1>Messages about {kind==='booking'?'your booking':'a care job'}</h1><div>Only the participating customer and caregiver can access this conversation. Please avoid sharing sensitive personal or medical information here.</div><Link to={back}>← Back to {kind==='job'?'care jobs':'bookings'}</Link></header>
   <section className="care-conversation-panel" aria-label="Conversation">
     {state.loading?<p role="status">Loading messages…</p>:state.error?<div role="alert"><p>{state.error}</p><button type="button" onClick={refresh}>Retry</button></div>:
     !state.messages.length?<p className="care-conversation-empty">No messages yet. Introduce yourself and agree on the next step.</p>:
     <ol className="care-conversation-list">{state.messages.map(item=><li key={item.id} className={item.senderId===user?.uid?'is-own':''}>
       <span>{item.senderId===user?.uid?'You':'Care conversation partner'}</span><p>{item.body}</p><small>{item.createdAt?new Date(item.createdAt).toLocaleString('en-NP'):''}</small>
     </li>)}</ol>}
     {!state.error&&!state.loading&&<form onSubmit={submit}><label htmlFor="care-message-text">Your message</label><textarea id="care-message-text" value={body} onChange={e=>setBody(e.target.value)} rows="3" maxLength="1500" placeholder="Write a thoughtful message…" required/><div><span>{body.length} / 1500 characters</span><button type="submit" disabled={sending||!body.trim()}>{sending?'Sending…':'Send message →'}</button></div></form>}
     {notice&&<p role="alert" className="care-jobs-notice">{notice}</p>}
   </section><p className="care-conversation-note">Messaging does not confirm a booking. Bookings are confirmed only after caregiver acceptance.</p>
 </main>;
}
