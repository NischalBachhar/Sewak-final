import React, { useEffect, useState } from 'react';
import { loadPublicCareServices } from '../caregiverDiscovery';
import { auth } from '../authClient';
import { collection, db, getDocs, query, where } from '../d1Client';

export async function loadServiceOptions(organizationId) {
  const items = [...await loadPublicCareServices()];
  if (organizationId && ['orgadmin','superadmin'].includes(auth.currentUser?.role)) {
    const privateList = await getDocs(query(collection(db, 'services'), where('organizationId', '==', organizationId)));
    for (const doc of privateList.docs) if (!items.some(item => item.id === doc.id)) items.push({ id: doc.id, ...doc.data() });
  }
  return items.filter(item => item.isActive !== false && !item.requiresProfessionalCredentials && !/nurs|wound|medication|licensed|medical/i.test(String(item.label || item.serviceName || '').replace(/nonmedical/ig,'')) && (!item.organizationId || item.organizationId === organizationId));
}
export default function ServiceSelector({ value = [], onChange, category = 'both', organizationId, disabled = false, grouped = false }) {
  const [services, setServices] = useState([]), [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; setLoading(true); setError(''); loadServiceOptions(organizationId).then(items => { if (active) setServices(items); }).catch(() => { if (active) setError('Services could not be loaded. Refresh and retry.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [organizationId]);
  const canonical = value => value === 'vendor' ? 'household' : value;
  const visible = services.filter(service => (!category || category === 'both' || service.category === 'both' || canonical(service.category) === canonical(category)) && (!filter || service.category === 'both' || canonical(service.category) === filter) && (!grouped || (service.label || service.serviceName || '').toLowerCase().includes(search.trim().toLowerCase())));
  const option = service => <label key={service.id}><input type="checkbox" checked={value.includes(service.id)} disabled={!value.includes(service.id) && value.length >= 20} onChange={event => onChange(event.target.checked ? [...value, service.id] : value.filter(id => id !== service.id))} />{service.label || service.serviceName}</label>;
  return <fieldset className="service-selector" disabled={disabled}>
    <legend>Services Offered</legend>
    {error && <p role="alert">{error}</p>}
    {grouped && <label>Search services<input type="search" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} placeholder="e.g., elderly care or cooking" /></label>}
    <label>Service category<select value={filter} onChange={event => setFilter(event.target.value)}><option value="">All applicable services</option><option value="caregiver">Caregiver Support</option><option value="household">Household Support</option></select></label>
    <p aria-live="polite">{value.length ? `${value.length} selected` : 'Services not specified. Select the services you offer.'}</p>
    {loading && <p role="status">Loading services…</p>}
    {!loading && !error && !visible.length && <p>No services match. Try another search or category.</p>}
    {grouped ? [['caregiver','Caregiver Support'],['household','Household Support'],['both','Shared services']].map(([key,label]) => {
      const options = visible.filter(service => canonical(service.category) === key);
      return options.length > 0 && <fieldset className="signup-service-group" key={key}><legend>{label}</legend><div className="service-selector-options">{options.map(option)}</div></fieldset>;
    }) : <div className="service-selector-options">{visible.map(option)}</div>}
    {value.length > 0 && <ul className={grouped ? 'signup-selected-services' : undefined}>{value.map(id => <li key={id}>{services.find(service => service.id === id)?.label || id} <button type="button" className="link-button" aria-label={`Remove ${services.find(service => service.id === id)?.label || id}`} onClick={() => onChange(value.filter(item => item !== id))}>Remove</button></li>)}</ul>}
    <small>Professional nursing is unavailable pending credential verification support.</small>
  </fieldset>;
}
