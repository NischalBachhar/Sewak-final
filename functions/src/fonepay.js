"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

const REQUIRED_FONEPAY_SECRETS = [
  "FONEPAY_MERCHANT_CODE",
  "FONEPAY_SECRET",
  "FONEPAY_VERIFY_URL",
];

function assertFonepayServerConfig() {
  const missing = REQUIRED_FONEPAY_SECRETS.filter(
    (name) => !process.env[name] || !process.env[name].trim(),
  );

  if (missing.length > 0) {
    throw new HttpsError(
      "failed-precondition",
      "Secure Fonepay verification is not configured. The payment remains unpaid.",
    );
  }

  let verifyUrl;
  try {
    verifyUrl = new URL(process.env.FONEPAY_VERIFY_URL);
  } catch {
    throw new HttpsError(
      "failed-precondition",
      "Fonepay verification is not configured with a valid HTTPS endpoint.",
    );
  }

  if (verifyUrl.protocol !== "https:") {
    throw new HttpsError(
      "failed-precondition",
      "Fonepay verification is not configured with a valid HTTPS endpoint.",
    );
  }
}

async function verifyFonepayPayment({ requester, paymentReference }) {
  logger.warn("Fonepay verification was requested before an adapter was enabled.", {
    requesterUid: requester.uid,
    paymentReferenceLength: paymentReference.length,
  });

  // Never write paymentStatus, bookings, earnings, or other business records
  // from a callable request. A production adapter must verify Fonepay's
  // server-to-server signature and amount against a server-created payment
  // intent, then perform an idempotent transaction.
  throw new HttpsError(
    "unimplemented",
    "Fonepay verification is not enabled. The payment remains unpaid.",
  );
}

module.exports = {
  assertFonepayServerConfig,
  verifyFonepayPayment,
};
