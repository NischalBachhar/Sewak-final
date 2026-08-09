"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "Request data must be an object.");
  }
  return value;
}

function rejectUnknownKeys(data, allowedKeys) {
  const unknownKeys = Object.keys(data).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknownKeys.length > 0) {
    throw new HttpsError(
      "invalid-argument",
      "Request contains unsupported fields.",
    );
  }
}

function requiredString(data, field, maxLength) {
  if (typeof data[field] !== "string") {
    throw new HttpsError("invalid-argument", field + " is required.");
  }

  const value = data[field].trim();
  if (!value || value.length > maxLength) {
    throw new HttpsError("invalid-argument", field + " is invalid.");
  }

  return value;
}

function optionalString(data, field, maxLength) {
  if (data[field] === undefined || data[field] === null) {
    return "";
  }

  if (typeof data[field] !== "string") {
    throw new HttpsError("invalid-argument", field + " must be a string.");
  }

  const value = data[field].trim();
  if (value.length > maxLength) {
    throw new HttpsError("invalid-argument", field + " is too long.");
  }

  return value;
}

function requiredNumber(data, field, minimum, maximum, integer) {
  const value = data[field];
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  ) {
    throw new HttpsError("invalid-argument", field + " is invalid.");
  }
  return value;
}

function optionalStringArray(data, field, allowedValues, maxItems, maxItemLength) {
  if (data[field] === undefined || data[field] === null) {
    return [];
  }

  if (!Array.isArray(data[field]) || data[field].length > maxItems) {
    throw new HttpsError("invalid-argument", field + " is invalid.");
  }

  const values = data[field].map((value) => {
    if (typeof value !== "string") {
      throw new HttpsError("invalid-argument", field + " is invalid.");
    }
    const normalized = value.trim();
    if (
      !normalized ||
      normalized.length > maxItemLength ||
      (allowedValues && !allowedValues.includes(normalized))
    ) {
      throw new HttpsError("invalid-argument", field + " is invalid.");
    }
    return normalized;
  });

  if (new Set(values).size !== values.length) {
    throw new HttpsError("invalid-argument", field + " cannot contain duplicates.");
  }

  return values;
}

function requiredEmail(data) {
  const email = requiredString(data, "email", 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpsError("invalid-argument", "email is invalid.");
  }
  return email;
}

function normalizeOrganizationProvisioningInput(data) {
  const value = requireObject(data);
  rejectUnknownKeys(value, [
    "email",
    "displayName",
    "organizationName",
    "businessPhone",
    "businessAddress",
    "businessCity",
  ]);

  return {
    email: requiredEmail(value),
    displayName: requiredString(value, "displayName", 120),
    organizationName: requiredString(value, "organizationName", 160),
    businessPhone: optionalString(value, "businessPhone", 40),
    businessAddress: optionalString(value, "businessAddress", 300),
    businessCity: optionalString(value, "businessCity", 100),
  };
}

function normalizeSuperAdminProvisioningInput(data) {
  const value = requireObject(data);
  rejectUnknownKeys(value, ["email", "displayName"]);

  return {
    email: requiredEmail(value),
    displayName: requiredString(value, "displayName", 120),
  };
}

function normalizeCaregiverProvisioningInput(data) {
  const value = requireObject(data);
  rejectUnknownKeys(value, [
    "email",
    "displayName",
    "phone",
    "location",
    "category",
    "workType",
    "shifts",
    "servicesOffered",
    "hourlyRate",
    "experience",
  ]);

  const category = requiredString(value, "category", 20);
  if (!["caregiver", "household", "both"].includes(category)) {
    throw new HttpsError("invalid-argument", "category is invalid.");
  }

  const workType = requiredString(value, "workType", 20);
  if (!["parttime", "fulltime"].includes(workType)) {
    throw new HttpsError("invalid-argument", "workType is invalid.");
  }

  const shifts = optionalStringArray(
    value,
    "shifts",
    ["morning", "day", "night"],
    3,
    20,
  );

  if (workType === "fulltime" && shifts.length > 0) {
    throw new HttpsError(
      "invalid-argument",
      "fulltime caregivers cannot include shifts.",
    );
  }

  return {
    email: requiredEmail(value),
    displayName: requiredString(value, "displayName", 120),
    phone: requiredString(value, "phone", 40),
    location: requiredString(value, "location", 120),
    category,
    workType,
    shifts,
    servicesOffered: optionalStringArray(
      value,
      "servicesOffered",
      null,
      20,
      120,
    ),
    hourlyRate: requiredNumber(value, "hourlyRate", 0, 1000000, false),
    experience: requiredNumber(value, "experience", 0, 80, true),
  };
}

