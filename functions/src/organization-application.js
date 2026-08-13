"use strict";

const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const {
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_APPROVED_CLAIM,
  PLATFORM_ROLE_CLAIM,
} = require("./authz");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_COMMISSION_RATE = 15;

function requiredApplicationText(application, field, maxLength) {
  if (typeof application[field] !== "string") {
    throw new HttpsError(
      "failed-precondition",
      "The organization application is missing " + field + ".",
    );
  }

  const value = application[field].trim();
  if (!value || value.length > maxLength) {
    throw new HttpsError(
      "failed-precondition",
      "The organization application has an invalid " + field + ".",
    );
  }

  return value;
}

function optionalApplicationText(application, field, maxLength) {
  if (application[field] === undefined || application[field] === null) {
    return "";
  }

  if (typeof application[field] !== "string") {
    throw new HttpsError(
      "failed-precondition",
      "The organization application has an invalid " + field + ".",
    );
  }

  const value = application[field].trim();
  if (value.length > maxLength) {
    throw new HttpsError(
      "failed-precondition",
      "The organization application has an invalid " + field + ".",
    );
  }

  return value;
}

function validatePendingApplication(applicationSnapshot, applicationId) {
  if (!applicationSnapshot.exists) {
    throw new HttpsError(
      "not-found",
      "The organization application could not be found.",
    );
  }

  const application = applicationSnapshot.data();
  if (application.status !== "pending") {
    throw new HttpsError(
      "failed-precondition",
      "Only pending organization applications can be approved.",
    );
  }

  const applicantId = requiredApplicationText(application, "applicantId", 128);
  if (
    applicantId.includes("/") ||
    applicantId === "." ||
    applicantId === ".."
  ) {
    throw new HttpsError(
      "failed-precondition",
      "The organization application has an invalid applicant ID.",
    );
  }

  const applicantEmail = requiredApplicationText(
    application,
    "applicantEmail",
    254,
  ).toLowerCase();
  if (!EMAIL_PATTERN.test(applicantEmail)) {
    throw new HttpsError(
      "failed-precondition",
      "The organization application has an invalid applicant email.",
    );
  }

  if (!application.createdAt) {
    throw new HttpsError(
      "failed-precondition",
      "The organization application has no creation timestamp.",
    );
  }

  return {
    applicationId,
    applicantId,
    applicantName: requiredApplicationText(application, "applicantName", 120),
    applicantEmail,
    organizationName: requiredApplicationText(
      application,
      "organizationName",
      160,
    ),
    businessPhone: optionalApplicationText(application, "businessPhone", 40),
    businessAddress: optionalApplicationText(
      application,
      "businessAddress",
      300,
    ),
    businessCity: optionalApplicationText(application, "businessCity", 100),
  };
}

function assertExistingRecordsAreCompatible({
  application,
  organizationSnapshot,
  userSnapshot,
}) {
  if (organizationSnapshot.exists) {
    const organization = organizationSnapshot.data();
    if (
      (organization.adminUid && organization.adminUid !== application.applicantId) ||
      (organization.organizationId &&
        organization.organizationId !== application.applicantId)
    ) {
      throw new HttpsError(
        "failed-precondition",
        "An existing organization record belongs to a different account.",
      );
    }
  }

  if (userSnapshot.exists) {
    const user = userSnapshot.data();
    if (
      (user.uid && user.uid !== application.applicantId) ||
      (user.role &&
        !["user", ORGANIZATION_ADMIN_ROLE].includes(user.role)) ||
      user.isSuspended === true
    ) {
      throw new HttpsError(
        "failed-precondition",
        "The applicant user record cannot be converted to an organization admin.",
      );
    }
  }
}

