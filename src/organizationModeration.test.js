import { getOrganizationStatus, organizationStatusLabels } from './organizationModeration';

describe('organization moderation state', () => {
  test('pending, approved, rejected, restricted and deleted are distinct', () => {
    expect(getOrganizationStatus({ isApproved: false })).toBe('pending');
    expect(getOrganizationStatus({ isApproved: true })).toBe('approved');
    expect(getOrganizationStatus({ isApproved: false, isSuspended: true, isBlacklisted: true, reviewStatus: 'rejected' })).toBe('rejected');
    expect(getOrganizationStatus({ isApproved: false, isSuspended: true, isBlacklisted: true })).toBe('restricted');
    expect(getOrganizationStatus({ isApproved: true, deletedAt: '2026-10-11T10:00:00Z' })).toBe('deleted');
  });

  test('restricted historical accounts are never represented as pending', () => {
    expect(getOrganizationStatus({ isBlacklisted: true })).toBe('restricted');
    expect(getOrganizationStatus({ isSuspended: true })).toBe('restricted');
    expect(organizationStatusLabels.rejected).toBe('Rejected');
  });
});
