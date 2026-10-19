import React, { useEffect, useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loadPublicCareServices, searchCaregivers } from '../caregiverDiscovery';
import CaregiverPreviewCard from './CaregiverPreviewCard';
import './HomeCaregiverMarketplace.css';

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
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
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
    <section id="caregivers" className="home-marketplace" aria-labelledby={headingId}>
      <div className="home-marketplace__intro">
        <div className="home-marketplace__hero-copy">
          <p className="home-marketplace__eyebrow"><span aria-hidden="true">✳</span> THE CARE YOU NEED, CLOSE TO HOME</p>
          <h1 id={headingId}>Find and book a caregiver</h1>
          <p>For your family, your home and every chapter in between. Discover local care professionals and find the right support in Nepal.</p>
          <div className="home-marketplace__quick-categories" aria-label="Explore support categories">
            <Link to="/browse?category=caregiver"><span aria-hidden="true">♡</span> Caregiving</Link>
            <Link to="/browse?category=household"><span aria-hidden="true">⌂</span> Household help</Link>
            <Link to="/browse?workType=parttime"><span aria-hidden="true">◷</span> Flexible shifts</Link>
          </div>
          <p className="home-marketplace__hero-assurance">Browse profiles · Compare services · Request care</p>
        </div>
        <figure className="home-marketplace__hero-visual">
          <img src="/images/care-for-every-generation.webp" alt="Illustration of a Nepali family with caregivers supporting different generations at home" width="1536" height="1024" fetchPriority="high" />
          <figcaption><strong>Care for every generation.</strong><span>Made for life in Nepal.</span></figcaption>
        </figure>
      </div>
      <div className="home-marketplace__search-heading">
        <div><strong>Let's find your care match</strong><span>Start with a name, service or area.</span></div>
        <Link className="home-marketplace__advanced" to="/browse">More search options <span aria-hidden="true">→</span></Link>
      </div>

      <form className="home-marketplace__search" onSubmit={applySearch} role="search" aria-label="Find caregivers on Sewak">
        <label className="home-marketplace__field home-marketplace__field--name">
          <span>Caregiver or area</span>
          <input type="search" name="caregiver" value={draft.text} onChange={event => edit('text', event.target.value)}
            maxLength={160} placeholder="Search names or areas" />
        </label>
        <label className="home-marketplace__field">
          <span>Service</span>
          <select name="service" value={draft.serviceId} onChange={event => edit('serviceId', event.target.value)}>
            <option value="">All services</option>
            {catalogState === 'ready' && services.map(service =>
              <option value={service.id} key={service.id}>{service.label || service.serviceName}</option>)}
            {catalogState !== 'ready' && draft.serviceId &&
              <option value={draft.serviceId}>Selected service</option>}
          </select>
        </label>
        <button className="home-marketplace__filter-toggle" type="button" aria-expanded={moreFiltersOpen}
          aria-controls="home-marketplace-extra-filters" onClick={() => setMoreFiltersOpen(value => !value)}>
          {moreFiltersOpen ? 'Fewer filters' : 'More filters'}
        </button>
        <div id="home-marketplace-extra-filters" className={'home-marketplace__advanced-fields' + (moreFiltersOpen ? ' is-open' : '')}>
          <label className="home-marketplace__field">
            <span>City or locality</span>
            <input type="text" name="location" value={draft.location} onChange={event => edit('location', event.target.value)}
              maxLength={160} placeholder="e.g. Kathmandu" />
          </label>
          <label className="home-marketplace__field">
            <span>Support type</span>
            <select name="category" value={draft.category} onChange={event => edit('category', event.target.value)}>
              <option value="">All support</option>
              <option value="caregiver">Caregiver support</option>
              <option value="household">Household help</option>
            </select>
          </label>
        </div>
        <button className="home-marketplace__submit" type="submit">Find caregivers <span aria-hidden="true">→</span></button>
      </form>
      {catalogState === 'error' && <p className="home-marketplace__catalog-note" role="status">Service choices could not be loaded. You can still search by name, location, or category.</p>}

      <div className="home-marketplace__results-head">
        <div>
          <h2>Caregivers accepting requests</h2>
          <p>{loadingFirst ? 'Loading real caregiver profiles…' :
            result.status === 'error' ? 'Unable to show current results.' :
              totalLabel + ' match' + (result.total === 1 ? 'es' : '') + ' your search.'}</p>
        </div>
        {filtered && <button type="button" className="home-marketplace__clear" onClick={clearSearch}>Clear filters</button>}
      </div>
      <p className="home-marketplace__availability-note">Accepting requests does not guarantee availability at a chosen date or time. Care is confirmed when the caregiver accepts.</p>

      {loadingFirst && <div className="home-marketplace__state" role="status">Finding caregivers who accept requests…</div>}
      {result.status === 'error' && <div className="home-marketplace__state" role="status">
        <p>{result.error}</p>
        <button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button>
      </div>}
      {result.status === 'ready' && !result.caregivers.length && <div className="home-marketplace__state">
        <p>{filtered ? 'No caregivers match these filters right now. Try another service or city.' : 'No caregivers are accepting requests right now. Please check again soon.'}</p>
        {filtered && <button type="button" onClick={clearSearch}>Show all available caregivers</button>}
      </div>}

      {result.caregivers.length > 0 && <div data-testid="home-caregiver-results" className={'home-marketplace__grid' + (result.caregivers.length === 1 ? ' home-marketplace__grid--single' : '')}
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
