"use strict";

const { getAuth } = require("firebase-admin/auth");
const {
  FieldPath,
  FieldValue,
  getFirestore,
} = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const {
  ORGANIZATION_APPROVED_CLAIM,
  PLATFORM_ROLE_CLAIM,
  SUPER_ADMIN_ROLE,
} = require("./authz");

// An atomic organization cascade writes five records per caregiver at most:
// vendor, optional user, public projection deletion, blacklist, and org
// blacklist. Larger organizations commit their parent safety block first and
// then use the idempotent post-commit cascade below; Firestore Rules make the
// parent suspension immediately effective for booking and care operations.
const MAX_ORGANIZATION_CAREGIVERS_PER_SAFETY_ACTION = 99;
const AUTH_REVOCATION_CONCURRENCY = 8;
const ORGANIZATION_CASCADE_BATCH_SIZE = 75;

function assertSafeDocumentId(value, field) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 128 ||
    value.includes("/") ||
    value === "." ||
    value === ".."
  ) {
    throw new HttpsError("failed-precondition", field + " is invalid.");
  }
}

function assertUserUid(user, uid) {
  if (user.uid !== undefined && user.uid !== uid) {
    throw new HttpsError(
      "failed-precondition",
      "The target user record is inconsistent.",
    );
  }
}

function assertUserRole(user, permittedRoles, targetType) {
  if (
    user.role !== undefined &&
    (!permittedRoles.includes(user.role) || user.role === SUPER_ADMIN_ROLE)
  ) {
    throw new HttpsError(
      "failed-precondition",
      "The target is not a " + targetType + " account.",
    );
  }
}

function organizationCaregiverIds(organization) {
  if (organization.caregivers === undefined) {
    return [];
  }
  if (!Array.isArray(organization.caregivers)) {
    throw new HttpsError(
      "failed-precondition",
      "The organization caregiver list is invalid.",
    );
  }

  return organization.caregivers.map((caregiverId) => {
    assertSafeDocumentId(caregiverId, "organization caregiver ID");
    return caregiverId;
  });
}

function assertCaregiverVendor(vendor, caregiverId, organizationId) {
  if (
    (vendor.uid !== undefined && vendor.uid !== caregiverId) ||
    (vendor.vendorId !== undefined && vendor.vendorId !== caregiverId)
  ) {
    throw new HttpsError(
      "failed-precondition",
      "The caregiver record does not match the requested target.",
    );
  }

  if (
    organizationId !== undefined &&
    vendor.organizationId !== undefined &&
    vendor.organizationId !== organizationId
  ) {
    throw new HttpsError(
      "failed-precondition",
      "A listed caregiver belongs to a different organization.",
    );
  }
}

function assertPendingCustomerReport(reportSnapshot, targetId) {
  if (!reportSnapshot.exists) {
    throw new HttpsError("not-found", "The blacklist report was not found.");
  }

  const report = reportSnapshot.data();
  if (report.status !== "pending" || report.userId !== targetId) {
    throw new HttpsError(
      "failed-precondition",
      "The blacklist report is not a pending report for this customer.",
    );
  }
  if (
    report.userType !== undefined &&
    !["user", "customer"].includes(report.userType)
  ) {
    throw new HttpsError(
      "failed-precondition",
      "The blacklist report does not target a customer account.",
    );
  }
}

