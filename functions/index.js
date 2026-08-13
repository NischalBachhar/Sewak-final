"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const {
  requireApprovedOrganizationAdmin,
  requireAuthenticated,
  requireSuperAdmin,
} = require("./src/authz");
const {
  normalizeAccountSafetyActionInput,
  normalizeCaregiverProvisioningInput,
  normalizeOrganizationApplicationApprovalInput,
  normalizeOrganizationApprovalInput,
  normalizeOrganizationProvisioningInput,
  normalizePaymentVerificationInput,
  normalizePublicCaregiverBackfillInput,
  normalizeSuperAdminProvisioningInput,
} = require("./src/validation");
const {
  applyAccountSafetyAction,
  processOrganizationSafetyCascadeJob,
} = require("./src/account-safety");
const {
  provisionCaregiverAccount,
  provisionOrganizationAccount,
  provisionSuperAdminAccount,
} = require("./src/provisioning");
const { approveOrganizationAccount } = require("./src/organization-approval");
const {
  approveOrganizationApplication,
} = require("./src/organization-application");
const {
  backfillPublicCaregivers,
  backfillPublicReviews,
  backfillPublicServices,
  onOrganizationWritten,
  onReviewWritten,
  onServiceWritten,
  onVendorWritten,
} = require("./src/public-projections");
const { assertFonepayServerConfig, verifyFonepayPayment } = require("./src/fonepay");

if (getApps().length === 0) {
  initializeApp();
}

const callableOptions = {
  region: "asia-south1",
  enforceAppCheck: true,
  maxInstances: 5,
  memory: "256MiB",
  timeoutSeconds: 60,
};

function asCallableError(error, fallbackMessage) {
  if (error instanceof HttpsError) {
    return error;
  }

  if (error && error.code === "auth/email-already-exists") {
    return new HttpsError(
      "already-exists",
      "An account already exists for that email address.",
    );
  }

  logger.error(fallbackMessage, {
    code: error && error.code ? error.code : "unknown",
  });
  return new HttpsError("internal", fallbackMessage);
}

exports.provisionOrganizationAccount = onCall(
  callableOptions,
  async (request) => {
    const requester = requireSuperAdmin(request);
    const input = normalizeOrganizationProvisioningInput(request.data);

    try {
      return await provisionOrganizationAccount({ requester, input });
    } catch (error) {
      throw asCallableError(error, "Unable to provision the organization account.");
    }
  },
);

exports.approveOrganizationAccount = onCall(
  callableOptions,
  async (request) => {
    const requester = requireSuperAdmin(request);
    const input = normalizeOrganizationApprovalInput(request.data);

    try {
      return await approveOrganizationAccount({
        requester,
        organizationId: input.organizationId,
      });
    } catch (error) {
      throw asCallableError(error, "Unable to approve the organization account.");
    }
  },
);

exports.approveOrganizationApplication = onCall(
  callableOptions,
  async (request) => {
    const requester = requireSuperAdmin(request);
    const input = normalizeOrganizationApplicationApprovalInput(request.data);

    try {
      return await approveOrganizationApplication({
        requester,
        applicationId: input.applicationId,
      });
    } catch (error) {
      throw asCallableError(
        error,
        "Unable to approve the organization application.",
      );
    }
  },
);

exports.provisionSuperAdminAccount = onCall(
  callableOptions,
  async (request) => {
    const requester = requireSuperAdmin(request);
    const input = normalizeSuperAdminProvisioningInput(request.data);

    try {
      return await provisionSuperAdminAccount({ requester, input });
    } catch (error) {
      throw asCallableError(error, "Unable to provision the super admin account.");
    }
  },
);

exports.provisionCaregiverAccount = onCall(
  callableOptions,
  async (request) => {
    const requester = requireApprovedOrganizationAdmin(request);
    const input = normalizeCaregiverProvisioningInput(request.data);

    try {
      return await provisionCaregiverAccount({ requester, input });
    } catch (error) {
      throw asCallableError(error, "Unable to provision the caregiver account.");
    }
  },
);

exports.applyAccountSafetyAction = onCall(
  callableOptions,
  async (request) => {
    const requester = requireSuperAdmin(request);
    const input = normalizeAccountSafetyActionInput(request.data);

    try {
      return await applyAccountSafetyAction({ requester, input });
    } catch (error) {
      throw asCallableError(error, "Unable to apply the account safety action.");
    }
  },
);

// Large organization safety actions use this retrying, cursor-based worker so
// Firebase Auth revocation is not abandoned after the Firestore transaction
// reaches its write limit. The document is server-only under Firestore Rules.
exports.processOrganizationSafetyCascade = onDocumentWritten(
  {
    document: "organizationSafetyCascades/{organizationId}",
    region: "asia-south1",
    retry: true,
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async (event) => {
    if (!event.data?.after.exists) {
      return null;
    }
    return processOrganizationSafetyCascadeJob({
      organizationId: event.params.organizationId,
    });
  },
);

// These event handlers create only PII-free records for public browse/profile
// surfaces. They do not expose the private vendors or reviews collections.
exports.syncPublicCaregiverProjection = onVendorWritten;
exports.syncPublicOrganizationProjection = onOrganizationWritten;
exports.syncPublicReviewProjection = onReviewWritten;
exports.syncPublicServiceProjection = onServiceWritten;

exports.backfillPublicCaregivers = onCall(
  callableOptions,
  async (request) => {
    requireSuperAdmin(request);
    const input = normalizePublicCaregiverBackfillInput(request.data);
    try {
      return await backfillPublicCaregivers(input);
    } catch (error) {
      throw asCallableError(
        error,
        "Unable to backfill public caregiver profiles.",
      );
    }
  },
);

exports.backfillPublicReviews = onCall(
  callableOptions,
  async (request) => {
    requireSuperAdmin(request);
    const input = normalizePublicCaregiverBackfillInput(request.data);
    try {
      return await backfillPublicReviews(input);
    } catch (error) {
      throw asCallableError(error, "Unable to backfill public reviews.");
    }
  },
);

exports.backfillPublicServices = onCall(
  callableOptions,
  async (request) => {
    requireSuperAdmin(request);
    const input = normalizePublicCaregiverBackfillInput(request.data);
    try {
      return await backfillPublicServices(input);
    } catch (error) {
      throw asCallableError(error, "Unable to backfill public services.");
    }
  },
);

exports.verifyFonepayPayment = onCall(
  {
    ...callableOptions,
    secrets: [
      "FONEPAY_MERCHANT_CODE",
      "FONEPAY_SECRET",
      "FONEPAY_VERIFY_URL",
    ],
  },
  async (request) => {
    const requester = requireAuthenticated(request);
    const input = normalizePaymentVerificationInput(request.data);

    assertFonepayServerConfig();

    // The adapter intentionally fails closed until an official, server-to-server
    // Fonepay verification contract is implemented. It never accepts a client
    // redirect status, amount, transaction ID, or booking data as proof of payment.
    return verifyFonepayPayment({ requester, paymentReference: input.paymentReference });
  },
);
