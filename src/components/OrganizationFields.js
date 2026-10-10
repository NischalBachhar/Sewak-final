import React from 'react';
import NepalCitySelect from './NepalCitySelect';
import ServiceSelector from './ServiceSelector';

export const ORGANIZATION_TYPES = ['Caregiver Agency','Home Care Service Provider','Household Staffing Agency','Nursing / Home Healthcare Provider','Other'];
export default function OrganizationFields({ value, onChange, organizationId }) {
  const set = (key, field) => onChange({ ...value, [key]: field });
  return <>
    <label>Organization Type *<select required value={value.organizationType || ''} onChange={event => set('organizationType', event.target.value)}><option value="">Select organization type</option>{ORGANIZATION_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
    {value.organizationType === 'Other' && <label>Specify organization type *<input required minLength={2} maxLength={100} value={value.organizationTypeOther || ''} onChange={event => set('organizationTypeOther', event.target.value)} /></label>}
    <label>Phone Number *<input type="tel" required autoComplete="tel" maxLength={25} value={value.businessPhone || ''} onChange={event => set('businessPhone', event.target.value)} /></label>
    <NepalCitySelect value={value.businessCity || ''} onChange={city => set('businessCity', city)} />
    <label>Address *<input required autoComplete="street-address" minLength={5} maxLength={300} value={value.businessAddress || ''} onChange={event => set('businessAddress', event.target.value)} /></label>
    <ServiceSelector organizationId={organizationId} value={value.servicesOffered || []} onChange={ids => set('servicesOffered', ids)} />
    <label>Registration Number (optional)<input maxLength={100} value={value.businessLicense || ''} onChange={event => set('businessLicense', event.target.value)} /></label>
    <label>PAN/VAT (optional)<input maxLength={100} value={value.panVat || ''} onChange={event => set('panVat', event.target.value)} /></label>
  </>;
}
