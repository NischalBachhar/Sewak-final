"use strict";

const { FieldPath, FieldValue, getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

const FUNCTION_REGION = "asia-south1";
const MAX_BACKFILL_BATCH = 400;

function isPubliclyBookable(vendor) {
  return (
    vendor &&
    vendor.isApproved === true &&
    vendor.isSuspended !== true &&
    vendor.isBlacklisted !== true
  );
}

function organizationIdFor(vendor) {
  return safeString(vendor?.organizationId, 128);
}

async function isOrganizationPubliclyActive(vendor) {
  const organizationId = organizationIdFor(vendor);
  if (!organizationId) {
    return true;
  }

  const organizationSnapshot = await getFirestore()
    .collection("organizations")
    .doc(organizationId)
    .get();
  if (!organizationSnapshot.exists) {
    return false;
  }

  const organization = organizationSnapshot.data();
  return (
    organization.isApproved === true &&
    organization.isSuspended !== true &&
    organization.isBlacklisted !== true
  );
}

function numberInRange(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum
    ? numeric
    : fallback;
}

function safeString(value, maximum = 500) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

function publicCaregiverRecord(caregiverId, vendor, organizationActive) {
  const reviewCount = numberInRange(vendor.reviewCount, 0, 1000000, 0);
  const rating = reviewCount > 0
    ? numberInRange(vendor.rating, 0, 5, 0)
    : 0;

  // Keep this payload deliberately PII-free. Contact data, earnings, and
  // operational audit fields stay in vendors/. The organization ID is the
  // minimum opaque booking-routing identifier needed for a customer-created
  // request to appear in the correct organization queue.
  return {
    caregiverId,
    name: safeString(vendor.name, 120),
    location: safeString(vendor.location, 160),
    category: safeString(vendor.category, 32),
    workType: safeString(vendor.workType, 32),
    shifts: Array.isArray(vendor.shifts) ? vendor.shifts.slice(0, 3) : [],
    servicesOffered: Array.isArray(vendor.servicesOffered)
      ? vendor.servicesOffered.slice(0, 20)
      : [],
    hourlyRate: numberInRange(vendor.hourlyRate, 0, 1000000, 0),
    experience: numberInRange(vendor.experience, 0, 100, 0),
    bio: safeString(vendor.bio, 1000),
    jobsCompleted: numberInRange(vendor.jobsCompleted, 0, 1000000, 0),
    rating,
    reviewCount,
    verified: vendor.verified === true,
    backgroundChecked: vendor.backgroundChecked === true,
    isCertified: vendor.isCertified === true,
    isAvailable: vendor.isAvailable === true,
    isApproved: true,
    isSuspended: false,
    isBlacklisted: false,
    isOrganizationActive: organizationActive === true,
    organizationId: safeString(vendor.organizationId, 128),
    organizationName: safeString(vendor.organizationName, 160),
    identityVerificationStatus: safeString(
      vendor.identityVerificationStatus,
      32,
    ) || "not_verified",
    phoneVerificationStatus: safeString(vendor.phoneVerificationStatus, 32) ||
      "not_verified",
    trainingVerificationStatus: safeString(
      vendor.trainingVerificationStatus,
      32,
    ) || "not_verified",
    backgroundVerificationStatus: safeString(
      vendor.backgroundVerificationStatus,
      32,
    ) || "not_verified",
    referencesVerificationStatus: safeString(
      vendor.referencesVerificationStatus,
      32,
    ) || "not_verified",
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function syncPublicCaregiver(
  caregiverId,
  vendor,
  knownOrganizationActive,
) {
  const db = getFirestore();
  const publicRef = db.collection("publicCaregivers").doc(caregiverId);
  const organizationActive =
    knownOrganizationActive === undefined
      ? await isOrganizationPubliclyActive(vendor)
      : knownOrganizationActive;

  if (!isPubliclyBookable(vendor) || !organizationActive) {
    await publicRef.delete();
    return { visible: false };
  }

  await publicRef.set(
    publicCaregiverRecord(caregiverId, vendor, organizationActive),
  );
  return { visible: true };
}

function publicServiceRecord(serviceId, service) {
  const label = safeString(service.label || service.serviceName, 160);
  return {
    serviceId,
    label,
    serviceName: safeString(service.serviceName || label, 160),
    category: safeString(service.category, 32),
    description: safeString(service.description, 1000),
    price: numberInRange(service.price, 0, 1000000, 0),
    isActive: service.isActive !== false,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function isPublicService(service) {
  return (
    service &&
    service.isActive !== false &&
    safeString(service.label || service.serviceName, 160)
  );
}

async function syncPublicService(serviceId, service) {
  const db = getFirestore();
  const publicRef = db.collection("publicServices").doc(serviceId);

  if (!isPublicService(service)) {
    await publicRef.delete();
    return { visible: false };
  }

  await publicRef.set(publicServiceRecord(serviceId, service));
  return { visible: true };
}

function publicReviewRecord(bookingId, review) {
  return {
    bookingId,
    caregiverId: safeString(review.caregiverId, 128),
    rating: numberInRange(review.rating, 1, 5, 0),
    comment: safeString(review.comment, 600),
    isVerifiedReview: true,
    createdAt: review.createdAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function isPublicVerifiedReview(review) {
  return (
    review &&
    review.isVerifiedReview === true &&
    safeString(review.caregiverId, 128) &&
    numberInRange(review.rating, 1, 5, 0) > 0
  );
}

async function syncPublicReview(bookingId, review) {
  const db = getFirestore();
  const publicReviewRef = db.collection("publicReviews").doc(bookingId);

  if (!isPublicVerifiedReview(review)) {
    await publicReviewRef.delete();
    return "";
  }

  await publicReviewRef.set(publicReviewRecord(bookingId, review));
  return safeString(review.caregiverId, 128);
}

async function refreshCaregiverReviewSummary(caregiverId) {
  if (!caregiverId) return;
  const db = getFirestore();
  const snapshot = await db
    .collection("reviews")
    .where("caregiverId", "==", caregiverId)
    .where("isVerifiedReview", "==", true)
    .get();

  const ratings = snapshot.docs
    .map((item) => Number(item.data().rating))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  const reviewCount = ratings.length;
  const rating = reviewCount
    ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / reviewCount) * 10) / 10
    : 0;

  const vendorRef = db.collection("vendors").doc(caregiverId);
  const vendorSnapshot = await vendorRef.get();
  if (!vendorSnapshot.exists) return;

  await vendorRef.update({
    reviewCount,
    rating,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

const onVendorWritten = onDocumentWritten(
  { document: "vendors/{caregiverId}", region: FUNCTION_REGION },
  async (event) => {
    const caregiverId = event.params.caregiverId;
    const after = event.data?.after;
    const vendor = after?.exists ? after.data() : null;

    try {
      await syncPublicCaregiver(caregiverId, vendor);
    } catch (error) {
      logger.error("Unable to synchronize public caregiver projection.", {
        caregiverId,
        code: error && error.code ? error.code : "unknown",
      });
      throw error;
    }
  },
);

function organizationPublicStateChanged(before, after) {
  return (
    !before ||
    !after ||
    before.isApproved !== after.isApproved ||
    before.isSuspended !== after.isSuspended ||
    before.isBlacklisted !== after.isBlacklisted
  );
}

const onOrganizationWritten = onDocumentWritten(
  { document: "organizations/{organizationId}", region: FUNCTION_REGION, retry: true },
  async (event) => {
    const organizationId = event.params.organizationId;
    const before = event.data?.before;
    const after = event.data?.after;
    const beforeData = before?.exists ? before.data() : null;
    const afterData = after?.exists ? after.data() : null;
    if (!organizationPublicStateChanged(beforeData, afterData)) {
      return null;
    }

    const organizationActive = Boolean(
      afterData &&
        afterData.isApproved === true &&
        afterData.isSuspended !== true &&
        afterData.isBlacklisted !== true,
    );

    try {
      const vendorSnapshot = await getFirestore()
        .collection("vendors")
        .where("organizationId", "==", organizationId)
        .get();
      const projectionBatchSize = 50;
      for (
        let start = 0;
        start < vendorSnapshot.docs.length;
        start += projectionBatchSize
      ) {
        const vendors = vendorSnapshot.docs.slice(
          start,
          start + projectionBatchSize,
        );
        await Promise.all(
          vendors.map((vendor) =>
            syncPublicCaregiver(
              vendor.id,
              vendor.data(),
              organizationActive,
            ),
          ),
        );
      }
      return null;
    } catch (error) {
      logger.error("Unable to synchronize organization caregiver projections.", {
        organizationId,
        code: error && error.code ? error.code : "unknown",
      });
      throw error;
    }
  },
);

const onReviewWritten = onDocumentWritten(
  { document: "reviews/{bookingId}", region: FUNCTION_REGION },
  async (event) => {
    const bookingId = event.params.bookingId;
    const before = event.data?.before;
    const after = event.data?.after;
    const beforeData = before?.exists ? before.data() : null;
    const afterData = after?.exists ? after.data() : null;
    const caregiverId = safeString(
      afterData?.caregiverId || beforeData?.caregiverId,
      128,
    );
    try {
      await syncPublicReview(bookingId, afterData);
      await refreshCaregiverReviewSummary(caregiverId);
    } catch (error) {
      logger.error("Unable to synchronize public review projection.", {
        bookingId,
        caregiverId,
        code: error && error.code ? error.code : "unknown",
      });
      throw error;
    }
  },
);

const onServiceWritten = onDocumentWritten(
  { document: "services/{serviceId}", region: FUNCTION_REGION },
  async (event) => {
    const serviceId = event.params.serviceId;
    const after = event.data?.after;
    const service = after?.exists ? after.data() : null;

    try {
      await syncPublicService(serviceId, service);
    } catch (error) {
      logger.error("Unable to synchronize public service projection.", {
        serviceId,
        code: error && error.code ? error.code : "unknown",
      });
      throw error;
    }
  },
);

async function backfillPublicCaregivers({ limit = MAX_BACKFILL_BATCH, cursor = "" }) {
  const db = getFirestore();
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || MAX_BACKFILL_BATCH, MAX_BACKFILL_BATCH));
  let vendorQuery = db
    .collection("vendors")
    .orderBy(FieldPath.documentId())
    .limit(normalizedLimit);

  if (cursor) {
    vendorQuery = vendorQuery.startAfter(cursor);
  }

  const snapshot = await vendorQuery.get();
  await Promise.all(
    snapshot.docs.map((vendorSnapshot) =>
      syncPublicCaregiver(vendorSnapshot.id, vendorSnapshot.data()),
    ),
  );

  return {
    processed: snapshot.size,
    nextCursor:
      snapshot.size === normalizedLimit
        ? snapshot.docs[snapshot.docs.length - 1].id
        : null,
  };
}

async function backfillPublicReviews({ limit = MAX_BACKFILL_BATCH, cursor = "" }) {
  const db = getFirestore();
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || MAX_BACKFILL_BATCH, MAX_BACKFILL_BATCH));
  let reviewQuery = db
    .collection("reviews")
    .orderBy(FieldPath.documentId())
    .limit(normalizedLimit);

  if (cursor) {
    reviewQuery = reviewQuery.startAfter(cursor);
  }

  const snapshot = await reviewQuery.get();
  const caregiverIds = new Set(
    (await Promise.all(
      snapshot.docs.map((reviewSnapshot) =>
        syncPublicReview(reviewSnapshot.id, reviewSnapshot.data()),
      ),
    )).filter(Boolean),
  );
  await Promise.all(
    [...caregiverIds].map((caregiverId) =>
      refreshCaregiverReviewSummary(caregiverId),
    ),
  );

  return {
    processed: snapshot.size,
    nextCursor:
      snapshot.size === normalizedLimit
        ? snapshot.docs[snapshot.docs.length - 1].id
        : null,
  };
}

async function backfillPublicServices({ limit = MAX_BACKFILL_BATCH, cursor = "" }) {
  const db = getFirestore();
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || MAX_BACKFILL_BATCH, MAX_BACKFILL_BATCH));
  let serviceQuery = db
    .collection("services")
    .orderBy(FieldPath.documentId())
    .limit(normalizedLimit);

  if (cursor) {
    serviceQuery = serviceQuery.startAfter(cursor);
  }

  const snapshot = await serviceQuery.get();
  await Promise.all(
    snapshot.docs.map((serviceSnapshot) =>
      syncPublicService(serviceSnapshot.id, serviceSnapshot.data()),
    ),
  );

  return {
    processed: snapshot.size,
    nextCursor:
      snapshot.size === normalizedLimit
        ? snapshot.docs[snapshot.docs.length - 1].id
        : null,
  };
}

module.exports = {
  backfillPublicCaregivers,
  backfillPublicReviews,
  backfillPublicServices,
  onReviewWritten,
  onOrganizationWritten,
  onServiceWritten,
  onVendorWritten,
};
