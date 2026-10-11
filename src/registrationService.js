import { apiRequest } from './apiClient';
export async function completeRegistration(_user, { fullName, selectedRole, organizationName, ...organization }) {
  return apiRequest('/api/auth/complete-registration', { method: 'POST', json: { name: fullName.trim(), selectedRole, organizationName: organizationName.trim(), ...organization } });
}
