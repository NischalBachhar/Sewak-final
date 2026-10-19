import React, { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { apiRequest } from "../apiClient";
import { formatNpr } from "../config/brand";
import { hasVerifiedRating } from "../bookingModel";
import { SkeletonCard, VerificationBadge } from "./CareExperience";
import ProfileImage from "./ProfileImage";
import RequestAvailability from "./RequestAvailability";
import { caregiverBookingReason } from "../caregiverDiscovery";
import "./CaregiverPreview.css";
const defaults = {
  category: "",
  location: "",
  serviceId: "",
  availability: "accepting",
  verifiedOnly: false,
  min: "",
  max: ""
};
const configuredRate = person => typeof person.hourlyRate === "number" && Number.isFinite(person.hourlyRate) && (person.hourlyRate > 0 || (person.hourlyRate === 0 && person.allowZeroRate === true));
export default function CustomerCareDiscovery() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(defaults);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [savedIds, setSavedIds] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('sewak.savedCaregivers.v1') || '[]');
      return Array.isArray(stored) ? stored.filter(id => typeof id === 'string').slice(0, 100) : [];
    } catch { return []; }
  });
  const toggleSaved = id => {
    const next = savedIds.includes(id) ? savedIds.filter(saved => saved !== id) : [...savedIds, id].slice(-100);
    setSavedIds(next);
    try { window.localStorage.setItem('sewak.savedCaregivers.v1', JSON.stringify(next)); } catch {}
  };
  const [services, setServices] = useState([]);
  const [catalogError, setCatalogError] = useState(false);
  const [result, setResult] = useState({
    loading: true,
    error: "",
    items: [],
    total: 0,
    nextCursor: null
  });
  const [cursor, setCursor] = useState(null);
  const [retry, setRetry] = useState(0);
  const [shown, setShown] = useState(6);
  const update = (key, value) => {
    setCursor(null);
    setShown(6);
    setFilters(current => ({
      ...current,
      [key]: value,
      ...(key === "category" ? {
        serviceId: ""
      } : {})
    }));
  };
  const reset = () => {
    setFilters(defaults);
    setCursor(null);
    setShown(6);
  };
  const invalidPrice = filters.min !== "" && filters.max !== "" && Number(filters.min) > Number(filters.max);
  const key = JSON.stringify(filters);
  useEffect(() => {
    let active = true;
    setCatalogError(false);
    (async () => {
      try {
        let page,
          next,
          items = [];
        do {
          page = await apiRequest("/api/query", {
            method: "POST",
            json: {
              path: "publicServices",
              limit: 50,
              ...(next ? {
                cursor: next
              } : {})
            }
          });
          if (!active) return;
          items.push(...page.items.map(item => ({
            id: item.id,
            ...item.data
          })));
          next = page.nextCursor;
        } while (next);
        setServices(items);
      } catch {
        if (active) setCatalogError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [retry]);
  useEffect(() => {
    let active = true;
    setResult({
      loading: true,
      error: "",
      items: [],
      total: 0,
      nextCursor: null
    });
    const timer = setTimeout(async () => {
      const {
        min,
        max,
        availability,
        ...search
      } = JSON.parse(key);
      if (min !== "" && max !== "" && Number(min) > Number(max)) return;
      const priceFilter = min !== "" || max !== "";
      const localFilter = priceFilter || availability !== "accepting";
      try {
        let page,
          next = cursor,
          items = [];
        do {
          page = await apiRequest("/api/query", {
            method: "POST",
            json: {
              path: "publicCaregivers",
              ...(availability === "accepting" ? { search } : availability === "unavailable" ? { filters: [{ field: "isAvailable", op: "==", value: false }] } : {}),
              limit: localFilter ? 50 : 6,
              ...(next ? {
                cursor: next
              } : {})
            }
          });
          if (!active) return;
          items.push(...page.items.map(item => ({
            id: item.id,
            ...item.data
          })));
          next = page.nextCursor;
        // Hourly ranges are a presentation filter. Scan every matching page
        // before filtering so a later-page caregiver is never silently omitted.
        // Other filters and eligibility remain authoritative in the Worker.
        } while (localFilter && next);
        if (availability !== "accepting") items = items.filter(person =>
          (!search.category || person.category === "both" || (person.category === "vendor" ? "household" : person.category) === search.category) &&
          (!search.location || String(person.location || "").toLowerCase().includes(search.location.trim().toLowerCase())) &&
          (!search.serviceId || person.servicesOffered?.includes(search.serviceId)) &&
          (!search.verifiedOnly || (person.verificationSource === "audited_v1" && person.verified === true))
        );
        if (priceFilter) items = items.filter(person => configuredRate(person) && (min === "" || person.hourlyRate >= Number(min)) && (max === "" || person.hourlyRate <= Number(max)));
        setResult({
          loading: false,
          error: "",
          items,
          total: localFilter ? items.length : page.total,
          nextCursor: next
        });
      } catch {
        if (active) setResult({
          loading: false,
          error: "Caregiver profiles could not be loaded. Please try again.",
          items: [],
          total: 0,
          nextCursor: null
        });
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, cursor, retry]);
  const visibleServices = services.filter(service => !filters.category || service.category === "both" || (service.category === "vendor" ? "household" : service.category) === filters.category);
  return <section className="home-discovery sewak-customer-discovery" aria-label="Find caregivers">
      <div className="sewak-customer-search-head">
        <div><p className="sewak-customer-eyebrow">EXPLORE REAL PROFILES</p><h2>Caregivers to consider</h2><p>Use the search options to discover professionals who fit your needs.</p></div>
        <button type="button" className="sewak-customer-filter-toggle" aria-expanded={advancedOpen} aria-controls="sewak-customer-advanced" onClick={() => setAdvancedOpen(v => !v)}>{advancedOpen ? 'Hide extra filters' : 'More filters'} <span aria-hidden="true">☷</span></button>
      </div>
      <div className="home-filters" role="search" aria-label="Caregiver filters">
        <label>Category<select value={filters.category} onChange={event => update("category", event.target.value)}><option value="">All care & help</option><option value="caregiver">Caregiver support</option><option value="household">Household help</option></select></label>
        <label>City or location<input type="search" maxLength={160} placeholder="Search city or area" value={filters.location} onChange={event => update("location", event.target.value)} /></label>
        <label>Service type<select value={filters.serviceId} onChange={event => update("serviceId", event.target.value)} disabled={catalogError}><option value="">All services</option>{visibleServices.map(service => <option key={service.id} value={service.id}>{service.label || service.serviceName}</option>)}</select></label>
        <div id="sewak-customer-advanced" className={'sewak-customer-advanced' + (advancedOpen ? ' is-open' : '')}>
        <fieldset className="home-price"><legend>Hourly price · NPR</legend><input type="number" min="0" max="1000000" aria-label="Minimum hourly price" placeholder="Min" value={filters.min} onChange={event => update("min", event.target.value)} /><span aria-hidden="true">–</span><input type="number" min="0" max="1000000" aria-label="Maximum hourly price" placeholder="Max" value={filters.max} onChange={event => update("max", event.target.value)} /></fieldset>
        <div className="home-filter-extras"><label>Requests<select value={filters.availability} onChange={event => update("availability", event.target.value)}><option value="accepting">Accepting requests</option><option value="all">All profiles</option><option value="unavailable">Not accepting requests</option></select></label><label className="home-verified"><input type="checkbox" checked={filters.verifiedOnly} onChange={event => update("verifiedOnly", event.target.checked)} />Verified by Sewak only</label><button type="button" className="customer-text-link" onClick={reset}>Clear filters</button></div>
        </div>
      </div>
      {catalogError && <p role="status">Service options could not be loaded. Other filters still work. <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
      <div className="sewak-saved-note">{savedIds.length ? savedIds.length + ' caregiver profile(s) saved on this device' : 'Tap the heart on any profile to save it on this device.'}</div>
      <div className="home-results-heading"><p role="status">{invalidPrice ? "Minimum price must not exceed maximum price." : result.loading ? "Finding caregivers…" : result.error ? "Search unavailable" : `${result.total} ${result.total === 1 ? "caregiver matches" : "caregivers match"}`}</p><Link to="/user">Find All Caregivers <span aria-hidden="true">&rarr;</span></Link></div>
      {!invalidPrice && (result.loading ? <div className="home-caregiver-grid" aria-busy="true">{[0, 1, 2].map(id => <SkeletonCard key={id} variant="caregiver" label="Loading caregiver profile" />)}</div> : result.error ? <div className="home-discovery-state" role="alert"><p>{result.error}</p><button type="button" className="customer-action customer-action--outline" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : !result.items.length ? <div className="home-discovery-state"><h2>No caregivers match your filters</h2><p>Try another location, service or price range.</p><button type="button" className="customer-action customer-action--outline" onClick={reset}>Reset filters</button></div> : <>
        <div className="home-caregiver-grid">{result.items.slice(0, shown).map(person => {
          const verified = person.verificationSource === "audited_v1" && person.verified === true;
          const bookable = !caregiverBookingReason(person);
          const labels = (person.servicesOffered || []).map(id => services.find(service => service.id === id)).filter(Boolean).map(service => service.label || service.serviceName).filter(Boolean);
          return <article className="home-caregiver" key={person.id}>
            <div className="home-caregiver-identity"><ProfileImage className="home-caregiver-photo" src={person.profileImage || ""} alt={person.name || "Caregiver"} fallback={<span className="home-caregiver-photo home-caregiver-initial">{String(person.name || "C").charAt(0)}</span>} /><div><h2>{person.name || "Caregiver"}</h2><p>{person.location || "Location not listed"}</p></div><button type="button" className={'sewak-caregiver-save' + (savedIds.includes(person.id) ? ' is-saved' : '')} aria-label={(savedIds.includes(person.id) ? 'Remove ' : 'Save ') + (person.name || 'caregiver') + (savedIds.includes(person.id) ? ' from saved caregivers' : ' to this device')} aria-pressed={savedIds.includes(person.id)} onClick={() => toggleSaved(person.id)}>{savedIds.includes(person.id) ? '♥' : '♡'}</button></div>
            <p className="home-caregiver-category">{person.category === "both" ? "Caregiver & household help" : ["vendor", "household"].includes(person.category) ? "Household help" : "Caregiver support"}{person.organizationName ? ` · ${person.organizationName}` : " · Independent"}</p>
            <div className="home-caregiver-checks"><VerificationBadge state={verified ? "verified" : "not_verified"} label={verified ? "Verified by Sewak" : "Verification not complete"} compact /><RequestAvailability caregiver={person} /></div>
            <p className="home-caregiver-services">{labels.slice(0, 2).join(" · ") || "See profile for service details"}{labels.length > 2 ? ` +${labels.length - 2} more` : ""}</p>
            <p className="home-caregiver-rating">{hasVerifiedRating(person) ? `${Number(person.rating).toFixed(1)} · ${person.reviewCount} verified reviews` : "No verified reviews yet"}</p>
            <div className="home-caregiver-rate"><small>Starting rate</small><strong>{configuredRate(person) ? <>{formatNpr(person.hourlyRate)}<small> / hour</small></> : "Rate not configured"}</strong></div>
            <div className="caregiver-preview__actions"><Link className="caregiver-preview__profile" to={`/user/caregivers/${encodeURIComponent(person.id)}`}>View Profile</Link>{bookable ? <Link className="caregiver-preview__book" to={`/user/book/${encodeURIComponent(person.id)}`}>Book Now</Link> : <button className="caregiver-preview__book" type="button" disabled>Booking unavailable</button>}</div>
          </article>;
        })}</div>
        <p className="home-request-note">Booking sends a request. Dates and times require caregiver confirmation.</p>
        <div className="home-pagination">{shown < result.items.length && <button type="button" className="customer-action customer-action--outline" onClick={() => setShown(value => value + 6)}>Show more caregivers</button>}{cursor && <button type="button" className="customer-action customer-action--outline" onClick={() => setCursor(null)}>First page</button>}{result.nextCursor && <button type="button" className="customer-action customer-action--outline" onClick={() => setCursor(result.nextCursor)}>Next caregivers</button>}</div>
      </>)}
    </section>;
}
