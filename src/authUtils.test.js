import {
  createFallbackUserDoc,
  resolveInitialUserRole,
  resolveTrustedPlatformRole,
} from './authUtils';

describe('authUtils', () => {
  it('uses the role from an existing profile document', () => {
    expect(resolveInitialUserRole({ role: 'orgadmin' })).toBe('orgadmin');
  });

  it('falls back to a standard user role when no profile exists', () => {
    expect(resolveInitialUserRole(null)).toBe('user');
  });

  it('uses only recognized profile roles', () => {
    expect(resolveInitialUserRole({ role: 'unknown' })).toBe('user');
  });

  it('accepts only signed privileged platform roles for claim-based routing', () => {
    expect(resolveTrustedPlatformRole({ platformRole: 'caregiver' })).toBe('caregiver');
    expect(resolveTrustedPlatformRole({ platformRole: 'superadmin' })).toBe('superadmin');
    expect(resolveTrustedPlatformRole({ platformRole: 'user' })).toBeNull();
    expect(resolveTrustedPlatformRole({ platformRole: 'untrusted' })).toBeNull();
  });

  it('builds a fallback user document for a newly signed-in account', () => {
    const userDoc = createFallbackUserDoc({ uid: 'abc123', email: 'demo@example.com' });

    expect(userDoc.role).toBe('user');
    expect(userDoc.uid).toBe('abc123');
    expect(userDoc.profileComplete).toBe(false);
  });
});
