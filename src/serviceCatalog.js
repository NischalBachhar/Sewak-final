// Shared by the search UI and Worker. These are equivalent labels, not extra
// services or qualifications; booking still uses the provider's actual service ID.
/** @type {Array<[string, string, string[]]>} */
export const serviceFamilies = [
  ['catalog_child_care_babysitting', 'Child care / Babysitting', ['child care', 'childcare', 'babysitting', 'child care / babysitting']],
  ['catalog_elderly_care', 'Elderly care', ['elderly care', 'senior care']],
  ['catalog_cooking_meal_preparation', 'Cooking / Meal preparation', ['cooking', 'cooking / meal preparation']],
  ['catalog_laundry_ironing', 'Laundry / Ironing', ['laundry', 'laundry / ironing']],
];
const normalized = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
export function serviceFamily(value) {
  const key = normalized(value);
  return serviceFamilies.find(([id, , aliases]) => id === key || aliases.includes(key));
}
export function publicServiceChoices(services = []) {
  const choices = new Map();
  for (const service of services) {
    if (service.isActive === false) continue;
    const family = serviceFamily(service.id) || serviceFamily(service.label || service.serviceName);
    // Unknown/custom services keep their actual identity and organization scope.
    const id = family?.[0] || service.id;
    if (!choices.has(id)) choices.set(id, { ...service, id, label: family?.[1] || service.label || service.serviceName });
  }
  return [...choices.values()];
}
export const careCategories = [
  { id: 'child', label: 'Child care', service: 'catalog_child_care_babysitting', color: 'peach', copy: 'A helping hand for your little ones.' },
  { id: 'senior', label: 'Elderly care', service: 'catalog_elderly_care', color: 'sage', copy: 'Thoughtful support for older loved ones.' },
  { id: 'disability', label: 'Disability support', service: 'catalog_disability_support', color: 'lavender', copy: 'Support for everyday independence.' },
  { id: 'patient', label: 'Patient support', service: 'catalog_patient_care_attendant_support', color: 'butter', copy: 'Nonmedical help during recovery.' },
  { id: 'home', label: 'Household help', category: 'household', color: 'rose', copy: 'Make a little more room for life.' },
];
export function categoryHref(category) {
  return category.service ? '/browse?service=' + encodeURIComponent(category.service) : '/browse?category=' + category.category;
}
