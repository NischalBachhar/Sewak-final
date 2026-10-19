import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from './apiClient';
import { formatNpr } from './config/brand';
import './MarketplaceExpansion.css';

const blank = { title:'',description:'',city:'',category:'caregiver',schedule:'flexible',hourlyBudget:'' };
export default function CareJobsPage({ role }) {
  const customer = role === 'user';
  const [draft,setDraft] = useState(blank);
  const [list,setList] = useState({loading:true,jobs:[],error:''});
  const [selected,setSelected] = useState('');
  const [applications,setApplications] = useState({loading:false,items:[],error:''});
  const [applying,setApplying] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [refreshKey,setRefreshKey] = useState(0);
  const [searchText,setSearchText] = useState('');
  const [categoryFilter,setCategoryFilter] = useState('all');
  const refresh=useCallback(()=>setRefreshKey(v=>v+1),[]);
  useEffect(()=>{
    let active=true;
    setList(old=>({...old,loading:true,error:''}));
    apiRequest('/api/care-jobs').then(data=>{if(active)setList({loading:false,jobs:data.jobs||[],error:''});})
      .catch(e=>{if(active)setList({loading:false,jobs:[],error:e.message});});
    return ()=>{active=false;};
  },[refreshKey]);
  useEffect(()=>{
    if(!customer||!selected)return;
    let active=true;
    setApplications({loading:true,items:[],error:''});
    apiRequest('/api/care-jobs/'+encodeURIComponent(selected)+'/applications')
      .then(data=>{if(active)setApplications({loading:false,items:data.applications||[],error:''});})
      .catch(e=>{if(active)setApplications({loading:false,items:[],error:e.message});});
    return ()=>{active=false;};
  },[selected,customer,refreshKey]);
  const edit=(key,val)=>setDraft(old=>({...old,[key]:val}));
  async function publish(e){
    e.preventDefault();if(busy)return;
    setBusy(true);setNotice('');
    try {
      await apiRequest('/api/care-jobs',{method:'POST',json:{...draft,hourlyBudget:draft.hourlyBudget===''?null:Number(draft.hourlyBudget)}});
      setDraft(blank);setNotice('Your job is published for approved caregivers.');refresh();
    }catch(e){setNotice(e.message);}
    finally{setBusy(false);}
  }
  async function act(id,action,json={}){
    if(busy)return;
    setBusy(true);setNotice('');
    try{
      await apiRequest('/api/care-jobs/'+encodeURIComponent(id)+'/'+action,{method:'POST',json});
      setNotice(action==='apply'?'Application sent to the family.':action==='close'?'Job closed to new applications.':'Application withdrawn.');
      setMessage('');setApplying('');refresh();
    }catch(e){setNotice(e.message);}
    finally{setBusy(false);}
  }
  const visibleJobs = list.jobs.filter(job => {
    const categoryOk = categoryFilter === 'all' || job.category === categoryFilter;
    const haystack = [job.title,job.description,job.city].filter(Boolean).join(' ').toLowerCase();
    return categoryOk && haystack.includes(searchText.trim().toLowerCase());
  });
  return <main id="main-content" className="care-jobs-page">
    <header className="care-jobs-hero"><p>SEWAK CARE CONNECTIONS</p><h1>{customer?'Post a care job':'Find care jobs'}</h1>
      <div>{customer?'Describe your family’s needs and hear from approved caregivers. Posting a job does not confirm a booking.':'Browse care requests and apply with a thoughtful introduction. Acceptance and scheduling happen separately.'}</div>
      <button type="button" onClick={refresh}>Refresh listings ↻</button>
    </header>
    {customer&&<section className="care-jobs-create" aria-labelledby="care-job-form-title"><h2 id="care-job-form-title">Tell caregivers what you need</h2>
      <p>Posts are visible to approved caregivers. Do not share your phone number, email, or exact street address in public job details.</p>
      <form onSubmit={publish}>
        <label>Job title<input required minLength="6" maxLength="100" placeholder="Evening help for my parent" value={draft.title} onChange={e=>edit('title',e.target.value)}/></label>
        <label>Type of support<select value={draft.category} onChange={e=>edit('category',e.target.value)}><option value="caregiver">Caregiving</option><option value="household">Household help</option></select></label>
        <label>City<input required minLength="2" maxLength="100" placeholder="Kathmandu" value={draft.city} onChange={e=>edit('city',e.target.value)}/></label>
        <label>Schedule<select value={draft.schedule} onChange={e=>edit('schedule',e.target.value)}><option value="flexible">Flexible</option><option value="one_time">One-time</option><option value="recurring">Recurring</option></select></label>
        <label>Hourly budget in NPR (optional)<input type="number" min="0" max="1000000" step="1" placeholder="Negotiable" value={draft.hourlyBudget} onChange={e=>edit('hourlyBudget',e.target.value)}/></label>
        <label className="care-jobs-create__description">Describe your care needs<textarea required minLength="10" maxLength="1000" rows="4" placeholder="Tasks, relevant skills and expected schedule" value={draft.description} onChange={e=>edit('description',e.target.value)}/></label>
        <button type="submit" disabled={busy}>{busy?'Publishing…':'Publish job →'}</button>
      </form></section>}
    {notice&&<p role="status" className="care-jobs-notice">{notice}</p>}
    {!list.loading && !list.error && list.jobs.length > 0 && <div className="sewak2-jobs-filters" role="search" aria-label="Filter care jobs">
      <label>Search care jobs<input type="search" value={searchText} maxLength={100} onChange={event=>setSearchText(event.target.value)} placeholder="Search title, area or care need" /></label>
      <label>Support type<select value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value)}><option value="all">All support</option><option value="caregiver">Caregiving</option><option value="household">Household help</option></select></label>
      <span role="status">{visibleJobs.length} of {list.jobs.length} posts</span>
    </div>}
    <section className="care-jobs-results" aria-label={customer?'Your care jobs':'Open care jobs'}>
      <div className="care-jobs-results__head"><h2>{customer?'Your job posts':'Open opportunities'}</h2><p>{list.loading?'Loading…':visibleJobs.length+' posts'}</p></div>
      {list.loading?<p role="status">Loading care jobs…</p>:list.error?<div role="alert"><p>{list.error}</p><button type="button" onClick={refresh}>Try again</button></div>:
        !visibleJobs.length?<div className="saved-care-empty"><p>{list.jobs.length === 0 ? (customer?'No jobs posted yet. Start by describing the help you need.':'There are no open care jobs right now.') : 'No care jobs match your filters. Try a different search.'}</p></div>:
      <div className="care-jobs-grid">{visibleJobs.map(job=><article key={job.id} className="care-job-card">
        <div className="care-job-card__top"><span>{job.category==='household'?'Household support':'Caregiving'}</span><span>{job.status==='open'?'Open':'Closed'}</span></div>
        <h2>{job.title}</h2><p>{job.description}</p>
        <dl><div><dt>City</dt><dd>{job.city}</dd></div><div><dt>Schedule</dt><dd>{job.schedule.replace('_',' ')}</dd></div><div><dt>Budget</dt><dd>{job.hourlyBudget==null?'Negotiable':formatNpr(job.hourlyBudget)+'/hr'}</dd></div></dl>
        {customer?<><div className="care-job-card__actions">
          <button type="button" onClick={()=>setSelected(v=>v===job.id?'':job.id)}>Applications ({job.applicationCount||0})</button>
          {job.status==='open'&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm('Close this job to new applications?'))act(job.id,'close');}}>Close job</button>}
        </div>
        {selected===job.id&&<section className="care-job-applicants" aria-label="Applicants"><div className="care-job-applicants__head"><h3>Applicants</h3><button type="button" onClick={()=>setSelected('')}>Close</button></div>
          {applications.loading?<p role="status">Loading applicants…</p>:applications.error?<p role="alert">{applications.error}</p>:!applications.items.length?<p>No applications yet.</p>:
            applications.items.map(item=><article key={item.id}><strong>{item.caregiverName||'Caregiver'}</strong><small>{item.status}</small><p>{item.message}</p><Link to={'/user/caregivers/'+encodeURIComponent(item.caregiverId)}>View caregiver profile →</Link><Link to={'/user/messages/job/'+encodeURIComponent(job.id)+'?caregiverId='+encodeURIComponent(item.caregiverId)}>Message caregiver →</Link></article>)}
          <p>Review the person’s profile before sending a separate booking request.</p>
        </section>}</>:<div className="care-job-card__actions">
          {job.myApplicationStatus?<><strong className="care-job-applied">Application: {job.myApplicationStatus}</strong>
            {job.myApplicationStatus==='applied'&&<><Link to={'/caregiver/messages/job/'+encodeURIComponent(job.id)}>Message family →</Link><button type="button" disabled={busy} onClick={()=>act(job.id,'withdraw')}>Withdraw</button></>}</>:
          <button type="button" onClick={()=>setApplying(v=>v===job.id?'':job.id)}>Apply</button>}
          {applying===job.id&&<form className="care-job-apply" onSubmit={e=>{e.preventDefault();act(job.id,'apply',{message});}}>
            <label>Introduce yourself<textarea required minLength="20" maxLength="700" rows="4" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Your care experience, suitable shifts and a short introduction. Do not include contact details." /></label>
            <button type="submit" disabled={busy||message.trim().length<20}>{busy?'Sending…':'Send application'}</button>
          </form>}
        </div>}
      </article>)}</div>}
    </section>
  </main>;
}
