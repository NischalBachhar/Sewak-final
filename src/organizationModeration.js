// Treat historical safety restrictions as restricted, not pending. Older
// rejections did not persist a separate disposition and cannot be reconstructed.
export function getOrganizationStatus(org = {}) {
  if (org.deletedAt || org.reviewStatus === 'deleted') return 'deleted';
  if (org.reviewStatus === 'rejected') return 'rejected';
  if (org.isSuspended === true || org.isBlacklisted === true) return 'restricted';
  return org.isApproved === true ? 'approved' : 'pending';
}

export const organizationStatusLabels = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  restricted: 'Restricted',
  deleted: 'Deleted',
};
