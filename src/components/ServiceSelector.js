import React, { useEffect, useState } from 'react';
import { auth } from '../authClient';
import { collection, db, getDocs, query, where } from '../d1Client';

export async function loadServiceOptions(organizationId) {
  const publicList = await getDocs(collection(db, 'publicServices'));
  const items = publicList.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if (organizationId && ['orgadmin','superadmin'].includes(auth.currentUser?.role)) {
    const privateList = await getDocs(query(collection(db, 'services'), where('organizationId', '==', organizationId)));
    for (const doc of privateList.docs) if (!items.some(item => item.id === doc.id)) items.push({ id: doc.id, ...doc.data() });
  }
  return items.filter(item => item.isActive !== false && !item.requiresProfessionalCredentials && !/nurs|wound|medication|licensed|medical/i.test(String(item.label || item.serviceName || '').replace(/nonmedical/ig,'')) && (!item.organizationId || item.organizationId === organizationId));
}
export default function ServiceSelector({ value = [], onChange, category = 'both', organizationId, disabled = false }) {
  const [services, setServices] = useState([]), [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  useEffect(() => { let active = true; loadServiceOptions(organizationId).then(items => { if (active) setServices(items); }).catch(() => { if (active) setError('Services could not be loaded. Refresh and retry.'); }); return () => { active = false; }; }, [organizationId]);
  const canonical = value => value === 'vendor' ? 'household' : value;
  const visible = services.filter(service => (!category || category === 'both' || service.category === 'both' || canonical(service.category) === canonical(category)) && (!filter || service.category === 'both' || canonical(service.category) === filter));
  return <fieldset className="service-selector" disabled={disabled}>
    <legend>Services Offered</legend>
    {error && <p role="alert">{error}</p>}
    <label>Service category<select value={filter} onChange={event => setFilter(event.target.value)}><option value="">All applicable services</option><option value="caregiver">Caregiver Support</option><option value="household">Household Support</option></select></label>
    <p>{value.length ? `${value.length} selected` : 'Services not specified. Select the services you offer.'}</p>
    <div className="service-selector-options">{visible.map(service => <label key={service.id}><input type="checkbox" checked={value.includes(service.id)} onChange={event => onChange(event.target.checked ? [...value, service.id] : value.filter(id => id !== service.id))} />{service.label || service.serviceName}</label>)}</div>
    {value.length > 0 && <ul>{value.map(id => <li key={id}>{services.find(service => service.id === id)?.label || id} <button type="button" className="link-button" onClick={() => onChange(value.filter(item => item !== id))}>Remove</button></li>)}</ul>}
    <small>Professional nursing is unavailable pending credential verification support.</small>
  </fieldset>;
}
