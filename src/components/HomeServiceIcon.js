import React from 'react';

// Stable catalog IDs determine the illustration; new catalog entries keep a
// neutral category fallback without guessing capabilities from display names.
const serviceIcons = {
  catalog_child_care_babysitting: 'baby',
  catalog_newborn_care_nonmedical: 'baby',
  catalog_cooking_meal_preparation: 'cooking',
  catalog_daily_living_assistance: 'hand',
  catalog_personal_care_assistance: 'hand',
  catalog_disability_support: 'accessibility',
  catalog_mobility_assistance: 'accessibility',
  catalog_elderly_care: 'care',
  catalog_elderly_companionship: 'conversation',
  catalog_house_cleaning: 'cleaning',
  catalog_housekeeping: 'housekeeping',
  catalog_laundry_ironing: 'laundry',
  catalog_patient_care_attendant_support: 'support',
  catalog_post_hospital_assistance_nonmedical: 'support',
  catalog_live_in_household_help: 'home',
  catalog_general_household_assistance: 'home',
};

const paths = {
  baby: <><path d="M9 4a3 3 0 0 1 3 3m-6-1a8 8 0 1 0 12 0" /><circle cx="9" cy="12" r=".6" /><circle cx="15" cy="12" r=".6" /><path d="M9 16q3 3 6 0" /></>,
  cooking: <><path d="M5 10h14v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-7Zm-3 2h3m14 0h3M4 7h16M10 7V5h4v2M8 2v1m8-1v1" /></>,
  hand: <><path d="m2 15 4-3 5 1a2 2 0 0 1 0 4H8m4 0 6-5a2 2 0 0 1 3 3l-7 6H7l-5-4M9 6a2 2 0 0 1 3-2 2 2 0 0 1 3 2c0 2-3 4-3 4S9 8 9 6Z" /></>,
  accessibility: <><circle cx="13" cy="3" r="1.5" /><path d="m12 7-1 7h6l3 6 2-1M12 8h6m-7 3a6 6 0 1 0 5 8" /></>,
  care: <><circle cx="8" cy="5" r="3" /><path d="M2 20v-4a6 6 0 0 1 9-5m2 1a2.5 2.5 0 0 1 4-1 2.5 2.5 0 0 1 4 1c2 3-4 7-4 7s-6-4-4-7Z" /></>,
  conversation: <><circle cx="6" cy="6" r="3" /><path d="M1 20v-3a5 5 0 0 1 10 0v3m3 0v-2a5 5 0 0 1 8 0m-9-9V3h9v6h-4l-3 3V9Z" /></>,
  cleaning: <><path d="m19 2-8 11m-4-2 8 5-5 6-8-5 5-6Zm-2 8 4-5m0 8 3-5" /></>,
  housekeeping: <><path d="m2 10 10-8 10 8M4 9v12h11M9 21v-7h5v3m5-6v6m-3-3h6m-4 6h4m-2-2v4" /></>,
  laundry: <><rect x="4" y="2" width="16" height="20" rx="2" /><circle cx="12" cy="14" r="5" /><path d="M4 7h16M8 4h1m3 0h1m-6 11q2-2 5 0t5 0" /></>,
  support: <><path d="M8 4h8m-7 0V2h6v2m-8 0H4v18h16V4h-3M8 11h8m-8 4h5m-5 4h8" /></>,
  home: <><path d="m2 10 10-8 10 8M4 9v13h16V9M9 22v-8h6v8" /></>,
  people: <><circle cx="9" cy="6" r="3" /><path d="M2 22v-5a7 7 0 0 1 14 0v5m0-19a3 3 0 0 1 0 6m3 4a6 6 0 0 1 3 5v4" /></>,
};

export default function HomeServiceIcon({ service }) {
  const kind = serviceIcons[service.id] || (['household', 'vendor', 'both'].includes(service.category) ? 'home' : 'people');
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[kind]}</svg>;
}
