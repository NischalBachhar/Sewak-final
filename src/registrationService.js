import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";

export async function completeRegistration(user, { fullName, selectedRole, organizationName }) {
  const name = fullName.trim();
  if (name.length < 2 || name.length > 120) throw new Error("Enter your full name (2–120 characters).");
  if (selectedRole === "orgadmin" && (organizationName.trim().length < 2 || organizationName.trim().length > 160)) throw new Error("Enter an organization name (2–160 characters).");
  const userRef = doc(db, "users", user.uid);
  const applicationRef = doc(db, "organizationApplications", user.uid);
  await runTransaction(db, async (transaction) => {
    const profile = await transaction.get(userRef);
    const application = selectedRole === "orgadmin" ? await transaction.get(applicationRef) : null;
    if (!profile.exists()) transaction.set(userRef, {
      uid: user.uid, name, email: user.email.toLowerCase(), role: "user", phone: "", address: "", city: "",
      createdAt: serverTimestamp(), isApproved: false, isSuspended: false, profileComplete: false,
    });
    if (selectedRole === "orgadmin" && !application.exists()) transaction.set(applicationRef, {
      applicantId: user.uid, applicantName: name, applicantEmail: user.email.toLowerCase(), organizationName: organizationName.trim(),
      businessPhone: "", businessAddress: "", businessCity: "", status: "pending", createdAt: serverTimestamp(),
    });
  });
}