function normalizeOrganizationApprovalInput(data) {
  const value = requireObject(data);
  rejectUnknownKeys(value, ["organizationId"]);

  const organizationId = requiredString(value, "organizationId", 128);
  if (
    organizationId.includes("/") ||
    organizationId === "." ||
    organizationId === ".."
  ) {
    throw new HttpsError("invalid-argument", "organizationId is invalid.");
  }

  return { organizationId };
}

function normalizeOrganizationApplicationApprovalInput(data) {
  const value = requireObject(data);
  rejectUnknownKeys(value, ["applicationId"]);

  const applicationId = requiredString(value, "applicationId", 128);
  if (
    applicationId.includes("/") ||
    applicationId === "." ||
    applicationId === ".."
  ) {
    throw new HttpsError("invalid-argument", "applicationId is invalid.");
  }

  return { applicationId };
}

function normalizeAccountSafetyActionInput(data) {
  const value = requireObject(data);
  rejectUnknownKeys(value, ["targetType", "targetId", "reason", "reportId"]);

  const targetType = requiredString(value, "targetType", 20);
  if (!['organization', 'caregiver', 'customer'].includes(targetType)) {
    throw new HttpsError("invalid-argument", "targetType is invalid.");
  }

  const targetId = requiredString(value, "targetId", 128);
  if (targetId.includes("/") || targetId === "." || targetId === "..") {
    throw new HttpsError("invalid-argument", "targetId is invalid.");
  }

  const reason = requiredString(value, "reason", 1000);
  if (reason.length < 3) {
    throw new HttpsError("invalid-argument", "reason is too short.");
  }

  let reportId;
  if (value.reportId !== undefined) {
    reportId = requiredString(value, "reportId", 128);
    if (reportId.includes("/") || reportId === "." || reportId === "..") {
      throw new HttpsError("invalid-argument", "reportId is invalid.");
    }
    if (targetType !== "customer") {
      throw new HttpsError(
        "invalid-argument",
        "reportId is supported only for a customer safety action.",
      );
    }
  }

  return { targetType, targetId, reason, ...(reportId ? { reportId } : {}) };
}

function normalizePaymentVerificationInput(data) {
  const value = requireObject(data);
  rejectUnknownKeys(value, ["paymentReference"]);

  return {
    paymentReference: requiredString(value, "paymentReference", 160),
  };
}

function normalizePublicCaregiverBackfillInput(data) {
  const value = data === undefined || data === null ? {} : requireObject(data);
  rejectUnknownKeys(value, ["limit", "cursor"]);

  const limit = value.limit === undefined
    ? 200
    : requiredNumber(value, "limit", 1, 400, true);
  const cursor = optionalString(value, "cursor", 128);
  if (cursor.includes("/") || cursor === "." || cursor === "..") {
    throw new HttpsError("invalid-argument", "cursor is invalid.");
  }

  return { limit, cursor };
}

module.exports = {
  normalizeAccountSafetyActionInput,
  normalizeCaregiverProvisioningInput,
  normalizeOrganizationApplicationApprovalInput,
  normalizeOrganizationApprovalInput,
  normalizeOrganizationProvisioningInput,
  normalizePaymentVerificationInput,
  normalizePublicCaregiverBackfillInput,
  normalizeSuperAdminProvisioningInput,
};
