import React, { useEffect, useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loadPublicCareServices, searchCaregivers } from '../caregiverDiscovery';
import CaregiverPreviewCard from './CaregiverPreviewCard';
import { CareHeroMedia } from './CareHeroMedia';
import { publicServiceChoices } from '../serviceCatalog';

// This is the homepage's primary experience, not a promotional carousel.
// Queries use the same server-authorized public projection and booking routes as Find Care.
const PAGE_SIZE = 9;
const emptyFields = () => ({ text: '', category: '', serviceId: '', location: '' });
const searchFields = fields => Object.fromEntries(
  Object.entries(fields).filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([key, value]) => [key, value.trim()])
);
const rowsFrom = result => (result.items || []).map(item => ({ ...item.data, id: item.id }));

export default function HomeCaregiverMarketplace() {
  const navigate = useNavigate();
  const location = useLocation();
  const headingId = useId();
  const urlService = new URLSearchParams(location.search).get('service') || '';
  const [draft, setDraft] = useState(() => ({ ...emptyFields(), serviceId: urlService }));
  const [filters, setFilters] = useState(() => searchFields({ ...emptyFields(), serviceId: urlService }));
  const [services, setServices] = useState([]);
  const [catalogState, setCatalogState] = useState('loading');
  const [cursor, setCursor] = useState(null);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState({ status: 'loading', caregivers: [], nextCursor: null, total: 0, error: '' });

  useEffect(() => {
    let active = true;
    loadPublicCareServices().then(items => {
      if (!active) return;
      setServices(items);
      setCatalogState('ready');
    }).catch(() => { if (active) setCatalogState('error'); });
    return () => { active = false; };
  }, []);

  // A service card farther down this same homepage reopens this first,
  // bookable section with the selected service. No second listing page.
  useEffect(() => {
    setDraft({ ...emptyFields(), serviceId: urlService });
    setFilters(previous => (previous.serviceId || '') === urlService && Object.keys(previous).length <= (urlService ? 1 : 0)
      ? previous : searchFields({ ...emptyFields(), serviceId: urlService }));
    setCursor(null);
  }, [urlService]);

  useEffect(() => {
    let active = true;
    setResult(previous => ({
      ...previous,
      status: 'loading',
      error: '',
      caregivers: cursor ? previous.caregivers : [],
    }));
    searchCaregivers(filters, { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) })
      .then(response => {
        if (!active) return;
        const fetched = rowsFrom(response);
        setResult(previous => {
          const earlier = cursor ? previous.caregivers : [];
          const ids = new Set(earlier.map(caregiver => caregiver.id));
          return {
            status: 'ready',
            caregivers: [...earlier, ...fetched.filter(caregiver => !ids.has(caregiver.id))],
            total: Number(response.total) || 0,
            nextCursor: response.nextCursor || null,
            error: '',
          };
        });
      })
      .catch(() => {
        if (active) setResult(previous => ({
          ...previous, status: 'error', error: 'Caregiver profiles could not be loaded. Please retry.',
        }));
      });
    return () => { active = false; };
  }, [filters, cursor, retry]);

  const edit = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const applySearch = event => {
    event.preventDefault();
    setCursor(null);
    setFilters(searchFields(draft));
    setRetry(value => value + 1);
    window.requestAnimationFrame(() => document.getElementById('home-caregiver-results-heading')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }));
  };
  const clearSearch = () => {
    setDraft(emptyFields());
    setCursor(null);
    setFilters({});
    setRetry(value => value + 1);
    if (urlService) navigate('/', { replace: true });
  };
  const filtered = Object.keys(filters).length > 0;
  const loadingFirst = result.status === 'loading' && !cursor;
  const totalLabel = result.total === 1 ? '1 care professional' : result.total + ' care professionals';
  const canLoadMore = result.status === 'ready' && Boolean(result.nextCursor);

  return (
    <section id="caregivers" className="marketplace-home" aria-label="Find and book a caregiver">
      <div className="care-search-hero">
        <CareHeroMedia alt="Caregiver supporting an older adult at home" />
        <div className="care-search-hero__content">
          <p className="care-eyebrow">Care, close to home</p>
          <h1 id={headingId}>The right care. <br />Right here.</h1>
          <p className="care-search-hero__description">Find care and household help for the people you love.</p>
          <form className="care-hero-search" onSubmit={applySearch} role="search" aria-label="Find caregivers on Sewak">
            <label><span>Service</span><select name="service" value={draft.serviceId} onChange={event => edit('serviceId', event.target.value)}>
              <option value="">All services</option>
              {catalogState === 'ready' && publicServiceChoices(services).map(service => <option value={service.id} key={service.id}>{service.label || service.serviceName}</option>)}
              {draft.serviceId && !publicServiceChoices(services).some(item => item.id === draft.serviceId) && <option value={draft.serviceId}>Selected service</option>}
            </select></label>
            <label><span>City or locality</span><input type="text" name="location" value={draft.location} onChange={event => edit('location', event.target.value)} maxLength={160} placeholder="e.g. Hetauda" /></label>
            <button className="care-primary-button" type="submit">Find caregivers <span aria-hidden="true">→</span></button>
          </form>
          <p className="care-search-hero__assurance">Real profiles. Published NPR rates. Care for every generation.</p>
        </div>
      </div>
      {catalogState === 'error' && <p className="home-marketplace__catalog-note" role="status">Service choices could not be loaded. You can still search by name, location, or category.</p>}

      <div className="marketplace-results-heading" id="home-caregiver-results-heading">
        <div>
          <h2>Meet your care partner</h2>
          <p>{loadingFirst ? 'Loading real caregiver profiles…' :
            result.status === 'error' ? 'Unable to show current results.' :
              totalLabel + ' match' + (result.total === 1 ? 'es' : '') + ' your search.'}</p>
        </div>
        <Link className="care-profile-link" to="/browse">All filters <span aria-hidden="true">→</span></Link>
        {filtered && <button type="button" className="home-marketplace__clear" onClick={clearSearch}>Clear filters</button>}
      </div>
      <p className="marketplace-availability-note">Send a request to check your dates. Care is confirmed after the caregiver accepts.</p>

      {loadingFirst && <div className="home-marketplace__state" role="status">Finding caregivers who accept requests…</div>}
      {result.status === 'error' && <div className="home-marketplace__state" role="status">
        <p>{result.error}</p>
        <button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button>
      </div>}
      {result.status === 'ready' && !result.caregivers.length && <div className="home-marketplace__state">
        <p>{filtered ? 'No caregivers match these filters right now. Try another service or city.' : 'No caregivers are accepting requests right now. Please check again soon.'}</p>
        {filtered && <button type="button" onClick={clearSearch}>Show all available caregivers</button>}
      </div>}

      {result.caregivers.length > 0 && <div data-testid="home-caregiver-results" className={'marketplace-caregiver-results' + (result.caregivers.length === 1 ? ' marketplace-caregiver-results--single' : '')}
        aria-busy={result.status === 'loading'}>
        {result.caregivers.map(caregiver => <CaregiverPreviewCard
          key={caregiver.id} caregiver={caregiver} services={services} compact requireLogin
          onViewProfile={profile => navigate('/caregivers/' + encodeURIComponent(profile.id))}
          onSelect={profile => navigate('/user/book/' + encodeURIComponent(profile.id))}
        />)}
      </div>}

      {result.status === 'loading' && cursor && <p className="home-marketplace__paging-state" role="status">Loading more caregivers…</p>}
      {canLoadMore && <div className="home-marketplace__footer-actions">
        <button type="button" className="home-marketplace__more" onClick={() => setCursor(result.nextCursor)}>Show more caregivers</button>
      </div>}
    </section>
  );
}
