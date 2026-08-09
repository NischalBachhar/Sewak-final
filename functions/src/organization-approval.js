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

function validateOrganizationAndAdmin({
  organizationId,
  organizationSnapshot,
  userSnapshot,
}) {
  if (!organizationSnapshot.exists) {
    throw new HttpsError(
      "not-found",
      "The organization record could not be found.",
    );
  }

  const organization = organizationSnapshot.data();
  const adminUid = organization.adminUid;

  if (!adminUid || typeof adminUid !== "string") {
    throw new HttpsError(
      "failed-precondition",
      "The organization record has no valid admin UID.",
    );
  }

  if (
    organization.organizationId !== undefined &&
    organization.organizationId !== organizationId
  ) {
    throw new HttpsError(
      "failed-precondition",
      "The organization record does not match the requested organization ID.",
    );
  }

  if (!userSnapshot.exists) {
    throw new HttpsError(
      "failed-precondition",
      "The organization admin user record could not be found.",
    );
  }

  const admin = userSnapshot.data();
  if (admin.uid !== adminUid || admin.role !== ORGANIZATION_ADMIN_ROLE) {
    throw new HttpsError(
      "failed-precondition",
      "The organization admin user record is inconsistent.",
    );
  }

  if (
    admin.organizationId !== undefined &&
    admin.organizationId !== organizationId
  ) {
    throw new HttpsError(
      "failed-precondition",
      "The organization admin is not linked to this organization.",
    );
  }

  return {
    adminUid,
    previousOrganizationApproval: organization.isApproved === true,
    previousOrganizationVerification: organization.verified === true,
    previousUserApproval: admin.isApproved === true,
    previousUserVerification: admin.verified === true,
  };
}

async function approveOrganizationFirestore({ organizationId, requesterUid }) {
  const db = getFirestore();
  const organizationRef = db.collection("organizations").doc(organizationId);
  const auditRef = db.collection("adminAuditLogs").doc();

  return db.runTransaction(async (transaction) => {
    const organizationSnapshot = await transaction.get(organizationRef);
    const organization = organizationSnapshot.exists
      ? organizationSnapshot.data()
      : null;
    const adminUid = organization && organization.adminUid;
    const userRef = adminUid ? db.collection("users").doc(adminUid) : null;
    const userSnapshot = userRef
      ? await transaction.get(userRef)
      : { exists: false };

    const result = validateOrganizationAndAdmin({
      organizationId,
      organizationSnapshot,
      userSnapshot,
    });

    transaction.update(organizationRef, {
      isApproved: true,
      verified: true,
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: requesterUid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(userRef, {
      isApproved: true,
      verified: true,
      role: ORGANIZATION_ADMIN_ROLE,
      roleSource: "custom-claim",
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: requesterUid,
    });
    transaction.set(auditRef, {
      action: "organization_approved",
      actorUid: requesterUid,
      targetUid: result.adminUid,
      organizationId,
      targetRole: ORGANIZATION_ADMIN_ROLE,
      createdAt: FieldValue.serverTimestamp(),
    });

    return result;
  });
}

async function rollBackFirestoreApproval({
  organizationId,
  adminUid,
  requesterUid,
  previous,
}) {
  const db = getFirestore();
  const organizationRef = db.collection("organizations").doc(organizationId);
  const userRef = db.collection("users").doc(adminUid);

  try {
    await db.runTransaction(async (transaction) => {
      const [organizationSnapshot, userSnapshot] = await Promise.all([
        transaction.get(organizationRef),
        transaction.get(userRef),
      ]);

      if (organizationSnapshot.exists) {
        transaction.update(organizationRef, {
          isApproved: previous.previousOrganizationApproval,
          verified: previous.previousOrganizationVerification,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      if (userSnapshot.exists) {
        transaction.update(userRef, {
          isApproved: previous.previousUserApproval,
          verified: previous.previousUserVerification,
        });
      }

      transaction.set(db.collection("adminAuditLogs").doc(), {
        action: "organization_approval_claim_sync_failed",
        actorUid: requesterUid,
        targetUid: adminUid,
        organizationId,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (rollbackError) {
    logger.error("Unable to roll back a failed organization approval.", {
      code: rollbackError && rollbackError.code ? rollbackError.code : "unknown",
      organizationId,
      adminUid,
    });
  }
}

async function approveOrganizationAccount({ requester, organizationId }) {
  const approval = await approveOrganizationFirestore({
    organizationId,
    requesterUid: requester.uid,
  });

  try {
    const auth = getAuth();
    const adminUser = await auth.getUser(approval.adminUid);
    await auth.setCustomUserClaims(approval.adminUid, {
      ...(adminUser.customClaims || {}),
      [PLATFORM_ROLE_CLAIM]: ORGANIZATION_ADMIN_ROLE,
      [ORGANIZATION_APPROVED_CLAIM]: true,
    });
  } catch (error) {
    await rollBackFirestoreApproval({
      organizationId,
      adminUid: approval.adminUid,
      requesterUid: requester.uid,
      previous: approval,
    });
    throw error;
  }

  logger.info("Organization account approved.", {
    actorUid: requester.uid,
    organizationId,
    adminUid: approval.adminUid,
  });

  return {
    organizationId,
    adminUid: approval.adminUid,
    approved: true,
  };
}

module.exports = {
  approveOrganizationAccount,
};
