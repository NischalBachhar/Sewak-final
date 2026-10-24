// Non-binding schedule preferences only. The booking form and Worker revalidate
// the service, future schedule, availability and quote before accepting a request.
import { kathmanduDate } from './bookingValidation';
export function readCareIntent(caregiverId) {
  try {
    const value = JSON.parse(sessionStorage.getItem('sewak.careIntent') || 'null');
    if (!value || value.caregiverId !== caregiverId || !Number.isFinite(value.createdAt) || Date.now() - value.createdAt > 86400000) return {};
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value.date) && value.date >= kathmanduDate() ? value.date : '';
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) ? value.time : '';
    return { date, time };
  } catch { return {}; }
}
export function saveCareIntent(caregiverId, date, time) {
  try { sessionStorage.setItem('sewak.careIntent', JSON.stringify({ caregiverId, date, time, createdAt: Date.now() })); } catch { /* Browsing and booking still work when session storage is unavailable. */ }
}
