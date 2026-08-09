export const resolveInitialUserRole = (profileData) => {
  if (!profileData) return 'user';
  if (typeof profileData.role === 'string' && profileData.role.trim()) {
    return profileData.role;
  }
  return 'user';
};

export const createFallbackUserDoc = (user, profileData = null) => ({
  uid: user?.uid || '',
  email: user?.email || '',
  name: user?.displayName || '',
  role: resolveInitialUserRole(profileData),
  profileComplete: false,
  isApproved: true,
  isSuspended: false,
  createdAt: new Date().toISOString(),
});
