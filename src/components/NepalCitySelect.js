import React, { useId, useState } from 'react';

export const NEPAL_CITIES = ['Kathmandu','Lalitpur','Bhaktapur','Pokhara','Biratnagar','Birgunj','Butwal','Dharan','Hetauda','Bharatpur','Nepalgunj','Janakpur','Dhangadhi','Itahari','Birtamod','Tulsipur','Ghorahi','Siddharthanagar / Bhairahawa'];
export default function NepalCitySelect({ value = '', onChange, label = 'City', required = true, disabled = false, id, name, error }) {
  const generated = useId();
  const fieldId = id || generated;
  const [custom, setCustom] = useState(false);
  const other = custom || (!!value && !NEPAL_CITIES.includes(value));
  return <div className="city-select">
    <label htmlFor={fieldId}>{label}{required ? ' *' : ''}</label>
    <select id={fieldId} name={name} aria-invalid={error ? true : undefined} aria-describedby={error ? `${fieldId}-error` : undefined} value={other ? 'Other' : value} required={required} disabled={disabled} onChange={event => {
      setCustom(event.target.value === 'Other'); onChange(event.target.value === 'Other' ? '' : event.target.value);
    }}>
      <option value="">Select city</option>
      {NEPAL_CITIES.map(city => <option key={city}>{city}</option>)}
      <option value="Other">Other</option>
    </select>
    {other && <><label htmlFor={`${fieldId}-other`}>Enter your city *</label><input id={`${fieldId}-other`} name={name} aria-invalid={error ? true : undefined} aria-describedby={error ? `${fieldId}-error` : undefined} value={value === 'Other' ? '' : value} required disabled={disabled} autoComplete="address-level2" minLength={2} maxLength={100} placeholder="e.g., Hetauda, Bharatpur, Nepalgunj" onChange={event => onChange(event.target.value)} onBlur={() => onChange(value.trim().replace(/\s+/g, ' '))} /></>}
    {error && <span className="signup-field-error" id={`${fieldId}-error`}>{error}</span>}
  </div>;
}
