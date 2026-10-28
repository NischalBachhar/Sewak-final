import React, { useEffect, useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loadPublicCareServices, searchCaregivers } from '../caregiverDiscovery';
import CaregiverPreviewCard from './CaregiverPreviewCard';
import { CareHeroMedia } from './CareHeroMedia';
import { publicServiceChoices } from '../serviceCatalog';
import { careSearchPath, readCareSearch } from '../careSearchNavigation';
import { SkeletonCard } from './CareExperience';

// This is the homepage's primary experience, not a promotional carousel.
// Queries use the same server-authorized public projection and booking routes as Find Care.
const PAGE_SIZE = 9;
const emptyFields = () => ({ text: '', category: '', serviceId: '', location: '' });
const searchFields = fields => Object.fromEntries(
  Object.entries(fields).filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([key, value]) => [key, value.trim()])
);
const rowsFrom = result => (result.items || []).map(item => ({ ...item.data, id: item.id }));
const homepageFilters = search => {
  const { serviceId, category, location } = readCareSearch(search);
  return searchFields({ serviceId, category, location });
};

export default function HomeCaregiverMarketplace() {
  const navigate = useNavigate();
  const location = useLocation();
  const headingId = useId();
  const urlFilterKey = JSON.stringify(homepageFilters(location.search));
  const [draft, setDraft] = useState(() => ({ ...emptyFields(), ...homepageFilters(location.search) }));
  const [filters, setFilters] = useState(() => homepageFilters(location.search));
  const [services, setServices] = useState([]);
  const [catalogState, setCatalogState] = useState('loading');
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [cursor, setCursor] = useState(null);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState({ status: 'loading', caregivers: [], nextCursor: null, total: 0, error: '' });

  useEffect(() => {
    let active = true;
    setCatalogState('loading');
    loadPublicCareServices().then(items => {
      if (!active) return;
      setServices(items);
      setCatalogState('ready');
    }).catch(() => { if (active) setCatalogState('error'); });
    return () => { active = false; };
  }, [catalogRetry]);

  // A service card farther down this same homepage reopens this first,
  // bookable section with the selected service. No second listing page.
  useEffect(() => {
    const next = JSON.parse(urlFilterKey);
    setDraft({ ...emptyFields(), ...next });
    setFilters(previous => JSON.stringify(previous) === urlFilterKey ? previous : next);
    setCursor(null);
  }, [urlFilterKey]);

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
  const updateSearch = fields => {
    const { serviceId, category, location: city } = fields;
    const next = searchFields({ serviceId, category, location: city });
    setDraft({ ...emptyFields(), ...next });
    setCursor(null);
    setFilters(next);
    setRetry(value => value + 1);
    navigate(careSearchPath('/', next, 'home-caregiver-results-heading'), { replace: true });
    window.requestAnimationFrame(() => {
      const heading = document.getElementById('home-caregiver-results-heading');
      heading?.querySelector('h2')?.focus?.({ preventScroll: true });
      heading?.scrollIntoView?.({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  };
  const applySearch = event => {
    event.preventDefault();
    updateSearch(draft);
  };
  const clearSearch = () => updateSearch({});
  const removeFilter = key => updateSearch({ ...filters, [key]: '' });
  const filtered = Object.keys(filters).length > 0;
  const loadingFirst = result.status === 'loading' && !cursor;
  const totalLabel = result.total === 1 ? '1 care professional' : result.total + ' care professionals';
  const canLoadMore = result.status === 'ready' && Boolean(result.nextCursor);
  const selectedService = publicServiceChoices(services).find(item => item.id === filters.serviceId);
  const activeFilters = [
    filters.serviceId && { key: 'serviceId', label: selectedService?.label || selectedService?.serviceName || 'Selected service' },
    filters.category && { key: 'category', label: filters.category === 'household' ? 'Household help' : filters.category === 'both' ? 'Care and household help' : 'Caregiver support' },
    filters.location && { key: 'location', label: filters.location },
  ].filter(Boolean);

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
      {catalogState === 'error' && <p className="home-marketplace__catalog-note" role="status">Service choices could not be loaded. You can still search by city or locality. <button type="button" onClick={() => setCatalogRetry(value => value + 1)}>Retry services</button></p>}

      <div className="marketplace-results-heading" id="home-caregiver-results-heading">
        <div>
          <h2 tabIndex={-1}>Meet your care partner</h2>
          <p role="status" aria-atomic="true">{loadingFirst ? 'Finding caregivers who accept requests…' :
            result.status === 'error' ? 'Unable to show current results.' :
              totalLabel + ' match' + (result.total === 1 ? 'es' : '') + ' your search.'}</p>
        </div>
        <div className="marketplace-results-actions"><Link className="care-profile-link" to={careSearchPath('/browse', filters)}>All filters <span aria-hidden="true">→</span></Link>
          {filtered && <button type="button" className="home-marketplace__clear" onClick={clearSearch}>Clear filters</button>}</div>
      </div>
      {filtered && <div className="marketplace-active-filters" role="group" aria-label="Active search filters">{activeFilters.map(({ key, label }) => <button key={key} type="button" onClick={() => removeFilter(key)} aria-label={'Remove filter: ' + label}>{label}<span aria-hidden="true">×</span></button>)}</div>}
      <p className="marketplace-availability-note">Send a request to check your dates. Care is confirmed after the caregiver accepts.</p>

      {loadingFirst && <div className="marketplace-caregiver-results" aria-hidden="true"><SkeletonCard variant="caregiver" label="Loading caregiver profile" /></div>}
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
          searchReturnTo={careSearchPath('/', filters, 'home-caregiver-results-heading')}
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