function applicationOrganizationRecord(application, requesterUid) {
  return {
    organizationId: application.applicantId,
    organizationName: application.organizationName,
    adminUid: application.applicantId,
    adminName: application.applicantName,
    adminEmail: application.applicantEmail,
    businessPhone: application.businessPhone,
    businessAddress: application.businessAddress,
    businessCity: application.businessCity,
    caregivers: [],
    totalCaregivers: 0,
    totalEarnings: 0,
    totalBookings: 0,
    commissionRate: DEFAULT_COMMISSION_RATE,
    isApproved: true,
    verified: true,
    profileComplete: true,
    role: ORGANIZATION_ADMIN_ROLE,
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy: requesterUid,
    approvedFromApplicationId: application.applicationId,
    createdAt: FieldValue.serverTimestamp(),
  };
}

function applicationOrganizationPatch(application, requesterUid) {
  return {
    organizationId: application.applicantId,
    organizationName: application.organizationName,
    adminUid: application.applicantId,
    adminName: application.applicantName,
    adminEmail: application.applicantEmail,
    businessPhone: application.businessPhone,
    businessAddress: application.businessAddress,
    businessCity: application.businessCity,
    isApproved: true,
    verified: true,
    profileComplete: true,
    role: ORGANIZATION_ADMIN_ROLE,
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy: requesterUid,
    approvedFromApplicationId: application.applicationId,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function applicationUserRecord(application, requesterUid) {
  return {
    uid: application.applicantId,
    name: application.applicantName,
    email: application.applicantEmail,
    role: ORGANIZATION_ADMIN_ROLE,
    roleSource: "custom-claim",
    profileComplete: true,
    isApproved: true,
    verified: true,
    isSuspended: false,
    organizationId: application.applicantId,
    organizationName: application.organizationName,
    businessPhone: application.businessPhone,
    businessAddress: application.businessAddress,
    businessCity: application.businessCity,
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy: requesterUid,
    approvedFromApplicationId: application.applicationId,
    createdAt: FieldValue.serverTimestamp(),
  };
}

function applicationUserPatch(application, requesterUid) {
  const record = applicationUserRecord(application, requesterUid);
  delete record.createdAt;
  return record;
}

function currentOrDelete(value) {
  return value === undefined ? FieldValue.delete() : value;
}

function previousState(application, organizationSnapshot, userSnapshot) {
  const organization = organizationSnapshot.exists
    ? organizationSnapshot.data()
    : null;
  const user = userSnapshot.exists ? userSnapshot.data() : null;

  return {
    applicationId: application.applicationId,
    applicantId: application.applicantId,
    organizationWasCreated: !organizationSnapshot.exists,
    userWasCreated: !userSnapshot.exists,
    organization: organization
      ? {
          isApproved: organization.isApproved,
          verified: organization.verified,
          profileComplete: organization.profileComplete,
          role: organization.role,
          organizationName: organization.organizationName,
          adminUid: organization.adminUid,
          adminName: organization.adminName,
          adminEmail: organization.adminEmail,
          businessPhone: organization.businessPhone,
          businessAddress: organization.businessAddress,
          businessCity: organization.businessCity,
          approvedAt: organization.approvedAt,
          approvedBy: organization.approvedBy,
          approvedFromApplicationId: organization.approvedFromApplicationId,
        }
      : null,
    user: user
      ? {
          name: user.name,
          email: user.email,
          role: user.role,
          roleSource: user.roleSource,
          profileComplete: user.profileComplete,
          isApproved: user.isApproved,
          verified: user.verified,
          isSuspended: user.isSuspended,
          organizationId: user.organizationId,
          organizationName: user.organizationName,
          businessPhone: user.businessPhone,
          businessAddress: user.businessAddress,
          businessCity: user.businessCity,
          approvedAt: user.approvedAt,
          approvedBy: user.approvedBy,
          approvedFromApplicationId: user.approvedFromApplicationId,
        }
      : null,
  };
}

async function prepareApplicationApproval({ applicationId, requesterUid, authUser }) {
  const db = getFirestore();
  const applicationRef = db
    .collection("organizationApplications")
    .doc(applicationId);

  return db.runTransaction(async (transaction) => {
    const applicationSnapshot = await transaction.get(applicationRef);
    const application = validatePendingApplication(applicationSnapshot, applicationId);

    if (
      authUser.uid !== application.applicantId ||
      !authUser.email ||
      authUser.email.toLowerCase() !== application.applicantEmail
    ) {
      throw new HttpsError(
        "failed-precondition",
        "The Firebase Auth applicant does not match the pending application.",
      );
    }

    if (authUser.disabled) {
      throw new HttpsError(
        "failed-precondition",
        "The applicant Firebase Auth account is disabled.",
      );
    }

    const organizationRef = db
      .collection("organizations")
      .doc(application.applicantId);
    const userRef = db.collection("users").doc(application.applicantId);
    const [organizationSnapshot, userSnapshot] = await Promise.all([
      transaction.get(organizationRef),
      transaction.get(userRef),
    ]);

    assertExistingRecordsAreCompatible({
      application,
      organizationSnapshot,
      userSnapshot,
    });
    const rollbackState = previousState(
      application,
      organizationSnapshot,
      userSnapshot,
    );

    if (organizationSnapshot.exists) {
      transaction.set(
        organizationRef,
        applicationOrganizationPatch(application, requesterUid),
        { merge: true },
      );
    } else {
      transaction.set(
        organizationRef,
        applicationOrganizationRecord(application, requesterUid),
      );
    }

    if (userSnapshot.exists) {
      transaction.set(
        userRef,
        applicationUserPatch(application, requesterUid),
        { merge: true },
      );
    } else {
      transaction.set(userRef, applicationUserRecord(application, requesterUid));
    }

    transaction.update(applicationRef, {
      status: "approved",
      organizationId: application.applicantId,
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: requesterUid,
      approvalClaimSync: "pending",
    });
    transaction.set(db.collection("adminAuditLogs").doc(), {
      action: "organization_application_approved",
      actorUid: requesterUid,
      targetUid: application.applicantId,
      applicationId,
      organizationId: application.applicantId,
      targetRole: ORGANIZATION_ADMIN_ROLE,
      createdAt: FieldValue.serverTimestamp(),
    });

    return rollbackState;
  });
}

async function rollBackApplicationApproval({ requesterUid, state }) {
  const db = getFirestore();
  const applicationRef = db
    .collection("organizationApplications")
    .doc(state.applicationId);
  const organizationRef = db.collection("organizations").doc(state.applicantId);
  const userRef = db.collection("users").doc(state.applicantId);

  try {
    await db.runTransaction(async (transaction) => {
      const [applicationSnapshot, organizationSnapshot, userSnapshot] =
        await Promise.all([
          transaction.get(applicationRef),
          transaction.get(organizationRef),
          transaction.get(userRef),
        ]);

      if (
        applicationSnapshot.exists &&
        applicationSnapshot.data().status === "approved" &&
        applicationSnapshot.data().organizationId === state.applicantId
      ) {
        transaction.update(applicationRef, {
          status: "pending",
          organizationId: FieldValue.delete(),
          approvedAt: FieldValue.delete(),
          approvedBy: FieldValue.delete(),
          approvalClaimSync: "failed",
        });
      }

      if (organizationSnapshot.exists) {
        if (
          state.organizationWasCreated &&
          organizationSnapshot.data().approvedFromApplicationId ===
            state.applicationId
        ) {
          transaction.delete(organizationRef);
        } else if (
          organizationSnapshot.data().approvedFromApplicationId ===
          state.applicationId
        ) {
          transaction.update(organizationRef, {
            isApproved: currentOrDelete(state.organization.isApproved),
            verified: currentOrDelete(state.organization.verified),
            profileComplete: currentOrDelete(state.organization.profileComplete),
            role: currentOrDelete(state.organization.role),
            organizationName: currentOrDelete(state.organization.organizationName),
            adminUid: currentOrDelete(state.organization.adminUid),
            adminName: currentOrDelete(state.organization.adminName),
            adminEmail: currentOrDelete(state.organization.adminEmail),
            businessPhone: currentOrDelete(state.organization.businessPhone),
            businessAddress: currentOrDelete(state.organization.businessAddress),
            businessCity: currentOrDelete(state.organization.businessCity),
            approvedAt: currentOrDelete(state.organization.approvedAt),
            approvedBy: currentOrDelete(state.organization.approvedBy),
            approvedFromApplicationId: currentOrDelete(
              state.organization.approvedFromApplicationId,
            ),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      if (userSnapshot.exists) {
        if (
          state.userWasCreated &&
          userSnapshot.data().approvedFromApplicationId === state.applicationId
        ) {
          transaction.delete(userRef);
        } else if (
          userSnapshot.data().approvedFromApplicationId === state.applicationId
        ) {
          transaction.update(userRef, {
            name: currentOrDelete(state.user.name),
            email: currentOrDelete(state.user.email),
            role: currentOrDelete(state.user.role),
            roleSource: currentOrDelete(state.user.roleSource),
            profileComplete: currentOrDelete(state.user.profileComplete),
            isApproved: currentOrDelete(state.user.isApproved),
            verified: currentOrDelete(state.user.verified),
            isSuspended: currentOrDelete(state.user.isSuspended),
            organizationId: currentOrDelete(state.user.organizationId),
            organizationName: currentOrDelete(state.user.organizationName),
            businessPhone: currentOrDelete(state.user.businessPhone),
            businessAddress: currentOrDelete(state.user.businessAddress),
            businessCity: currentOrDelete(state.user.businessCity),
            approvedAt: currentOrDelete(state.user.approvedAt),
            approvedBy: currentOrDelete(state.user.approvedBy),
            approvedFromApplicationId: currentOrDelete(
              state.user.approvedFromApplicationId,
            ),
          });
        }
      }

      transaction.set(db.collection("adminAuditLogs").doc(), {
        action: "organization_application_claim_sync_failed",
        actorUid: requesterUid,
        targetUid: state.applicantId,
        applicationId: state.applicationId,
        organizationId: state.applicantId,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (rollbackError) {
    logger.error("Unable to roll back a failed organization application approval.", {
      code: rollbackError && rollbackError.code ? rollbackError.code : "unknown",
      applicationId: state.applicationId,
    });
  }
}

async function finalizeApplicationApproval(applicationId) {
  try {
    await getFirestore()
      .collection("organizationApplications")
      .doc(applicationId)
      .update({
        approvalClaimSync: "complete",
        claimSyncedAt: FieldValue.serverTimestamp(),
      });
  } catch (error) {
    logger.warn("Organization application was approved but claim-sync finalization failed.", {
      code: error && error.code ? error.code : "unknown",
      applicationId,
    });
  }
}

async function approveOrganizationApplication({ requester, applicationId }) {
  const applicationSnapshot = await getFirestore()
    .collection("organizationApplications")
    .doc(applicationId)
    .get();
  const application = validatePendingApplication(applicationSnapshot, applicationId);
  const auth = getAuth();
  const authUser = await auth.getUser(application.applicantId);

  const state = await prepareApplicationApproval({
    applicationId,
    requesterUid: requester.uid,
    authUser,
  });

  try {
    const latestAuthUser = await auth.getUser(authUser.uid);
    await auth.setCustomUserClaims(authUser.uid, {
      ...(latestAuthUser.customClaims || {}),
      [PLATFORM_ROLE_CLAIM]: ORGANIZATION_ADMIN_ROLE,
      [ORGANIZATION_APPROVED_CLAIM]: true,
    });
  } catch (error) {
    await rollBackApplicationApproval({
      requesterUid: requester.uid,
      state,
    });
    throw error;
  }

  await finalizeApplicationApproval(applicationId);
  logger.info("Organization application approved.", {
    actorUid: requester.uid,
    applicationId,
    applicantId: authUser.uid,
  });

  return {
    applicationId,
    organizationId: authUser.uid,
    adminUid: authUser.uid,
    approved: true,
  };
}

module.exports = {
  approveOrganizationApplication,
};
