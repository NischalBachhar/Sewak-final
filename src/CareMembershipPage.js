import React,{useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {apiRequest} from './apiClient';
import './MembershipPreview.css';

const offers=[
  {tier:'free',name:'Care essentials',tag:'Available to everyone',
   title:'Everything you need to begin',features:['Browse publicly listed caregivers','Compare real provider pricing','Post a family care job','Request bookings and exchange care messages']},
  {tier:'plus_preview',name:'Care Plus preview',tag:'Demo only · No charges',
   title:'Explore a future plan concept',features:['Preview how a premium plan could appear','Give feedback through a saved interest preference','Continue using the same free care features','No premium access, payment, or recurring billing is activated']}
];
export default function CareMembershipPage(){
 const [state,setState]=useState({loading:true,tier:'free',error:''});
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [agreed,setAgreed]=useState(false);
 const [version,setVersion]=useState(0);
 const refresh=useCallback(()=>setVersion(v=>v+1),[]);
 useEffect(()=>{
  let alive=true;
  apiRequest('/api/membership').then(result=>{
   if(alive)setState({loading:false,tier:result.tier||'free',error:''});
  }).catch(error=>{if(alive)setState({loading:false,tier:'free',error:error.message});});
  return ()=>{alive=false;};
 },[version]);
 async function selectPlan(tier){
  if(!agreed||busy)return;
  setBusy(true);setNotice('');
  try{
   const result=await apiRequest('/api/membership',{method:'POST',json:{tier,acknowledgeDemo:true}});
   setState({loading:false,tier:result.tier,error:''});
   setNotice('Your demo plan preference was saved. No payment was made or subscription created.');
  }catch(error){setNotice(error.message);}finally{setBusy(false);}
 }
 return <main className="sewak-membership-page" id="main-content">
  <header><span>MEMBERSHIP PREVIEW</span><h1>Care made simpler, for everyone.</h1>
   <p>Choose what you want to preview. Sewak is currently a free-to-browse demo marketplace. This page does not sell a subscription or process payments.</p></header>
  <div className="sewak-membership-alert" role="note"><strong>Demo mode — no charges</strong>
   <p>All actual caregiver rates and booking costs remain separate. Care bookings currently use cash arrangements, not online membership billing.</p></div>
  {state.loading?<p role="status">Loading your plan preference…</p>:state.error?
    <p role="alert">Could not load your plan preference: {state.error} <button type="button" onClick={refresh}>Retry</button></p>:
   <><div className="sewak-membership-cards">
    {offers.map(offer=><article key={offer.tier} className={state.tier===offer.tier?'is-selected':''}>
     <span className="sewak-membership-tag">{offer.tag}</span>
     <h2>{offer.name}</h2><h3>{offer.title}</h3>
     <p className="sewak-membership-price">NPR 0 <small>Demo · No recurring billing</small></p>
     <ul>{offer.features.map(value=><li key={value}>✓ {value}</li>)}</ul>
     <button type="button" disabled={!agreed||busy||state.tier===offer.tier} onClick={()=>selectPlan(offer.tier)}>
      {state.tier===offer.tier?'Your selected preview':'Select '+offer.name}</button>
    </article>)}
   </div>
   <label className="sewak-membership-ack"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>
    I understand these are demo plan preferences, not purchases or paid memberships.</label>
   {notice&&<p role="status" className="sewak-membership-result">{notice}</p>}
  </>}
  <p className="sewak-membership-foot"><Link to="/user">Find care →</Link><Link to="/user/mybookings">My bookings →</Link><Link to="/pricing">How pricing works →</Link></p>
 </main>;
}
