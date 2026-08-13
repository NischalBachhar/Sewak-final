"use strict";

const { randomBytes } = require("node:crypto");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { PLATFORM_ROLE_CLAIM } = require("./authz");

const DEFAULT_COMMISSION_RATE = 15;

function randomOneTimePassword() {
  // This value is never persisted, logged, or returned. The user sets their
  // real password through the Firebase-generated password reset link.
  return randomBytes(48).toString("base64url");
}

function baseUserRecord({ uid, input, role, requester, profileComplete }) {
  return {
    uid,
    name: input.displayName,
    email: input.email,
    role,
    roleSource: "custom-claim",
    profileComplete,
    isApproved: role === "superadmin",
    isSuspended: false,
    createdAt: FieldValue.serverTimestamp(),
    roleAssignedAt: FieldValue.serverTimestamp(),
    roleAssignedBy: requester.uid,
  };
}

function organizationRecord({ uid, input }) {
  return {
    organizationId: uid,
    organizationName: input.organizationName,
    adminUid: uid,
    adminName: input.displayName,
    adminEmail: input.email,
    businessPhone: input.businessPhone,
    businessAddress: input.businessAddress,
    businessCity: input.businessCity,
    caregivers: [],
    totalCaregivers: 0,
    totalEarnings: 0,
    totalBookings: 0,
    commissionRate: DEFAULT_COMMISSION_RATE,
    isApproved: false,
    verified: false,
    profileComplete: false,
    role: "orgadmin",
    createdAt: FieldValue.serverTimestamp(),
  };
}

async function createPasswordResetInvitation(auth, email) {
  try {
    const link = await auth.generatePasswordResetLink(email);
    return {
      delivery: "manual",
      passwordResetLink: link,
    };
  } catch (error) {
    logger.warn("Account provisioned without a password-reset invitation.", {
      code: error && error.code ? error.code : "unknown",
    });
    return {
      delivery: "manual",
      passwordResetLink: null,
      warning:
        "The account was created, but no password-reset link was generated. Configure Firebase Authentication email/password before inviting this user.",
    };
  }
}

async function safelyRemoveNewAccount(auth, uid) {
  try {
    await auth.deleteUser(uid);
  } catch (deleteError) {
    logger.error("Could not remove a partially provisioned Firebase user.", {
      code: deleteError && deleteError.code ? deleteError.code : "unknown",
      uid,
    });
    try {
      await auth.updateUser(uid, { disabled: true });
    } catch (disableError) {
      logger.error("Could not disable a partially provisioned Firebase user.", {
        code: disableError && disableError.code ? disableError.code : "unknown",
        uid,
      });
    }
  }
}

