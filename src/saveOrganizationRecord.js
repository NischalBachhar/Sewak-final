// src/saveOrganizationRecord.js
import { doc, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

// Call this after an organization user (org admin) account is created
export async function saveOrganizationRecord({
  orgUid,
  organizationName,
  adminName,
  adminEmail,
  businessPhone = "",
  businessAddress = "",
  businessCity = "",
}) {
  const orgRef = doc(db, "organizations", orgUid);
  const existing = await getDoc(orgRef);

  const baseData = {
    organizationId: orgUid,
    organizationName,
    adminUid: orgUid,
    adminName,
    adminEmail,
    businessPhone,
    businessAddress,
    businessCity,
    commissionRate: 15,
    isApproved: false, // superadmin will approve
    verified: false,
  };

  if (!existing.exists()) {
    await setDoc(orgRef, {
      ...baseData,
      caregivers: [],
      totalCaregivers: 0,
      totalBookings: 0,
      totalEarnings: 0,
      createdAt: new Date().toISOString(),
      createdBy: "orgadmin",
      isSuspended: false,
    });
  } else {
    await updateDoc(orgRef, {
      ...baseData,
      updatedAt: new Date().toISOString(),
    });
  }
}
