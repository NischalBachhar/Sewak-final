import React from 'react';


// Presentation-only action hub. The owning dashboard supplies current counts and
// routes all commands through its existing role-scoped navigation and permissions.
const CARDS = {
  user: [
    { id:'find', number:'01', tag:'FIND CARE', title:'Discover care nearby', detail:'Compare real caregiver profiles, hourly prices and the services that fit your family.', icon:'search' },
    { id:'bookings', number:'02', tag:'MY BOOKINGS', title:'Keep plans in one place', detail:'See requests, confirmed appointments and completed care without losing track.', icon:'calendar' },
    { id:'inbox', number:'03', tag:'STAY CONNECTED', title:'Talk with your caregiver', detail:'Continue conversations about care requests and schedules in your private inbox.', icon:'message' },
  ],
  caregiver: [
    { id:'jobs', number:'01', tag:'CARE REQUESTS', title:'Manage new bookings', detail:'Review real requests and decide whether you can accept the work.', icon:'calendar' },
    { id:'opportunities', number:'02', tag:'FIND WORK', title:'Discover open jobs', detail:'Explore posted opportunities from families and send applications.', icon:'search' },
    { id:'availability', number:'03', tag:'YOUR SCHEDULE', title:'Set your availability', detail:'Manage working hours, time off and upcoming appointments.', icon:'clock' },
  ],
  organization: [
    { id:'caregivers', number:'01', tag:'YOUR TEAM', title:'Manage care professionals', detail:'Review your team and keep their approved profiles up to date.', icon:'people' },
    { id:'bookings', number:'02', tag:'CARE DELIVERY', title:'Coordinate bookings', detail:'View requests and care sessions assigned to your organization.', icon:'calendar' },
    { id:'services', number:'03', tag:'YOUR OFFERINGS', title:'Publish care services', detail:'Maintain accurate service offerings and prices for families.', icon:'heart' },
  ],
  admin: [
    { id:'verification', number:'01', tag:'TRUST & SAFETY', title:'Review verification', detail:'Examine submitted evidence before making an authorized decision.', icon:'shield' },
    { id:'caregivers', number:'02', tag:'CARE PROFESSIONALS', title:'Review caregivers', detail:'Manage pending approvals and access real provider records.', icon:'people' },
    { id:'organizations', number:'03', tag:'PLATFORM OPERATIONS', title:'Manage organizations', detail:'Review organization applications, moderation and account status.', icon:'calendar' },
  ],
};
const PATHS={
  search:<><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15l2.5 2.5L16 13"/></>,
  message:<><path d="M21 11.5c0 4.8-4 8.5-9 8.5a10 10 0 0 1-4.7-1.2L3 20l1.3-4.1A8 8 0 0 1 3 11.5C3 6.7 7 3 12 3s9 3.7 9 8.5Z"/><path d="M8 11.5h8"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
  people:<><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-4 2.5-6.5 6.5-6.5s6.5 2.5 6.5 6.5M17 5.5a3 3 0 0 1 0 5.7M17.5 14c2.7.6 4 2.6 4 6"/></>,
  heart:<path d="M20.2 5a5.2 5.2 0 0 0-7.4 0L12 6l-.8-1A5.2 5.2 0 0 0 3.8 12.5L12 21l8.2-8.5A5.2 5.2 0 0 0 20.2 5Z"/>,
  shield:<><path d="m12 2 8 3v7c0 4-3 8-8 10-5-2-8-6-8-10V5z"/><path d="m8.5 12 2.5 2.5 4.8-5"/></>,
};
function Picture({icon}) {return <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{PATHS[icon]||PATHS.heart}</svg>;}
export default function Sewak2ActionCenter({role, onAction, metrics=[]}) {
  const cards=CARDS[role];
  if(!cards || typeof onAction!=='function') return null;
  return <section className={'sewak2-hub sewak2-hub--'+role} aria-label="Quick actions">
    <div className="sewak2-hub__head">
      <div><p className="sewak2-hub__eyebrow">YOUR SEWAK 2.0 WORKSPACE</p><h2>{role==='user'?'Care starts here.':role==='caregiver'?'Make every workday count.':role==='organization'?'A simpler way to run care.':'Your next action matters.'}</h2>
        <p>Choose what you need. All changes are made through your existing secure account workflows.</p>
      </div>
      <span className="sewak2-hub__flower" aria-hidden="true">✳</span>
    </div>
    {metrics.length>0 && <dl className="sewak2-hub__metrics">{metrics.map(({label,value})=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    <div className="sewak2-hub__grid">{cards.map(card=><button className="sewak2-hub__card" type="button" key={card.id} onClick={()=>onAction(card.id)}>
      <span className="sewak2-hub__top"><span className="sewak2-hub__icon"><Picture icon={card.icon}/></span><span className="sewak2-hub__number">{card.number}</span></span>
      <span className="sewak2-hub__tag">{card.tag}</span>
      <strong>{card.title}</strong><span className="sewak2-hub__detail">{card.detail}</span><span className="sewak2-hub__go">Open <span aria-hidden="true">↗</span></span>
    </button>)}</div>
  </section>;
}
