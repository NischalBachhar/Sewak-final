import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, getDocs, collection } from './d1Client';
import { db } from './d1Client';
import useSavedCare from './useSavedCare';
import CaregiverPreviewCard from './components/CaregiverPreviewCard';
import { SkeletonCard } from './components/CareExperience';
import './MarketplaceExpansion.css';

export default function SavedCarePage() {
  const { saved } = useSavedCare();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, items: [], services: [], error: '' });
  const key = saved.join('|');
  useEffect(() => {
    let active = true;
    if (!saved.length) { setState({ loading: false, items: [], services: [], error: '' }); return () => { active = false; }; }
    setState(old => ({ ...old, loading: true, error: '' }));
    Promise.all([
      Promise.allSettled(saved.map(id => getDoc(doc(db, 'publicCaregivers', id)))),
      getDocs(collection(db, 'publicServices')).catch(() => null),
    ]).then(([results, catalog]) => {
      if (!active) return;
      const items = results.flatMap(result => result.status === 'fulfilled' && result.value.exists()
        ? [{ id: result.value.id, ...result.value.data() }] : []);
      const services = catalog?.docs?.map(row => ({ id: row.id, ...row.data() })) || [];
      setState({ loading: false, items, services, error: results.every(result => result.status === 'rejected') ? 'Saved profiles could not be loaded right now.' : '' });
    }).catch(() => { if (active) setState({ loading: false, items: [], services: [], error: 'Unable to load saved profiles.' }); });
    return () => { active = false; };
    // String key captures identity changes without treating array identity as a dependency.
  }, [key]);
  return <main className="saved-care-page" id="main-content">
    <header className="saved-care-heading">
      <p className="saved-care-eyebrow">YOUR SHORTLIST</p>
      <h1>Saved caregivers</h1>
      <p>Keep track of care professionals you want to compare. Saved profiles are stored on this device only, not yet synced across your accounts or devices.</p>
      <Link to="/user" className="saved-care-explore">Explore more caregivers <span aria-hidden="true">→</span></Link>
    </header>
    {state.loading ? <div className="saved-care-grid" aria-busy="true"><SkeletonCard label="Loading saved caregivers" /><SkeletonCard label="Loading saved caregivers" /></div> :
      state.error ? <p className="saved-care-empty" role="alert">{state.error}</p> :
      !state.items.length ? <div className="saved-care-empty"><h2>No saved caregivers yet</h2><p>When you find a profile you like, select Save to add it to your shortlist. Unavailable or unpublished profiles will not appear here.</p><Link to="/user">Find caregivers</Link></div> :
      <><p className="saved-care-count" role="status">{state.items.length} available {state.items.length === 1 ? 'profile' : 'profiles'} in your shortlist</p>
        <div className="saved-care-grid">{state.items.map(person => <CaregiverPreviewCard key={person.id} caregiver={person} services={state.services}
          onViewProfile={() => navigate('/user/caregivers/' + encodeURIComponent(person.id))}
          onSelect={() => navigate('/user/book/' + encodeURIComponent(person.id))} compact />)}</div></>}
  </main>;
}
