import React, { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadPublicCareServices, searchCaregivers } from '../caregiverDiscovery';
import CaregiverPreviewCard from './CaregiverPreviewCard';

// A bounded page of the same public search used by Find Care. No private reads.
export default function CaregiverPreview({ signedIn = false }) {
  const navigate = useNavigate();
  const headingId = useId();
  const [state, setState] = useState({ status: 'loading', caregivers: [], services: [] });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ status: 'loading', caregivers: [], services: [] });
    Promise.all([searchCaregivers({}, { limit: 3 }), loadPublicCareServices()])
      .then(([result, services]) => {
        if (active) setState({ status: 'ready', caregivers: result.items.map(item => ({ ...item.data, id: item.id })), services });
      })
      .catch(() => { if (active) setState({ status: 'error', caregivers: [], services: [] }); });
    return () => { active = false; };
  }, [attempt]);

  return <section className={`caregiver-preview${signedIn ? ' caregiver-preview--customer' : ' home-section'}`} aria-labelledby={headingId}>
    <div className="caregiver-preview__heading">
      <div><h2 id={headingId}>{signedIn ? 'Explore Caregivers' : 'Meet Sewak Care Professionals'}</h2>
        <p>Compare real profiles. Your preferred visit is confirmed after the caregiver accepts.</p></div>
      <Link to={signedIn ? '/user' : '/browse'}>{signedIn ? 'View All' : 'View All Caregivers'} <span aria-hidden="true">→</span></Link>
    </div>
    {state.status === 'loading' && <p className="caregiver-preview__state" role="status">Loading caregiver profiles…</p>}
    {state.status === 'error' && <div className="caregiver-preview__state" role="alert"><p>We couldn’t load caregiver profiles. Please try again.</p><button type="button" className="browse-card-action browse-card-action--secondary" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
    {state.status === 'ready' && !state.caregivers.length && <p className="caregiver-preview__state">No care professionals are accepting requests here yet. Check back soon or explore Find Care.</p>}
    {state.status === 'ready' && state.caregivers.length > 0 && <div className="caregiver-preview__grid">
      {state.caregivers.map(caregiver => <CaregiverPreviewCard key={caregiver.id} caregiver={caregiver} services={state.services} compact requireLogin={!signedIn}
        onViewProfile={profile => navigate(`${signedIn ? '/user' : ''}/caregivers/${encodeURIComponent(profile.id)}`)}
        onSelect={profile => navigate(`/user/book/${encodeURIComponent(profile.id)}`)} />)}
    </div>}
  </section>;
}
