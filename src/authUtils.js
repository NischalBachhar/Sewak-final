const APP_ROLES = new Set(["user", "caregiver", "orgadmin", "superadmin"]);
const TRUSTED_PLATFORM_ROLES = new Set([
  "caregiver",
  "orgadmin",
  "superadmin",
]);

export const resolveInitialUserRole = (profileData) => {
  const role = typeof profileData?.role === "string"
    ? profileData.role.trim()
    : "";

  return APP_ROLES.has(role) ? role : "user";
};

// Firebase signs custom claims into the ID token. Only the privileged roles
// issued by the trusted Admin SDK are accepted here; ordinary customers remain
// the default `user` role when no platformRole claim is present.
export const resolveTrustedPlatformRole = (claims) => {
  const role = claims?.platformRole;
  return typeof role === "string" && TRUSTED_PLATFORM_ROLES.has(role)
    ? role
    : null;
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
