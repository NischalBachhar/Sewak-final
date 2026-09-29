import { apiRequest } from './apiClient';
export async function completeRegistration(_user, { fullName, selectedRole, organizationName }) {
  return apiRequest('/api/auth/complete-registration', { method: 'POST', json: { name: fullName.trim(), selectedRole, organizationName: organizationName.trim() } });
}
