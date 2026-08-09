"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { PLATFORM_ROLE_CLAIM, SUPER_ADMIN_ROLE } = require("../src/authz");

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function stop(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  const email = readArgument("--email");
  const role = readArgument("--role");
  const confirmed = process.argv.includes("--confirm-superadmin");

  if (!email || !role || !confirmed) {
    stop(
      "Usage: node scripts/grant-platform-role.js --email admin@example.com --role superadmin --confirm-superadmin",
    );
    return;
  }

  if (role !== SUPER_ADMIN_ROLE) {
    stop("Bootstrap may grant only the superadmin role.");
    return;
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    stop(
      "Set GOOGLE_APPLICATION_CREDENTIALS to an operator-controlled service-account credential before running this script.",
    );
    return;
  }

  if (getApps().length === 0) {
    initializeApp(
      process.env.FIREBASE_PROJECT_ID
        ? { projectId: process.env.FIREBASE_PROJECT_ID }
        : undefined,
    );
  }

  const auth = getAuth();
  const user = await auth.getUserByEmail(email.trim().toLowerCase());
  const claims = {
    ...(user.customClaims || {}),
    [PLATFORM_ROLE_CLAIM]: SUPER_ADMIN_ROLE,
  };

  await auth.setCustomUserClaims(user.uid, claims);

  const db = getFirestore();
  await db.collection("users").doc(user.uid).set(
    {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || email.trim().toLowerCase(),
      role: SUPER_ADMIN_ROLE,
      roleSource: "custom-claim",
      profileComplete: true,
      isApproved: true,
      isSuspended: false,
      roleAssignedAt: FieldValue.serverTimestamp(),
      roleAssignedBy: "bootstrap-script",
    },
    { merge: true },
  );

  await db.collection("adminAuditLogs").add({
    action: "superadmin_role_bootstrapped",
    actorUid: user.uid,
    targetUid: user.uid,
    targetRole: SUPER_ADMIN_ROLE,
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(
    "Granted the superadmin custom claim. The user must refresh their Firebase ID token or sign in again before calling privileged functions.",
  );
}

main().catch((error) => {
  console.error("Unable to bootstrap the superadmin role:", error.code || error.message);
  process.exitCode = 1;
});
