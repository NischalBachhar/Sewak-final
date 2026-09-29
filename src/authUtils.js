const APP_ROLES = new Set(["user", "caregiver", "orgadmin", "superadmin"]);

export const resolveInitialUserRole = (profileData) => {
  const role = typeof profileData?.role === "string"
    ? profileData.role.trim()
    : "";

  return APP_ROLES.has(role) ? role : "user";
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
