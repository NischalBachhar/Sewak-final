import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CaregiverListPage from './CaregiverListPage';
import PublicHeader from './components/PublicHeader';
import PublicFooter from './components/PublicFooter';
import './BrowsePage.css';

export default function BrowsePage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const [category, setCategory] = useState(params.get('category') || '');
  const [workType, setWorkType] = useState(params.get('workType') || '');
  const [shift, setShift] = useState('');
  useEffect(() => {
    const next = new URLSearchParams(search);
    setCategory(['caregiver', 'household', 'both'].includes(next.get('category')) ? next.get('category') : '');
    setWorkType(['fulltime', 'parttime'].includes(next.get('workType')) ? next.get('workType') : '');
    setShift('');
  }, [search]);
  return <div className="marketplace-browse">
    <PublicHeader />
    <main id="main-content" className="marketplace-browse__main">
      <header className="marketplace-browse__intro"><p className="care-eyebrow">Find care near you</p><h1>A little help. The right person.</h1><p>Compare real profiles, published rates and experience. Request the dates that work for you.</p></header>
      <section id="browse-caregiver-results" aria-label="Caregiver search results">
        <CaregiverListPage variant="browse" requireLogin userCategory={category} preselectedWorkType={workType} preselectedShift={shift}
          preselectedService={params.get('service') || ''} preselectedLocation={params.get('location') || ''}
          onChangeUserCategory={setCategory} onChangeWorkType={setWorkType} onChangeShift={setShift}
          onSelectCaregiver={caregiver => navigate('/caregivers/' + encodeURIComponent(caregiver.id) + '?request=1#request-care')} />
      </section>
    </main>
    <PublicFooter />
  </div>;
}