async function resolveOrganizationCaregivers({
  db,
  organization,
  organizationId,
  read,
}) {
  const vendorQuery = db
    .collection("vendors")
    .where("organizationId", "==", organizationId)
    .limit(MAX_ORGANIZATION_CAREGIVERS_PER_SAFETY_ACTION + 1);
  const vendorQuerySnapshot = await read(vendorQuery);

  if (
    vendorQuerySnapshot.size > MAX_ORGANIZATION_CAREGIVERS_PER_SAFETY_ACTION
  ) {
    return { caregivers: [], requiresPostCommitCascade: true };
  }

  const snapshotsById = new Map(
    vendorQuerySnapshot.docs.map((snapshot) => [snapshot.id, snapshot]),
  );
  const candidateIds = new Set([
    ...organizationCaregiverIds(organization),
    ...snapshotsById.keys(),
  ]);

  if (candidateIds.size > MAX_ORGANIZATION_CAREGIVERS_PER_SAFETY_ACTION) {
    return { caregivers: [], requiresPostCommitCascade: true };
  }

  const missingIds = [...candidateIds].filter((id) => !snapshotsById.has(id));
  const missingSnapshots = await Promise.all(
    missingIds.map((id) => read(db.collection("vendors").doc(id))),
  );
  missingSnapshots.forEach((snapshot) => {
    if (snapshot.exists) {
      snapshotsById.set(snapshot.id, snapshot);
    }
  });

  const caregiverTargets = [];
  for (const caregiverId of [...candidateIds].sort()) {
    const vendorSnapshot = snapshotsById.get(caregiverId);
    if (!vendorSnapshot || !vendorSnapshot.exists) {
      // A stale ID in organizations.caregivers has no account to revoke.
      continue;
    }

    const vendor = vendorSnapshot.data();
    assertCaregiverVendor(vendor, caregiverId, organizationId);

    const userRef = db.collection("users").doc(caregiverId);
    const userSnapshot = await read(userRef);
    const user = userSnapshot.exists ? userSnapshot.data() : null;
    if (user) {
      assertUserUid(user, caregiverId);
      // The vendor record establishes caregiver membership. Allow legacy
      // customer-role profile documents, but never suspend a privileged admin
      // through the caregiver branch.
      assertUserRole(
        user,
        ["caregiver", "suspended", "user", "customer"],
        "caregiver",
      );
    }

    caregiverTargets.push({
      targetType: "caregiver",
      targetId: caregiverId,
      authUid: caregiverId,
      organizationId,
      vendor,
      vendorRef: db.collection("vendors").doc(caregiverId),
      user,
      userRef,
    });
  }

  return { caregivers: caregiverTargets, requiresPostCommitCascade: false };
}

