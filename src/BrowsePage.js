import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CaregiverListPage from './CaregiverListPage';
import PublicHeader from './components/PublicHeader';
import PublicFooter from './components/PublicFooter';
import { readCareSearch } from './careSearchNavigation';
import './BrowsePage.css';

export default function BrowsePage() {
  const navigate = useNavigate();
  const { search, hash } = useLocation();
  const filters = readCareSearch(search);
  const [category, setCategory] = useState(filters.category || '');
  const [workType, setWorkType] = useState(filters.workType || '');
  const [shift, setShift] = useState(filters.shift || '');
  useEffect(() => {
    const next = readCareSearch(search);
    setCategory(next.category || '');
    setWorkType(next.workType || '');
    setShift(next.shift || '');
  }, [search]);
  useEffect(() => {
    if (hash === '#browse-caregiver-results') document.getElementById('browse-caregiver-results')?.scrollIntoView?.({ block: 'start' });
  }, [hash]);
  return <div className="marketplace-browse">
    <PublicHeader />
    <main id="main-content" className="marketplace-browse__main">
      <header className="marketplace-browse__intro"><p className="care-eyebrow">Find care near you</p><h1>A little help. The right person.</h1><p>Compare real profiles, published rates and experience. Request the dates that work for you.</p></header>
      <section id="browse-caregiver-results" aria-label="Caregiver search results">
        <CaregiverListPage variant="browse" requireLogin userCategory={category} preselectedWorkType={workType} preselectedShift={shift}
          preselectedService={filters.serviceId || ''} preselectedLocation={filters.location || ''}
          preselectedText={filters.text || ''} preselectedExperience={filters.minimumExperience || ''}
          preselectedRating={filters.minimumRating || ''} preselectedVerified={filters.verifiedOnly || false}
          onChangeUserCategory={setCategory} onChangeWorkType={setWorkType} onChangeShift={setShift}
          onSelectCaregiver={caregiver => navigate('/caregivers/' + encodeURIComponent(caregiver.id) + '?request=1#request-care')} />
      </section>
    </main>
    <PublicFooter />
  </div>;
}
