import React,{useEffect,useRef,useState} from 'react';
import {apiRequest} from '../apiClient';
import AccessibleDialog from './AccessibleDialog';
import './AdminOperationsPanel.css';

export default function AdminOperationsPanel({kind}){
 const accounts=kind==='accounts';
 const [state,setState]=useState({loading:true,items:[],nextCursor:null,error:''});
 const [pages,setPages]=useState(['']);
 const [version,setVersion]=useState(0);
 const [target,setTarget]=useState(null);
 const [reason,setReason]=useState('');
 const [confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [actionError,setActionError]=useState('');
 const lock=useRef(false),cursor=pages[pages.length-1];
 useEffect(()=>{
   let active=true;setState(old=>({...old,loading:true,error:''}));
   apiRequest('/api/admin/'+kind+(cursor?'?cursor='+encodeURIComponent(cursor):''))
    .then(result=>{if(active)setState({loading:false,items:result.items||[],nextCursor:result.nextCursor,error:''});})
    .catch(error=>{if(active)setState({loading:false,items:[],nextCursor:null,error:error.message});});
   return ()=>{active=false;};
 },[kind,cursor,version]);
 function open(account,action){setTarget({account,action});setReason('');setConfirmation('');setActionError('');setNotice('');}
 async function submit(event){
   event.preventDefault();if(lock.current||!target)return;lock.current=true;setBusy(true);setActionError('');
   const {account,action}=target;
   try{
     await apiRequest('/api/actions/'+(action==='delete'?'deleteCareAccount':'applyAccountSafetyAction'),{method:'POST',json:action==='delete'
       ?{targetUid:account.id,confirmation}
       :{targetType:account.role==='caregiver'?'caregiver':'customer',targetId:account.id,reason}});
     setTarget(null);setNotice(action==='delete'?'Account removed from active use. Historical care records are retained.':'Account restricted and sessions revoked.');setVersion(v=>v+1);
   }catch(error){setActionError(error.message);}finally{lock.current=false;setBusy(false);}
 }
 return <section className="admin-operations" aria-labelledby={'admin-'+kind+'-title'}>
   <header><div><h2 id={'admin-'+kind+'-title'}>{accounts?'Customer and caregiver accounts':'Audit log'}</h2>
     <p>{accounts?'Review account access. Organization accounts are managed in Organizations.':'Recorded administrative actions, newest first. Private recovery tokens and evidence are excluded.'}</p></div>
     <button type="button" className="btn btn-outline" onClick={()=>setVersion(v=>v+1)} disabled={state.loading}>Refresh</button></header>
   {notice&&<p role="status">{notice}</p>}
   {state.loading?<p role="status">Loading records…</p>:state.error?<div role="alert"><p>{state.error}</p><button type="button" className="btn btn-outline" onClick={()=>setVersion(v=>v+1)}>Retry</button></div>:
   !state.items.length?<p>No {accounts?'accounts':'administrative actions'} on this page.</p>:
   <ul className="admin-operations__records">{state.items.map(item=><li key={item.id}>
     {accounts?<><div><h3>{item.name||item.id}</h3><p>{item.role==='user'?'Customer':'Caregiver'} · {item.deletedAt?'Deleted from active use':item.isSuspended||item.isBlacklisted?'Restricted':'Active'}</p><p>{item.email||'Email not supplied'}</p><small>Account: {item.id}</small></div>
       {!item.deletedAt&&<div className="admin-operations__actions">{!item.isSuspended&&!item.isBlacklisted?<button type="button" className="btn btn-outline" disabled={busy} onClick={()=>open(item,'restrict')}>Blacklist account</button>:<button type="button" className="btn btn-outline" disabled={busy} onClick={()=>open(item,'delete')}>Delete account</button>}</div>}</>:
     <div><h3>{item.action.replaceAll('_',' ')}</h3><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-NP',{timeZone:'Asia/Kathmandu'})}</time><p>Actor: {item.actorUid||'Not recorded'}</p><p>Target: {item.targetUid||item.targetId||item.organizationId||'Not recorded'}</p></div>}
   </li>)}</ul>}
   <nav aria-label={accounts?'Account pages':'Audit pages'}><button type="button" className="btn btn-outline" disabled={state.loading||pages.length===1} onClick={()=>setPages(old=>old.slice(0,-1))}>Previous</button><span>Page {pages.length}</span><button type="button" className="btn btn-outline" disabled={state.loading||!state.nextCursor} onClick={()=>setPages(old=>[...old,state.nextCursor])}>Next</button></nav>
   {target&&<div className="admin-operations__backdrop"><AccessibleDialog className="admin-operations__dialog" aria-labelledby="account-action-title" onDismiss={()=>{if(!busy)setTarget(null);}}>
     <h3 id="account-action-title">{target.action==='delete'?'Delete account from active use?':'Blacklist account?'}</h3>
     <p>{target.account.name||target.account.id}</p><p>Account access and sessions will be revoked. Existing bookings, messages, reviews and audit records are retained.</p>
     <form onSubmit={submit}>{target.action==='delete'?<label>Type {target.account.name||target.account.id} to confirm<input required value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off"/></label>:<label>Reason<textarea required minLength={3} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
       {actionError&&<p role="alert">{actionError}</p>}
       <div className="admin-operations__actions"><button type="button" className="btn btn-outline" disabled={busy} onClick={()=>setTarget(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy||(target.action==='delete'?confirmation!==(target.account.name||target.account.id):reason.trim().length<3)}>{busy?'Saving…':'Confirm '+(target.action==='delete'?'deletion':'blacklist')}</button></div>
     </form>
   </AccessibleDialog></div>}
 </section>;
}
