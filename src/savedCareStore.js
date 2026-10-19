const prefix = 'sewak:saved-care:v1:';
export const savedCareEvent = 'sewak:saved-care-updated';
const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 180 && !id.includes('/');
export function savedCareKey(uid) { return prefix + encodeURIComponent(String(uid || '')); }
export function readSavedCare(uid) {
  if (!uid || typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(savedCareKey(uid)) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter(validId))].slice(0, 100) : [];
  } catch { return []; }
}
export function toggleSavedCare(uid, caregiverId) {
  if (!uid || !validId(caregiverId) || typeof window === 'undefined') return false;
  const existing = readSavedCare(uid);
  const saved = existing.includes(caregiverId);
  const next = saved ? existing.filter(id => id !== caregiverId) : [...existing, caregiverId].slice(0, 100);
  try {
    window.localStorage.setItem(savedCareKey(uid), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(savedCareEvent, { detail: { uid } }));
    return !saved;
  } catch { return false; }
}