async function resolveSafetyTarget({ db, targetType, targetId, reportId, read }) {
  if (targetType === "organization") {
    const organizationRef = db.collection("organizations").doc(targetId);
    const organizationSnapshot = await read(organizationRef);
    if (!organizationSnapshot.exists) {
      throw new HttpsError("not-found", "The organization record was not found.");
    }

    const organization = organizationSnapshot.data();
    if (
      organization.organizationId !== undefined &&
      organization.organizationId !== targetId
    ) {
      throw new HttpsError(
        "failed-precondition",
        "The organization record does not match the requested target.",
      );
    }

    assertSafeDocumentId(organization.adminUid, "organization admin UID");
    const userRef = db.collection("users").doc(organization.adminUid);
    const userSnapshot = await read(userRef);
    if (!userSnapshot.exists) {
      throw new HttpsError(
        "failed-precondition",
        "The organization admin user record was not found.",
      );
    }

    const user = userSnapshot.data();
    assertUserUid(user, organization.adminUid);
    assertUserRole(user, ["orgadmin", "suspended", "user"], "organization");

    let caregiverResolution;
    try {
      caregiverResolution = await resolveOrganizationCaregivers({
        db,
        organization,
        organizationId: targetId,
        read,
      });
    } catch (error) {
      if (!(error instanceof HttpsError) || error.code !== "failed-precondition") {
        throw error;
      }
      // Corrupt legacy membership data must not prevent the parent
      // organization from being blocked. The post-commit query cascade uses
      // the canonical vendor.organizationId relationship instead.
      logger.warn("Falling back to the post-commit organization safety cascade.", {
        organizationId: targetId,
        code: error.code,
      });
      caregiverResolution = {
        caregivers: [],
        requiresPostCommitCascade: true,
      };
    }
    const { caregivers, requiresPostCommitCascade } = caregiverResolution;
    if (caregivers.some((caregiver) => caregiver.authUid === organization.adminUid)) {
      throw new HttpsError(
        "failed-precondition",
        "The organization admin cannot also be an affiliated caregiver.",
      );
    }

    return {
      targetType,
      targetId,
      authUid: organization.adminUid,
      authUids: [organization.adminUid, ...caregivers.map((item) => item.authUid)],
      organization,
      organizationRef,
      user,
      userRef,
      caregivers,
      requiresPostCommitCascade,
    };
  }

  if (targetType === "caregiver") {
    const vendorRef = db.collection("vendors").doc(targetId);
    const vendorSnapshot = await read(vendorRef);
    if (!vendorSnapshot.exists) {
      throw new HttpsError("not-found", "The caregiver record was not found.");
    }

    const vendor = vendorSnapshot.data();
    assertCaregiverVendor(vendor, targetId);

    const userRef = db.collection("users").doc(targetId);
    const userSnapshot = await read(userRef);
    const user = userSnapshot.exists ? userSnapshot.data() : null;
    if (user) {
      assertUserUid(user, targetId);
      assertUserRole(
        user,
        ["caregiver", "suspended", "user", "customer"],
        "caregiver",
      );
    }

    return {
      targetType,
      targetId,
      authUid: targetId,
      authUids: [targetId],
      organizationId:
        typeof vendor.organizationId === "string" ? vendor.organizationId : "",
      vendor,
      vendorRef,
      user,
      userRef,
    };
  }

  if (targetType !== "customer") {
    throw new HttpsError("invalid-argument", "targetType is invalid.");
  }

  const userRef = db.collection("users").doc(targetId);
  const vendorRef = db.collection("vendors").doc(targetId);
  const organizationRef = db.collection("organizations").doc(targetId);
  const [userSnapshot, vendorSnapshot, organizationSnapshot] = await Promise.all([
    read(userRef),
    read(vendorRef),
    read(organizationRef),
  ]);

  if (!userSnapshot.exists) {
    throw new HttpsError("not-found", "The customer record was not found.");
  }
  if (vendorSnapshot.exists || organizationSnapshot.exists) {
    throw new HttpsError(
      "failed-precondition",
      "The target must be actioned using its privileged account type.",
    );
  }

  const user = userSnapshot.data();
  assertUserUid(user, targetId);
  assertUserRole(user, ["user", "customer"], "customer");

  const reportRef = reportId
    ? db.collection("blacklistReports").doc(reportId)
    : null;
  if (reportRef) {
    const reportSnapshot = await read(reportRef);
    assertPendingCustomerReport(reportSnapshot, targetId);
  }

  return {
    targetType,
    targetId,
    authUid: targetId,
    authUids: [targetId],
    user,
    userRef,
    reportRef,
  };
}

async function assertTargetIsNotSuperAdmin(authUid) {
  try {
    const authUser = await getAuth().getUser(authUid);
    if (authUser.customClaims?.[PLATFORM_ROLE_CLAIM] === SUPER_ADMIN_ROLE) {
      throw new HttpsError(
        "failed-precondition",
        "Super-admin accounts must use a separate protected safety process.",
      );
    }
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    if (error && error.code === "auth/user-not-found") {
      // Legacy Firestore-only records can still be made unable to book or
      // provision accounts, even though there is no Auth account to disable.
      return;
    }
    logger.error("Unable to validate the target Auth account before a safety action.", {
      authUid,
      code: error && error.code ? error.code : "unknown",
    });
    throw new HttpsError(
      "unavailable",
      "The target Auth account could not be verified. Try again shortly.",
    );
  }
}

async function mapWithConcurrency(items, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(AUTH_REVOCATION_CONCURRENCY, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    }),
  );
  return results;
}

async function assertTargetsAreNotSuperAdmins(authUids) {
  const uniqueAuthUids = [...new Set(authUids)];
  await mapWithConcurrency(uniqueAuthUids, assertTargetIsNotSuperAdmin);
}

