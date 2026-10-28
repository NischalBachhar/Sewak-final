// Keep public search choices in the URL so returning from a profile restores
// the same results. Only known search fields and local result pages are used.
export function readCareSearch(search = '') {
  const params = new URLSearchParams(search);
  const fields = {};
  for (const [key, parameter, limit] of [
    ['serviceId', 'service', 160], ['category', 'category', 20],
    ['location', 'location', 160], ['text', 'text', 160],
    ['workType', 'workType', 20], ['shift', 'shift', 20],
  ]) {
    const value = (params.get(parameter) || '').trim().slice(0, limit);
    if (value) fields[key] = value;
  }
  if (!['caregiver', 'household', 'both'].includes(fields.category)) delete fields.category;
  if (!['fulltime', 'parttime'].includes(fields.workType)) delete fields.workType;
  if (fields.workType !== 'parttime' || !['morning', 'day', 'evening', 'night'].includes(fields.shift)) delete fields.shift;
  for (const [key, maximum] of [['minimumExperience', 100], ['minimumRating', 5]]) {
    const value = Number(params.get(key));
    if (Number.isFinite(value) && value > 0 && value <= maximum) fields[key] = value;
  }
  if (params.get('verifiedOnly') === 'true') fields.verifiedOnly = true;
  return fields;
}

export function careSearchPath(pathname, fields = {}, hash = '') {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== '' && value !== false && value !== 0 && value != null) {
      params.set(key === 'serviceId' ? 'service' : key, String(value));
    }
  }
  const normalized = readCareSearch(params.toString());
  const safeParams = new URLSearchParams(Object.entries(normalized).map(([key, value]) => [key === 'serviceId' ? 'service' : key, String(value)]));
  const query = safeParams.toString();
  const path = ['/', '/browse', '/user'].includes(pathname) ? pathname : '/browse';
  const anchor = ['caregivers', 'home-caregiver-results-heading', 'browse-caregiver-results'].includes(hash) ? '#' + hash : '';
  return path + (query ? '?' + query : '') + anchor;
}

export function careSearchReturnPath(value, signedIn = false) {
  const fallback = signedIn ? '/user' : '/browse';
  if (typeof value !== 'string' || !/^\/(?:browse|user)?(?:[?#]|$)/.test(value)) return fallback;
  const url = new URL(value, 'https://sewak.invalid');
  if (url.pathname === '/user' && !signedIn) return fallback;
  return careSearchPath(url.pathname, readCareSearch(url.search), url.hash.slice(1));
}
