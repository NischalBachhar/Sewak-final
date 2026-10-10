// Persist these exact values: existing organization records use the labels as IDs.
// Organization type never assigns services; selections are validated separately.
export const ORGANIZATION_TYPES = Object.freeze([
  'Caregiver Agency',
  'Home Care Service Provider',
  'Household Staffing Agency',
  'Caregiver & Household Staffing Agency',
  'Nursing / Home Healthcare Provider',
  'Other',
]);