function userSafetyPatch({ requesterUid, reason, revokeRole }) {
  const patch = {
    isApproved: false,
    verified: false,
    isSuspended: true,
    isBlacklisted: true,
    rejectedAt: FieldValue.serverTimestamp(),
    rejectedBy: requesterUid,
    rejectionReason: reason,
    blacklistedAt: FieldValue.serverTimestamp(),
    blacklistedBy: requesterUid,
    blacklistReason: reason,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (revokeRole) {
    patch.role = "suspended";
    patch.roleSource = "safety-action";
  }

  return patch;
}

function organizationSafetyPatch({ requesterUid, reason }) {
  return {
    isApproved: false,
    verified: false,
    isSuspended: true,
    isBlacklisted: true,
    role: "suspended",
    rejectedAt: FieldValue.serverTimestamp(),
    rejectedBy: requesterUid,
    rejectionReason: reason,
    blacklistedAt: FieldValue.serverTimestamp(),
    blacklistedBy: requesterUid,
    blacklistReason: reason,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function caregiverSafetyPatch({ requesterUid, reason }) {
  return {
    isApproved: false,
    verified: false,
    isAvailable: false,
    isSuspended: true,
    isBlacklisted: true,
    rejectedAt: FieldValue.serverTimestamp(),
    rejectedBy: requesterUid,
    rejectionReason: reason,
    blacklistedAt: FieldValue.serverTimestamp(),
    blacklistedBy: requesterUid,
    blacklistReason: reason,
    suspendedAt: FieldValue.serverTimestamp(),
    suspendedBy: requesterUid,
    suspendedReason: reason,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function blacklistRecord({ target, requesterUid, reason, reportId }) {
  return {
    userId: target.authUid,
    userType: target.targetType,
    organizationId:
      target.targetType === "organization"
        ? target.targetId
        : target.organizationId || target.vendor?.organizationId || "",
    reason,
    addedAt: FieldValue.serverTimestamp(),
    approvedBy: requesterUid,
    blacklistedBy: requesterUid,
    ...(reportId ? { originalReportId: reportId } : {}),
  };
}

function organizationBlacklistRecord({ target, requesterUid, reason }) {
  return {
    organizationId: target.organizationId || target.vendor.organizationId,
    caregiverId: target.authUid,
    caregiverName:
      typeof target.vendor.name === "string" ? target.vendor.name : "",
    caregiverEmail:
      typeof target.vendor.email === "string" ? target.vendor.email : "",
    reason,
    description: reason,
    blacklistedAt: FieldValue.serverTimestamp(),
    blacklistedBy: requesterUid,
    blacklistedByName: requesterUid,
  };
}

function writeCaregiverSafety({ transaction, db, target, requesterUid, reason }) {
  transaction.update(
    target.vendorRef,
    caregiverSafetyPatch({ requesterUid, reason }),
  );
  if (target.user) {
    transaction.update(
      target.userRef,
      userSafetyPatch({ requesterUid, reason, revokeRole: true }),
    );
  }
  transaction.delete(db.collection("publicCaregivers").doc(target.authUid));
  transaction.set(
    db.collection("blacklist").doc(target.authUid),
    blacklistRecord({ target, requesterUid, reason }),
    { merge: true },
  );

  if (target.organizationId || target.vendor.organizationId) {
    transaction.set(
      db.collection("organizationBlacklist").doc(target.authUid),
      organizationBlacklistRecord({ target, requesterUid, reason }),
      { merge: true },
    );
  }
}

function safelySuspendableCaregiverUser(userSnapshot, caregiverId) {
  if (!userSnapshot.exists) {
    return null;
  }

  const user = userSnapshot.data();
  if (
    (user.uid !== undefined && user.uid !== caregiverId) ||
    user.role === SUPER_ADMIN_ROLE
  ) {
    logger.warn("Skipping a malformed or protected caregiver user record during organization safety cascade.", {
      caregiverId,
    });
    return null;
  }

  return user;
}

async function cascadeOrganizationCaregivers({
  organizationId,
  requesterUid,
  reason,
}) {
  const db = getFirestore();
  let caregiverCount = 0;
  let userSuspendedCount = 0;
  let authUids = [];

  try {
    const vendorSnapshot = await db
      .collection("vendors")
      .where("organizationId", "==", organizationId)
      .get();

    for (
      let start = 0;
      start < vendorSnapshot.docs.length;
      start += ORGANIZATION_CASCADE_BATCH_SIZE
    ) {
      const vendorChunk = vendorSnapshot.docs.slice(
        start,
        start + ORGANIZATION_CASCADE_BATCH_SIZE,
      );
      const userSnapshots = await db.getAll(
        ...vendorChunk.map((vendor) => db.collection("users").doc(vendor.id)),
      );
      const batch = db.batch();
      const chunkAuthUids = [];
      let chunkUserSuspendedCount = 0;

      vendorChunk.forEach((vendorSnapshotItem, index) => {
        const caregiverId = vendorSnapshotItem.id;
        const vendor = vendorSnapshotItem.data();
        const user = safelySuspendableCaregiverUser(
          userSnapshots[index],
          caregiverId,
        );
        const target = {
          targetType: "caregiver",
          targetId: caregiverId,
          authUid: caregiverId,
          organizationId,
          vendor,
          vendorRef: vendorSnapshotItem.ref,
          user,
          userRef: db.collection("users").doc(caregiverId),
        };

        writeCaregiverSafety({
          transaction: batch,
          db,
          target,
          requesterUid,
          reason,
        });
        chunkAuthUids.push(caregiverId);
        if (user) {
          chunkUserSuspendedCount += 1;
        }
      });

      await batch.commit();
      caregiverCount += vendorChunk.length;
      userSuspendedCount += chunkUserSuspendedCount;
      authUids = authUids.concat(chunkAuthUids);
    }

    return {
      status: "complete",
      caregiverCount,
      userSuspendedCount,
      authUids,
    };
  } catch (error) {
    logger.error("Organization caregiver safety cascade was only partially applied.", {
      organizationId,
      caregiverCount,
      code: error && error.code ? error.code : "unknown",
    });
    return {
      status: "partial",
      caregiverCount,
      userSuspendedCount,
      authUids,
      failureCode: error && error.code ? error.code : "unknown",
    };
  }
}

async function processOrganizationSafetyCascadeJob({ organizationId }) {
  assertSafeDocumentId(organizationId, "organization ID");

  const db = getFirestore();
  const jobRef = db
    .collection("organizationSafetyCascades")
    .doc(organizationId);
  const jobSnapshot = await jobRef.get();
  if (!jobSnapshot.exists || jobSnapshot.data().status !== "pending") {
    return { status: "ignored" };
  }

  const job = jobSnapshot.data();
  if (
    job.organizationId !== organizationId ||
    typeof job.requesterUid !== "string" ||
    typeof job.reason !== "string" ||
    !job.reason
  ) {
    await jobRef.set(
      {
        status: "failed",
        failureCode: "invalid-job",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw new Error("Organization safety cascade job is invalid.");
  }

  try {
    let vendorQuery = db
      .collection("vendors")
      .where("organizationId", "==", organizationId)
      .orderBy(FieldPath.documentId())
      .limit(ORGANIZATION_CASCADE_BATCH_SIZE);
    if (typeof job.cursor === "string" && job.cursor) {
      vendorQuery = vendorQuery.startAfter(job.cursor);
    }

    const vendorSnapshot = await vendorQuery.get();
    if (vendorSnapshot.empty) {
      await jobRef.update({
        status: "complete",
        cursor: FieldValue.delete(),
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: "complete", processedCaregiverCount: 0 };
    }

    const userSnapshots = await db.getAll(
      ...vendorSnapshot.docs.map((vendor) =>
        db.collection("users").doc(vendor.id),
      ),
    );
    const batch = db.batch();
    const authUids = [];
    let userSuspendedCount = 0;

    vendorSnapshot.docs.forEach((vendorSnapshotItem, index) => {
      const caregiverId = vendorSnapshotItem.id;
      const vendor = vendorSnapshotItem.data();
      const user = safelySuspendableCaregiverUser(
        userSnapshots[index],
        caregiverId,
      );
      const target = {
        targetType: "caregiver",
        targetId: caregiverId,
        authUid: caregiverId,
        organizationId,
        vendor,
        vendorRef: vendorSnapshotItem.ref,
        user,
        userRef: db.collection("users").doc(caregiverId),
      };

      writeCaregiverSafety({
        transaction: batch,
        db,
        target,
        requesterUid: job.requesterUid,
        reason: job.reason,
      });
      authUids.push(caregiverId);
      if (user) {
        userSuspendedCount += 1;
      }
    });

    await batch.commit();
    const authResult = await revokeAuthAccesses(authUids);
    if (authResult.status === "partial") {
      await jobRef.set(
        {
          status: "pending",
          lastAuthFailureCount: authResult.failureCount,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      throw new Error("Organization caregiver Auth revocation is incomplete.");
    }

    await jobRef.update({
      status: "pending",
      cursor: vendorSnapshot.docs[vendorSnapshot.docs.length - 1].id,
      processedCaregiverCount: FieldValue.increment(vendorSnapshot.size),
      lastAuthFailureCount: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      status: "pending",
      processedCaregiverCount: vendorSnapshot.size,
      userSuspendedCount,
      authRevocationStatus: authResult.status,
    };
  } catch (error) {
    logger.error("Organization caregiver Auth cascade page failed.", {
      organizationId,
      code: error && error.code ? error.code : "unknown",
    });
    await jobRef.set(
      {
        status: "pending",
        lastFailureCode: error && error.code ? error.code : "unknown",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw error;
  }
}

function sameStringSet(first, second) {
  const firstSet = new Set(first);
  const secondSet = new Set(second);
  if (firstSet.size !== secondSet.size) {
    return false;
  }
  return [...firstSet].every((value) => secondSet.has(value));
}

async function applyFirestoreSafetyAction({ requester, input, expectedAuthUids }) {
  const db = getFirestore();
  const auditRef = db.collection("adminAuditLogs").doc();

  const result = await db.runTransaction(async (transaction) => {
    const target = await resolveSafetyTarget({
      db,
      targetType: input.targetType,
      targetId: input.targetId,
      reportId: input.reportId,
      read: (reference) => transaction.get(reference),
    });

    if (!sameStringSet(target.authUids, expectedAuthUids)) {
      throw new HttpsError(
        "aborted",
        "The target accounts changed while the safety action was being prepared.",
      );
    }

    if (target.targetType === "organization") {
      transaction.update(
        target.organizationRef,
        organizationSafetyPatch({ requesterUid: requester.uid, reason: input.reason }),
      );
      transaction.update(
        target.userRef,
        userSafetyPatch({
          requesterUid: requester.uid,
          reason: input.reason,
          revokeRole: true,
        }),
      );
      target.caregivers.forEach((caregiver) => {
        writeCaregiverSafety({
          transaction,
          db,
          target: caregiver,
          requesterUid: requester.uid,
          reason: input.reason,
        });
      });
      transaction.set(
        db.collection("blacklist").doc(target.authUid),
        blacklistRecord({
          target,
          requesterUid: requester.uid,
          reason: input.reason,
        }),
        { merge: true },
      );
      if (target.requiresPostCommitCascade) {
        transaction.set(
          db.collection("organizationSafetyCascades").doc(target.targetId),
          {
            organizationId: target.targetId,
            requesterUid: requester.uid,
            reason: input.reason,
            status: "pending",
            cursor: null,
            processedCaregiverCount: 0,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
        );
      }
    } else if (target.targetType === "caregiver") {
      writeCaregiverSafety({
        transaction,
        db,
        target,
        requesterUid: requester.uid,
        reason: input.reason,
      });
    } else {
      transaction.update(
        target.userRef,
        userSafetyPatch({
          requesterUid: requester.uid,
          reason: input.reason,
          revokeRole: false,
        }),
      );
      transaction.set(
        db.collection("blacklist").doc(target.authUid),
        blacklistRecord({
          target,
          requesterUid: requester.uid,
          reason: input.reason,
          reportId: input.reportId,
        }),
        { merge: true },
      );
      if (target.reportRef) {
        transaction.update(target.reportRef, {
          status: "approved",
          approvedAt: FieldValue.serverTimestamp(),
          approvedBy: requester.uid,
        });
      }
    }

    transaction.set(auditRef, {
      action: "account_safety_action_applied",
      actorUid: requester.uid,
      targetUid: target.authUid,
      targetId: target.targetId,
      targetType: target.targetType,
      reason: input.reason,
      cascadeCaregiverCount: target.caregivers ? target.caregivers.length : 0,
      caregiverCascadeStatus:
        target.requiresPostCommitCascade ? "pending" : "complete",
      authRevocationStatus: "pending",
      ...(input.reportId ? { reportId: input.reportId } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      auditId: auditRef.id,
      authUids: target.authUids,
      targetType: target.targetType,
      targetId: target.targetId,
      caregiverCount: target.caregivers ? target.caregivers.length : 0,
      requiresPostCommitCascade:
        target.requiresPostCommitCascade === true,
    };
  });

  return { db, ...result };
}

function authFailure(result, operation, error) {
  result.failures.push({
    operation,
    code: error && error.code ? error.code : "unknown",
  });
}

async function revokeAuthAccess(authUid) {
  const auth = getAuth();
  const result = {
    status: "complete",
    claimsRemoved: false,
    accountDisabled: false,
    refreshTokensRevoked: false,
    failures: [],
  };

  let authUser;
  try {
    authUser = await auth.getUser(authUid);
  } catch (error) {
    if (error && error.code === "auth/user-not-found") {
      return { ...result, status: "not-found" };
    }
    authFailure(result, "getUser", error);
    return { ...result, status: "partial" };
  }

  if (authUser.customClaims?.[PLATFORM_ROLE_CLAIM] === SUPER_ADMIN_ROLE) {
    // A concurrent trusted promotion cannot be safely revoked here. The
    // Firestore safety block remains committed and the audit is marked partial.
    authFailure(result, "protectSuperAdmin", {
      code: "auth/protected-superadmin",
    });
    return { ...result, status: "partial" };
  }

  const nextClaims = { ...(authUser.customClaims || {}) };
  delete nextClaims[PLATFORM_ROLE_CLAIM];
  delete nextClaims[ORGANIZATION_APPROVED_CLAIM];

  try {
    await auth.setCustomUserClaims(authUid, nextClaims);
    result.claimsRemoved = true;
  } catch (error) {
    authFailure(result, "setCustomUserClaims", error);
  }

  try {
    await auth.updateUser(authUid, { disabled: true });
    result.accountDisabled = true;
  } catch (error) {
    authFailure(result, "updateUser", error);
  }

  try {
    await auth.revokeRefreshTokens(authUid);
    result.refreshTokensRevoked = true;
  } catch (error) {
    authFailure(result, "revokeRefreshTokens", error);
  }

  if (result.failures.length > 0) {
    result.status = "partial";
  }
  return result;
}

async function revokeAuthAccesses(authUids) {
  const uniqueAuthUids = [...new Set(authUids)];
  const results = await mapWithConcurrency(uniqueAuthUids, revokeAuthAccess);
  const completeCount = results.filter((result) => result.status === "complete").length;
  const notFoundCount = results.filter((result) => result.status === "not-found").length;
  const partialCount = results.length - completeCount - notFoundCount;

  let status = "partial";
  if (completeCount === results.length) {
    status = "complete";
  } else if (notFoundCount === results.length) {
    status = "not-found";
  }

  return {
    status,
    targetCount: results.length,
    claimsRemovedCount: results.filter((result) => result.claimsRemoved).length,
    accountDisabledCount: results.filter((result) => result.accountDisabled).length,
    refreshTokensRevokedCount: results.filter(
      (result) => result.refreshTokensRevoked,
    ).length,
    notFoundCount,
    partialCount,
    failureCount: results.reduce(
      (total, result) => total + result.failures.length,
      0,
    ),
  };
}

async function finalizeSafetyAudit({ db, auditId, authResult, cascadeResult }) {
  try {
    await db.collection("adminAuditLogs").doc(auditId).update({
      authRevocationStatus: authResult.status,
      authTargetCount: authResult.targetCount,
      authClaimsRemovedCount: authResult.claimsRemovedCount,
      authAccountDisabledCount: authResult.accountDisabledCount,
      refreshTokensRevokedCount: authResult.refreshTokensRevokedCount,
      authNotFoundCount: authResult.notFoundCount,
      authPartialCount: authResult.partialCount,
      authFailureCount: authResult.failureCount,
      caregiverCascadeStatus: cascadeResult.status,
      caregiverCascadeDataStatus: cascadeResult.dataStatus || cascadeResult.status,
      caregiverCascadeCount: cascadeResult.caregiverCount,
      caregiverCascadeUserSuspendedCount: cascadeResult.userSuspendedCount,
      ...(cascadeResult.failureCode
        ? { caregiverCascadeFailureCode: cascadeResult.failureCode }
        : {}),
      authRevocationCompletedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error("Unable to finalize a safety-action audit record.", {
      auditId,
      code: error && error.code ? error.code : "unknown",
    });
  }
}

async function applyAccountSafetyAction({ requester, input }) {
  const db = getFirestore();
  const preflightTarget = await resolveSafetyTarget({
    db,
    targetType: input.targetType,
    targetId: input.targetId,
    reportId: input.reportId,
    read: (reference) => reference.get(),
  });
  await assertTargetsAreNotSuperAdmins(preflightTarget.authUids);

  const action = await applyFirestoreSafetyAction({
    requester,
    input,
    expectedAuthUids: preflightTarget.authUids,
  });

  let cascadeResult = {
    status: "not-required",
    dataStatus: "not-required",
    caregiverCount: action.caregiverCount,
    userSuspendedCount: 0,
  };
  if (
    action.targetType === "organization" &&
    action.requiresPostCommitCascade
  ) {
    const immediateCascadeResult = await cascadeOrganizationCaregivers({
      organizationId: action.targetId,
      requesterUid: requester.uid,
      reason: input.reason,
    });
    cascadeResult = {
      ...immediateCascadeResult,
      // The server-only trigger created in the same transaction continues
      // credential revocation cursor by cursor. A partial immediate data pass
      // is safe because the parent organization rule already blocks work.
      status: "queued",
      dataStatus: immediateCascadeResult.status,
    };
  }

  // For a large organization, the parent organization state blocks caregiver
  // operations immediately. Its server-only cursor worker continues staff
  // credential revocation after this callable returns, avoiding a timeout
  // after the safety block has committed.
  const authResult = await revokeAuthAccesses(action.authUids);
  await finalizeSafetyAudit({
    db: action.db,
    auditId: action.auditId,
    authResult,
    cascadeResult,
  });

  logger.info("Account safety action applied.", {
    actorUid: requester.uid,
    targetType: action.targetType,
    targetId: action.targetId,
    caregiverCount: action.caregiverCount,
    caregiverCascadeStatus: cascadeResult.status,
    caregiverCascadeDataStatus: cascadeResult.dataStatus,
    caregiverCascadeCount: cascadeResult.caregiverCount,
    authRevocationStatus: authResult.status,
  });

  return {
    targetId: action.targetId,
    targetType: action.targetType,
    affectedCaregiverCount:
      action.caregiverCount || cascadeResult.caregiverCount,
    accountSuspended: true,
    authRevocationStatus: authResult.status,
    caregiverCascadeStatus: cascadeResult.status,
    caregiverAuthRevocationDeferred:
      action.requiresPostCommitCascade === true,
  };
}

module.exports = {
  applyAccountSafetyAction,
  processOrganizationSafetyCascadeJob,
};
