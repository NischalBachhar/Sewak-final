import React from 'react';
import { requestAvailability } from '../caregiverDiscovery';
import './CaregiverPreview.css';

export default function RequestAvailability({ caregiver }) {
  const { state, label } = requestAvailability(caregiver);
  return <span className={`request-availability request-availability--${state}`}>
    <span aria-hidden="true">{state === 'accepting' ? '●' : '○'}</span> {label}
  </span>;
}
