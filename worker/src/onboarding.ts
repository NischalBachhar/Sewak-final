import { badInput, requireThat, textField, type Data } from './types.ts';
import { Repository, type Write } from './repository.ts';
import { validateServices } from './policy.ts';

export const organizationTypes = ['Caregiver Agency', 'Home Care Service Provider', 'Household Staffing Agency', 'Nursing / Home Healthcare Provider', 'Other'];
export const registrationKeys = ['selectedRole','organizationName','organizationType','organizationTypeOther','businessPhone','businessAddress','businessCity','servicesOffered','businessLicense','panVat'];

export function cityValue(value: unknown, required = true): string {
  const city = textField(value, 'City', required ? 2 : 0, 100).replace(/\s+/gu, ' ');
  badInput(!city || (city.toLowerCase() !== 'other' && /\p{L}/u.test(city) && /^[\p{L}\p{M}\p{N} .,'’()\/-]+$/u.test(city)), 'Enter a valid city, not Other.');
  return city;
}

export async function organizationFields(repo: Repository, body: Data, uid: string) {
  badInput(organizationTypes.includes(body.organizationType), 'Select an organization type.');
  const servicesOffered = body.servicesOffered ?? [];
  await validateServices(repo, servicesOffered, uid, 'both');
  const businessPhone = textField(body.businessPhone, 'Phone', 7, 25);
  badInput(/^\+?[\d ()-]+$/.test(businessPhone) && businessPhone.replace(/\D/g, '').length >= 10, 'Enter a valid phone number.');
  return {
    organizationName: textField(body.organizationName, 'Organization name', 2, 160),
    organizationType: body.organizationType,
    organizationTypeOther: body.organizationType === 'Other' ? textField(body.organizationTypeOther, 'Organization type', 2, 100) : '',
    businessPhone, businessCity: cityValue(body.businessCity),
    businessAddress: textField(body.businessAddress, 'Address', 5, 300), servicesOffered,
    businessLicense: textField(body.businessLicense ?? '', 'Registration number', 0, 100),
    panVat: textField(body.panVat ?? '', 'PAN/VAT', 0, 100),
  };
}

// The account type is independent of approval. Credentials, account, application
// and organization are committed by the caller in one guarded D1 transaction.
export async function registrationWrites(repo: Repository, profile: Data, body: Data): Promise<Write[]> {
  badInput(['user','orgadmin'].includes(body.selectedRole), 'Choose Customer or Organization.');
  const uid = profile.uid, now = new Date().toISOString();
  const next = { ...profile, registrationComplete: true };
  if (body.selectedRole === 'user') return [{ path: 'users/' + uid, data: next }];
  requireThat(repo.env.APP_WRITES_ENABLED === 'true', 'Organization applications are temporarily read-only.', 503, 'maintenance');
  requireThat(!await repo.data('organizations/' + uid), 'This organization is already configured.');
  const fields = await organizationFields(repo, body, uid);
  return [
    { path: 'users/' + uid, data: { ...next, role: 'orgadmin', organizationId: uid, organizationName: fields.organizationName, isApproved: false } },
    { path: 'organizations/' + uid, data: { ...fields, organizationId: uid, adminUid: uid, adminName: profile.name, adminEmail: profile.email, role: 'orgadmin', commissionRate: 15, isApproved: false, verified: false, isSuspended: false, isBlacklisted: false, profileComplete: false, createdAt: now } },
    { path: 'organizationApplications/' + uid, data: { ...fields, applicantId: uid, applicantName: profile.name, applicantEmail: profile.email, status: 'pending', createdAt: now } },
    { path: 'adminAuditLogs/' + crypto.randomUUID(), data: { actorUid: uid, targetUid: uid, action: 'organization_registration', createdAt: now } },
  ];
}
