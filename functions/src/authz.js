"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

const PLATFORM_ROLE_CLAIM = "platformRole";
const SUPER_ADMIN_ROLE = "superadmin";
const ORGANIZATION_ADMIN_ROLE = "orgadmin";
const ORGANIZATION_APPROVED_CLAIM = "organizationApproved";

function requireAuthenticated(request) {
  if (!request || !request.auth || !request.auth.uid) {
    throw new HttpsError(
      "unauthenticated",
      "Sign in is required to call this function.",
    );
  }

  return {
    uid: request.auth.uid,
    token: request.auth.token || {},
  };
}

function requireSuperAdmin(request) {
  const requester = requireAuthenticated(request);

  if (requester.token[PLATFORM_ROLE_CLAIM] !== SUPER_ADMIN_ROLE) {
    throw new HttpsError(
      "permission-denied",
      "Only a super admin can perform this action.",
    );
  }

  return requester;
}

function requireApprovedOrganizationAdmin(request) {
  const requester = requireAuthenticated(request);

  if (
    requester.token[PLATFORM_ROLE_CLAIM] !== ORGANIZATION_ADMIN_ROLE ||
    requester.token[ORGANIZATION_APPROVED_CLAIM] !== true
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only an approved organization admin can provision caregivers.",
    );
  }

  return requester;
}

async function assertActorActive(requester) {
  const { getFirestore } = require("firebase-admin/firestore");
  const snapshot = await getFirestore().collection("users").doc(requester.uid).get();
  if (!snapshot.exists || snapshot.data().isSuspended === true || snapshot.data().isBlacklisted === true ||
      (requester.token.platformRole && snapshot.data().role !== requester.token.platformRole)) {
    throw new HttpsError("permission-denied", "The account is not currently authorized.");
  }
  return requester;
}

module.exports = {
  assertActorActive,
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_APPROVED_CLAIM,
  PLATFORM_ROLE_CLAIM,
  SUPER_ADMIN_ROLE,
  requireApprovedOrganizationAdmin,
  requireAuthenticated,
  requireSuperAdmin,
};
