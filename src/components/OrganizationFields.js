import React, { useId } from 'react';
import NepalCitySelect from './NepalCitySelect';
import ServiceSelector from './ServiceSelector';

import { ORGANIZATION_TYPES } from '../organizationTypes.mjs';
export { ORGANIZATION_TYPES } from '../organizationTypes.mjs';
export default function OrganizationFields({ value, onChange, organizationId, section = 'all', errors = {} }) {
  const prefix = useId();
  const set = (key, field) => onChange({ ...value, [key]: field });
  const field = (key, label, props = {}, options) => <div className="organization-field" key={key}>
    <label htmlFor={`${prefix}-${key}`}>{label}</label>
    {React.createElement(options ? 'select' : 'input', {
      id: `${prefix}-${key}`, name: key, value: value[key] || '',
      onChange: event => set(key, event.target.value), ...props,
      'aria-invalid': errors[key] ? true : undefined,
      'aria-describedby': errors[key] ? `${prefix}-${key}-error` : undefined,
    }, options)}
    {errors[key] && <span className="signup-field-error" id={`${prefix}-${key}-error`}>{errors[key]}</span>}
  </div>;
  return <>
    {section !== 'services' && <>
      {field('organizationType', 'Organization Type *', { required: true }, <><option value="">Select organization type</option>{ORGANIZATION_TYPES.map(type => <option key={type}>{type}</option>)}</>)}
      {value.organizationType === 'Other' && field('organizationTypeOther', 'Specify organization type *', { required: true, minLength: 2, maxLength: 100 })}
      {field('businessPhone', 'Phone Number *', { type: 'tel', required: true, autoComplete: 'tel', maxLength: 25 })}
      <NepalCitySelect value={value.businessCity || ''} onChange={city => set('businessCity', city)} name="businessCity" error={errors.businessCity} />
      {field('businessAddress', 'Address *', { required: true, autoComplete: 'street-address', minLength: 5, maxLength: 300 })}
    </>}
    {section !== 'details' && <ServiceSelector organizationId={organizationId} value={value.servicesOffered || []} onChange={ids => set('servicesOffered', ids)} grouped={section === 'services'} />}
    {section !== 'services' && <>
      {field('businessLicense', 'Registration Number (optional)', { maxLength: 100 })}
      {field('panVat', 'PAN/VAT (optional)', { maxLength: 100 })}
    </>}
  </>;
}
