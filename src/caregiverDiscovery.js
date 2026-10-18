import { apiRequest } from './apiClient';
import { collection, db, getDocs } from './d1Client';

// Share only concurrent reads. Each mount/retry gets fresh public data.
let servicesRequest;
export function loadPublicCareServices() {
  if (!servicesRequest) {
    servicesRequest = getDocs(collection(db, 'publicServices'))
      .then(result => result.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      .finally(() => { servicesRequest = undefined; });
  }
  return servicesRequest;
}

export const searchCaregivers = (search = {}, { limit = 12, cursor } = {}) =>
  apiRequest('/api/query', {
    method: 'POST',
    json: { path: 'publicCaregivers', search, limit, ...(cursor ? { cursor } : {}) },
  });

export function requestAvailability(caregiver = {}) {
  const eligible = caregiver.availabilityConfirmed !== false && caregiver.isApproved === true && caregiver.isOrganizationActive === true
    && caregiver.isSuspended === false && caregiver.isBlacklisted === false;
  if (eligible && caregiver.isAvailable === true) return { state: 'accepting', label: 'Accepting requests' };
  if (eligible && caregiver.isAvailable === false) return { state: 'unavailable', label: 'Not accepting requests' };
  return { state: 'unknown', label: 'Availability not confirmed' };
}

export function caregiverBookingReason(caregiver = {}) {
  const availability = requestAvailability(caregiver);
  if (availability.state === 'unavailable') return 'This professional is not accepting booking requests.';
  if (availability.state !== 'accepting') return 'Request availability must be confirmed before booking.';
  if (!caregiver.servicesOffered?.length) return 'Booking opens when offered services are configured.';
  if (!Number.isFinite(caregiver.hourlyRate) || caregiver.hourlyRate < 0 || caregiver.hourlyRate > 1000000
    || (caregiver.hourlyRate === 0 && caregiver.allowZeroRate !== true)) return 'Booking opens when an hourly rate is configured.';
  return '';
}