async function provisionAccount({ requester, input, role, organization }) {
  const auth = getAuth();
  const user = await auth.createUser({
    email: input.email,
    displayName: input.displayName,
    password: randomOneTimePassword(),
    disabled: false,
  });

  try {
    await auth.setCustomUserClaims(user.uid, {
      [PLATFORM_ROLE_CLAIM]: role,
    });

    const db = getFirestore();
    const batch = db.batch();
    const userRef = db.collection("users").doc(user.uid);

    batch.set(
      userRef,
      baseUserRecord({
        uid: user.uid,
        input,
        role,
        requester,
        profileComplete: role === "superadmin",
      }),
    );

    if (organization) {
      batch.set(
        db.collection("organizations").doc(user.uid),
        organizationRecord({ uid: user.uid, input }),
      );
    }

    batch.set(db.collection("adminAuditLogs").doc(), {
      action: organization
        ? "organization_account_provisioned"
        : "superadmin_account_provisioned",
      actorUid: requester.uid,
      targetUid: user.uid,
      targetRole: role,
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    await safelyRemoveNewAccount(auth, user.uid);
    throw error;
  }

  const invitation = await createPasswordResetInvitation(auth, input.email);

  logger.info("Privileged account provisioned.", {
    actorUid: requester.uid,
    targetUid: user.uid,
    role,
  });

  return {
    uid: user.uid,
    email: input.email,
    role,
    invitation,
  };
}

async function provisionOrganizationAccount({ requester, input }) {
  return provisionAccount({
    requester,
    input,
    role: "orgadmin",
    organization: true,
  });
}

async function provisionSuperAdminAccount({ requester, input }) {
  return provisionAccount({
    requester,
    input,
    role: "superadmin",
    organization: false,
  });
}

async function resolveOrganizationForCaregiver(requester) {
  const db = getFirestore();
  const organizationRef = db.collection("organizations").doc(requester.uid);
  const organizationSnapshot = await organizationRef.get();

  if (!organizationSnapshot.exists) {
    throw new HttpsError(
      "failed-precondition",
      "Your organization record could not be found.",
    );
  }

  const organization = organizationSnapshot.data();
  if (organization.adminUid !== requester.uid) {
    throw new HttpsError(
      "permission-denied",
      "The organization record is not owned by the signed-in admin.",
    );
  }

  if (!organization.organizationName) {
    throw new HttpsError(
      "failed-precondition",
      "Your organization must have a name before caregivers can be provisioned.",
    );
  }

  // Claims can remain in an already-issued ID token for a short time. The
  // authoritative organization document is checked again here so a rejected,
  // suspended, or blacklisted organization cannot provision caregivers.
  if (
    organization.isApproved !== true ||
    organization.verified !== true ||
    organization.isSuspended === true ||
    organization.isBlacklisted === true
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only an approved, active organization can provision caregivers.",
    );
  }

  return {
    db,
    organization,
    organizationRef,
  };
}

async function assertServicesExist(db, serviceIds) {
  if (serviceIds.length === 0) {
    return;
  }

  const references = serviceIds.map((serviceId) =>
    db.collection("services").doc(serviceId),
  );
  const snapshots = await db.getAll(...references);

  if (snapshots.some((snapshot) => !snapshot.exists)) {
    throw new HttpsError(
      "invalid-argument",
      "One or more selected services do not exist.",
    );
  }
}

function caregiverUserRecord({ uid, input, requester, organization }) {
  return {
    uid,
    name: input.displayName,
    email: input.email,
    role: "caregiver",
    roleSource: "custom-claim",
    phone: input.phone,
    createdAt: FieldValue.serverTimestamp(),
    isApproved: false,
    isSuspended: false,
    profileComplete: true,
    organizationId: requester.uid,
    organizationName: organization.organizationName,
    addedBy: requester.uid,
  };
}

function caregiverVendorRecord({ uid, input, requester, organization }) {
  return {
    uid,
    vendorId: uid,
    name: input.displayName,
    email: input.email,
    phone: input.phone,
    location: input.location,
    category: input.category,
    workType: input.workType,
    shifts: input.workType === "parttime" ? input.shifts : [],
    servicesOffered: input.servicesOffered,
    hourlyRate: input.hourlyRate,
    experience: input.experience,
    bio: "",
    jobsCompleted: 0,
    reviewCount: 0,
    verified: false,
    backgroundChecked: false,
    isCertified: false,
    identityVerificationStatus: "not_verified",
    phoneVerificationStatus: "not_verified",
    trainingVerificationStatus: "not_verified",
    backgroundVerificationStatus: "not_verified",
    referencesVerificationStatus: "not_verified",
    isAvailable: false,
    isApproved: false,
    isSuspended: false,
    isBlacklisted: false,
    totalEarnings: 0,
    pendingEarnings: 0,
    organizationId: requester.uid,
    organizationName: organization.organizationName,
    isIndependent: false,
    addedBy: requester.uid,
    createdAt: FieldValue.serverTimestamp(),
  };
}

async function provisionCaregiverAccount({ requester, input }) {
  const { db, organization, organizationRef } =
    await resolveOrganizationForCaregiver(requester);
  await assertServicesExist(db, input.servicesOffered);

  const auth = getAuth();
  const user = await auth.createUser({
    email: input.email,
    displayName: input.displayName,
    password: randomOneTimePassword(),
    disabled: false,
  });

  try {
    await auth.setCustomUserClaims(user.uid, {
      [PLATFORM_ROLE_CLAIM]: "caregiver",
    });

    const batch = db.batch();
    batch.set(
      db.collection("users").doc(user.uid),
      caregiverUserRecord({ uid: user.uid, input, requester, organization }),
    );
    batch.set(
      db.collection("vendors").doc(user.uid),
      caregiverVendorRecord({ uid: user.uid, input, requester, organization }),
    );
    batch.update(organizationRef, {
      caregivers: FieldValue.arrayUnion(user.uid),
      totalCaregivers: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("adminAuditLogs").doc(), {
      action: "caregiver_account_provisioned",
      actorUid: requester.uid,
      targetUid: user.uid,
      targetRole: "caregiver",
      organizationId: requester.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    await safelyRemoveNewAccount(auth, user.uid);
    throw error;
  }

  const invitation = await createPasswordResetInvitation(auth, input.email);
  logger.info("Caregiver account provisioned.", {
    actorUid: requester.uid,
    targetUid: user.uid,
  });

  return {
    uid: user.uid,
    email: input.email,
    role: "caregiver",
    isApproved: false,
    invitation,
  };
}

module.exports = {
  provisionCaregiverAccount,
  provisionOrganizationAccount,
  provisionSuperAdminAccount,
};
