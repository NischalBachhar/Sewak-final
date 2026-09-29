# Original Firebase source inventory

Captured before frontend replacement; line numbers refer to the pre-migration source.

```text
scripts\migrate-demo.cjs:16:  const { initializeApp } = req('firebase-admin/app');
scripts\migrate-demo.cjs:17:  const { getFirestore, Timestamp } = req('firebase-admin/firestore');
scripts\migrate-demo.cjs:28:    await db.runTransaction(async tx => {
scripts\migrate-demo.cjs:29:      const ref = db.doc(change.path), snap = await tx.get(ref), actual = snap.exists ? encode(snap.data()) : null;
scripts\test-emulators.cjs:13:const result = spawnSync(process.execPath, ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:exec', '--project', 'demo-sewak-test', '--config', 'firebase.test.json', '--only', 'auth,firestore', command], { env, stdio: 'inherit' });
src\AuthContext.js:2:import { onIdTokenChanged } from "firebase/auth";
src\AuthContext.js:3:import { doc, getDoc } from "firebase/firestore";
src\AuthContext.js:4:import { auth, db } from "./firebaseConfig";
src\AuthContext.js:47:      const snapshot = await getDoc(doc(db, collectionName, uid));
src\AuthContext.js:75:    const organizationSnapshot = await getDoc(
src\AuthContext.js:76:      doc(db, "organizations", user.uid),
src\AuthContext.js:96:async function resolveAccountProfile(firebaseUser) {
src\AuthContext.js:97:  const trustedRole = await getTrustedRole(firebaseUser);
src\AuthContext.js:99:    await loadFirstExistingProfile(firebaseUser.uid);
src\AuthContext.js:103:    return { role: "user", profile: { ...createFallbackUserDoc(firebaseUser, { role: "user" }), registrationIncomplete: true }, accountError: "" };
src\AuthContext.js:114:    firebaseUser,
src\AuthContext.js:158:    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
src\AuthContext.js:164:      setUser(firebaseUser);
src\AuthContext.js:168:      if (!firebaseUser) {
src\AuthContext.js:177:        const resolved = await resolveAccountProfile(firebaseUser);
functions\package.json:15:    "firebase-admin": "^13.0.0",
functions\package.json:16:    "firebase-functions": "^6.3.0"
functions\test\security.test.cjs:3:const { initializeApp, deleteApp } = require('firebase-admin/app');
functions\test\security.test.cjs:4:const { getAuth } = require('firebase-admin/auth');
functions\test\security.test.cjs:5:const { getFirestore } = require('firebase-admin/firestore');
functions\test\security.test.cjs:19: db.doc('organizations/backend-org').set({organizationId:'backend-org',adminUid:'backend-org',role:'orgadmin',isApproved:false,verified:false,isSuspended:false,isBlacklisted:false,commissionRate:0}),
functions\test\security.test.cjs:20: db.doc('users/backend-org').set({uid:'backend-org',role:'orgadmin',organizationId:'backend-org',isApproved:false,verified:false,isSuspended:false}),
functions\test\security.test.cjs:21: db.doc('users/backend-admin').set({uid:'backend-admin',role:'superadmin'}),
functions\test\security.test.cjs:22: db.doc('users/backend-customer').set({uid:'backend-customer',role:'user',name:'Synthetic customer'}),
functions\test\security.test.cjs:30: for(const [key,value]of Object.entries(records))await db.doc(key).set(value);fs.writeFileSync(file,JSON.stringify(records));
functions\test\security.test.cjs:32: const applied=run('--apply-demo',file,journal);assert.equal(applied.status,0,applied.stderr);assert.equal((await db.doc('reportReceipts/migration-report').get()).data().privateNotes,undefined);assert.equal((await db.doc('reportLocks/migration-booking').get()).data().reportId,'migration-report');
functions\test\security.test.cjs:33: await db.doc('reportReceipts/migration-report').update({status:'rejected'});assert.notEqual(run('--rollback-demo',journal).status,0);assert.equal((await db.doc('reportReceipts/migration-report').get()).data().status,'rejected');
functions\test\security.test.cjs:34: await db.doc('reportReceipts/migration-report').update({status:'pending'});const rollback=run('--rollback-demo',journal);assert.equal(rollback.status,0,rollback.stderr);assert.equal((await db.doc('reportReceipts/migration-report').get()).exists,false);assert.equal((await db.doc('caregiverReports/migration-report').get()).data().privateNotes,'PRIVATE');
functions\test\security.test.cjs:43: await db.doc('users/backend-admin').update({isSuspended:true});
functions\test\security.test.cjs:48: assert.equal((await db.doc('organizations/backend-org').get()).data().commissionRate,0);
functions\test\security.test.cjs:50: assert.ok((await db.collection('adminAuditLogs').where('action','==','organization_approved').get()).size>0);
functions\test\security.test.cjs:53: await db.doc('organizations/backend-org').update({isSuspended:true,isBlacklisted:true});
functions\test\security.test.cjs:55: assert.equal((await db.doc('organizations/backend-org').get()).data().isApproved,false);
functions\test\security.test.cjs:60: assert.equal((await db.doc('organizations/backend-org').get()).data().isApproved,false);
functions\test\security.test.cjs:61: assert.equal((await db.doc('users/backend-org').get()).data().isApproved,false);
functions\test\security.test.cjs:65: await db.doc('organizations/backend-org').update({isApproved:false,isSuspended:true,isBlacklisted:true});
functions\test\security.test.cjs:66: await db.doc('users/backend-org').update({isApproved:false,isSuspended:true,isBlacklisted:true});
functions\test\security.test.cjs:68: for(const key of ['organizations/backend-org','users/backend-org']){const data=(await db.doc(key).get()).data();assert.equal(data.isSuspended,true);assert.equal(data.isApproved,false);}
functions\test\security.test.cjs:72: await db.doc(`organizationApplications/${applicationId}`).set({applicantId:'backend-org',applicantName:'Test Applicant',applicantEmail:'backend-org@example.test',organizationName:'Test Organization',status:'pending',createdAt:new Date()});
functions\test\security.test.cjs:74: await db.doc('organizations/backend-org').update({isSuspended:true,isBlacklisted:true});await db.doc('users/backend-org').update({isSuspended:true,isBlacklisted:true});
functions\test\security.test.cjs:76: assert.equal((await db.doc('organizations/backend-org').get()).data().isSuspended,true);assert.equal((await db.doc('users/backend-org').get()).data().isSuspended,true);
functions\test\security.test.cjs:79: const ref=db.doc('vendors/backend-caregiver');await ref.set({name:'Test',category:'vendor',isApproved:true,isAvailable:true,organizationId:'backend-org',servicesOffered:['care'],hourlyRate:500});
functions\test\security.test.cjs:80: await db.doc('organizations/backend-org').update({isApproved:true});
functions\test\security.test.cjs:81: await syncPublicCaregiver('backend-caregiver');assert.equal((await db.doc('publicCaregivers/backend-caregiver').get()).data().commissionRate,0);
functions\test\security.test.cjs:82: await db.doc('organizations/backend-org').update({isSuspended:true});
functions\test\security.test.cjs:84: assert.equal((await db.doc('publicCaregivers/backend-caregiver').get()).exists,false);
functions\test\security.test.cjs:92: await db.doc('blacklistReports/backend-report').set({userId:'backend-customer',userType:'user',status:'pending',reportedBy:'backend-caregiver',bookingId:'backend-booking',reason:'Safety concerns',description:'Synthetic report'});
functions\test\security.test.cjs:93: await db.doc('reportReceipts/backend-report').set({reportedBy:'backend-caregiver',bookingId:'backend-booking',reason:'Safety concerns',status:'pending',createdAt:new Date()});
functions\test\security.test.cjs:95: const receipt=(await db.doc('reportReceipts/backend-report').get()).data();assert.equal(receipt.status,'approved');assert.equal(receipt.approvedBy,undefined);
functions\test\security.test.cjs:96: assert.equal((await db.doc('users/backend-customer').get()).data().isSuspended,true);
functions\index.js:3:const { getApps, initializeApp } = require("firebase-admin/app");
functions\index.js:4:const { HttpsError, onCall } = require("firebase-functions/v2/https");
functions\index.js:5:const { onDocumentWritten } = require("firebase-functions/v2/firestore");
functions\index.js:6:const { logger } = require("firebase-functions");
src\App.js:3:import { signOut } from "firebase/auth";
src\App.js:14:import { auth } from "./firebaseConfig";
src\CaregiverReportUserPage.js:3:import { doc, getDoc } from "firebase/firestore";
src\CaregiverReportUserPage.js:5:import { db } from "./firebaseConfig";
src\CaregiverReportUserPage.js:44:        const snapshot = await getDoc(doc(db, "bookings", bookingId));
functions\scripts\grant-platform-role.js:3:const { getApps, initializeApp } = require("firebase-admin/app");
functions\scripts\grant-platform-role.js:4:const { getAuth } = require("firebase-admin/auth");
functions\scripts\grant-platform-role.js:5:const { FieldValue, getFirestore } = require("firebase-admin/firestore");
functions\scripts\grant-platform-role.js:60:  await db.collection("users").doc(user.uid).set(
functions\scripts\grant-platform-role.js:70:      roleAssignedAt: FieldValue.serverTimestamp(),
functions\scripts\grant-platform-role.js:76:  await db.collection("adminAuditLogs").add({
functions\scripts\grant-platform-role.js:81:    createdAt: FieldValue.serverTimestamp(),
src\BookingRequestPage.js:2:import { doc, getDoc } from "firebase/firestore";
src\BookingRequestPage.js:4:import { db } from "./firebaseConfig";
src\BookingRequestPage.js:21:        const snapshot = await getDoc(doc(db, "publicCaregivers", caregiverId));
src\AdminDashboardPage.js:16:} from "firebase/firestore";
src\AdminDashboardPage.js:20:} from "firebase/auth";
src\AdminDashboardPage.js:21:import { httpsCallable } from "firebase/functions";
src\AdminDashboardPage.js:22:import { db, auth, functions } from "./firebaseConfig";
src\AdminDashboardPage.js:188:    updatedAt: serverTimestamp(),
src\AdminDashboardPage.js:379:        const orgSnap = await getDocs(collection(db, "organizations"));
src\AdminDashboardPage.js:393:        const applicationSnap = await getDocs(
src\AdminDashboardPage.js:394:          collection(db, "organizationApplications"),
src\AdminDashboardPage.js:411:        const vendorSnap = await getDocs(collection(db, "vendors"));
src\AdminDashboardPage.js:428:        const bookingSnap = await getDocs(collection(db, "bookings"));
src\AdminDashboardPage.js:443:        const servicesSnap = await getDocs(collection(db, "services"));
src\AdminDashboardPage.js:455:        const reportsSnap = await getDocs(collection(db, "blacklistReports"));
src\AdminDashboardPage.js:465:        const blacklistSnap = await getDocs(collection(db, "blacklist"));
src\AdminDashboardPage.js:475:        const usersSnap = await getDocs(collection(db, "users"));
src\AdminDashboardPage.js:489:        const settingsSnap = await getDoc(doc(db, "settings", "commission"));
src\AdminDashboardPage.js:523:        const userDoc = await getDoc(doc(db, "users", user.uid));
src\AdminDashboardPage.js:570:        collection(db, "vendors"),
src\AdminDashboardPage.js:573:      const snap = await getDocs(q);
src\AdminDashboardPage.js:642:      await updateDoc(doc(db, "organizations", editingOrg.id), {
src\AdminDashboardPage.js:650:        updatedAt: serverTimestamp(),
src\AdminDashboardPage.js:654:        await updateDoc(doc(db, "users", editingOrg.id), {
src\AdminDashboardPage.js:661:          updatedAt: serverTimestamp(),
src\AdminDashboardPage.js:817:      const now = serverTimestamp();
src\AdminDashboardPage.js:818:      await updateDoc(doc(db, "vendors", caregiverId), {
src\AdminDashboardPage.js:824:        await updateDoc(doc(db, "users", caregiverId), { isApproved: true });
src\AdminDashboardPage.js:866:      const existingPublicListings = await getDocs(
src\AdminDashboardPage.js:867:        collection(db, "publicCaregivers"),
src\AdminDashboardPage.js:886:            ref: doc(db, "publicCaregivers", caregiver.id),
src\AdminDashboardPage.js:907:        const batch = writeBatch(db);
src\AdminDashboardPage.js:1040:      const usersSnap = await getDocs(collection(db, "users"));
src\AdminDashboardPage.js:1060:      await saveService(doc(collection(db, "services")), {
src\AdminDashboardPage.js:1063:        createdAt: serverTimestamp(),
src\AdminDashboardPage.js:1070:      const servicesSnap = await getDocs(collection(db, "services"));
src\AdminDashboardPage.js:1081:      await saveService(doc(db, "services", serviceId), {
src\AdminDashboardPage.js:1083:        updatedAt: serverTimestamp(),
src\AdminDashboardPage.js:1086:      const servicesSnap = await getDocs(collection(db, "services"));
src\AdminDashboardPage.js:1101:      await retireService(doc(db, "services", serviceId));
src\AdminDashboardPage.js:1103:      const servicesSnap = await getDocs(collection(db, "services"));
src\AdminDashboardPage.js:1115:      await setDoc(doc(db, "settings", "commission"), {
src\AdminDashboardPage.js:1117:        updatedAt: serverTimestamp(),
src\AdminDashboardPage.js:1133:      const reportSnap = await getDoc(doc(db, "blacklistReports", reportId));
src\AdminDashboardPage.js:1154:      const reportsSnap = await getDocs(collection(db, "blacklistReports"));
src\AdminDashboardPage.js:1170:      const receipt = await getDoc(doc(db, "reportReceipts", reportId));
src\AdminDashboardPage.js:1171:      const batch = writeBatch(db);
src\AdminDashboardPage.js:1172:      batch.update(doc(db, "blacklistReports", reportId), {
src\AdminDashboardPage.js:1174:        rejectedAt: serverTimestamp(),
src\AdminDashboardPage.js:1180:      const reportsSnap = await getDocs(collection(db, "blacklistReports"));
src\bookingService.js:1:import { doc, getDocFromServer, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
src\bookingService.js:2:import { db } from "./firebaseConfig";
src\bookingService.js:13:  const snapshot = await getDocFromServer(doc(db, "bookings", attempt.id));
src\bookingService.js:32:  const snapshot = await getDocFromServer(doc(db, "publicCaregivers", caregiver.id));
src\bookingService.js:59:  const ref = doc(db, "bookings", attempt.id);
src\bookingService.js:60:  return runTransaction(db, async (transaction) => {
src\bookingService.js:66:    const booking = { ...payload, requestFingerprint: hash, scheduleAt: Timestamp.fromDate(scheduleBoundary(input)), createdAt: serverTimestamp() };
src\BookingDetailPage.js:8:} from "firebase/firestore";
src\BookingDetailPage.js:10:import { db } from "./firebaseConfig";
src\BookingDetailPage.js:109:    const stopBooking = onSnapshot(
src\BookingDetailPage.js:110:      doc(db, "bookings", bookingId),
src\BookingDetailPage.js:128:    const sessionRef = doc(db, "careSessions", bookingId);
src\BookingDetailPage.js:129:    unsubscribers.push(onSnapshot(sessionRef, (snapshot) => { setSession(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null); received("session"); }, () => { received("session"); setHistoryError("Care history could not be loaded. Refresh to retry."); }));
src\BookingDetailPage.js:130:    unsubscribers.push(onSnapshot(
src\BookingDetailPage.js:131:      query(collection(sessionRef, "tasks"), orderBy("createdAt", "asc")),
src\BookingDetailPage.js:135:    unsubscribers.push(onSnapshot(
src\BookingDetailPage.js:136:      query(collection(sessionRef, "updates"), orderBy("createdAt", "desc")),
src\BookingDetailPage.js:140:    unsubscribers.push(onSnapshot(doc(db, "reviews", bookingId), (snapshot) => { setReview(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null); received("review"); }, () => { received("review"); setReviewError("Review status could not be loaded. Refresh before submitting."); }));
src\BookingFormPage.js:2:import { collection, documentId, getDocs, query, where } from "firebase/firestore";
src\BookingFormPage.js:5:import { db } from "./firebaseConfig";
src\BookingFormPage.js:70:    getDocs(query(collection(db, "publicServices"), where(documentId(), "in", ids))).then((snapshot) => {
functions\src\fonepay.js:3:const { HttpsError } = require("firebase-functions/v2/https");
functions\src\fonepay.js:4:const { logger } = require("firebase-functions");
src\CaregiverDashboardPage.js:13:} from "firebase/firestore";
src\CaregiverDashboardPage.js:18:} from "firebase/auth";
src\CaregiverDashboardPage.js:20:import { db } from "./firebaseConfig";
src\CaregiverDashboardPage.js:131:        collection(db, "bookings"),
src\CaregiverDashboardPage.js:134:      const unsubBookings = onSnapshot(
src\CaregiverDashboardPage.js:172:        collection(db, "reportReceipts"),
src\CaregiverDashboardPage.js:175:      const unsubReports = onSnapshot(
src\CaregiverDashboardPage.js:209:        const vendorSnap = await getDoc(doc(db, "vendors", user.uid));
src\CaregiverDashboardPage.js:230:        const servicesSnap = await getDocs(collection(db, "publicServices"));
src\CaregiverDashboardPage.js:246:      await updateDoc(doc(db, "bookings", bookingId), {
src\CaregiverDashboardPage.js:248:        updatedAt: serverTimestamp(),
src\CaregiverDashboardPage.js:291:      await updateDoc(doc(db, "vendors", user.uid), {
src\CaregiverDashboardPage.js:305:      await updateDoc(doc(db, "users", user.uid), {
src\CaregiverDashboardPage.js:312:      const vendorSnap = await getDoc(doc(db, "vendors", user.uid));
src\AuthPage.js:2:import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
src\AuthPage.js:6:import { auth } from "./firebaseConfig";
functions\src\authz.js:3:const { HttpsError } = require("firebase-functions/v2/https");
functions\src\authz.js:54:  const { getFirestore } = require("firebase-admin/firestore");
functions\src\authz.js:55:  const snapshot = await getFirestore().collection("users").doc(requester.uid).get();
functions\src\organization-approval.js:3:const { getAuth } = require("firebase-admin/auth");
functions\src\organization-approval.js:4:const { FieldValue, getFirestore } = require("firebase-admin/firestore");
functions\src\organization-approval.js:5:const { HttpsError } = require("firebase-functions/v2/https");
functions\src\organization-approval.js:6:const { logger } = require("firebase-functions");
functions\src\organization-approval.js:84:  const organizationRef = db.collection("organizations").doc(organizationId);
functions\src\organization-approval.js:85:  const auditRef = db.collection("adminAuditLogs").doc();
functions\src\organization-approval.js:87:  return db.runTransaction(async (transaction) => {
functions\src\organization-approval.js:93:    const userRef = adminUid ? db.collection("users").doc(adminUid) : null;
functions\src\organization-approval.js:108:      approvedAt: FieldValue.serverTimestamp(),
functions\src\organization-approval.js:110:      updatedAt: FieldValue.serverTimestamp(),
functions\src\organization-approval.js:118:      approvedAt: FieldValue.serverTimestamp(),
functions\src\organization-approval.js:127:      createdAt: FieldValue.serverTimestamp(),
functions\src\organization-approval.js:141:  const organizationRef = db.collection("organizations").doc(organizationId);
functions\src\organization-approval.js:142:  const userRef = db.collection("users").doc(adminUid);
functions\src\organization-approval.js:145:    await db.runTransaction(async (transaction) => {
functions\src\organization-approval.js:155:          updatedAt: FieldValue.serverTimestamp(),
functions\src\organization-approval.js:166:      transaction.set(db.collection("adminAuditLogs").doc(), {
functions\src\organization-approval.js:171:        createdAt: FieldValue.serverTimestamp(),
functions\src\organization-approval.js:210:  const current = await getFirestore().collection("organizations").doc(organizationId).get();
functions\src\validation.js:3:const { HttpsError } = require("firebase-functions/v2/https");
functions\src\account-safety.js:3:const { getAuth } = require("firebase-admin/auth");
functions\src\account-safety.js:8:} = require("firebase-admin/firestore");
functions\src\account-safety.js:9:const { HttpsError } = require("firebase-functions/v2/https");
functions\src\account-safety.js:10:const { logger } = require("firebase-functions");
functions\src\account-safety.js:130:    .collection("vendors")
functions\src\account-safety.js:155:    missingIds.map((id) => read(db.collection("vendors").doc(id))),
functions\src\account-safety.js:174:    const userRef = db.collection("users").doc(caregiverId);
functions\src\account-safety.js:195:      vendorRef: db.collection("vendors").doc(caregiverId),
functions\src\account-safety.js:206:    const organizationRef = db.collection("organizations").doc(targetId);
functions\src\account-safety.js:224:    const userRef = db.collection("users").doc(organization.adminUid);
functions\src\account-safety.js:284:    const vendorRef = db.collection("vendors").doc(targetId);
functions\src\account-safety.js:293:    const userRef = db.collection("users").doc(targetId);
functions\src\account-safety.js:323:  const userRef = db.collection("users").doc(targetId);
functions\src\account-safety.js:324:  const vendorRef = db.collection("vendors").doc(targetId);
functions\src\account-safety.js:325:  const organizationRef = db.collection("organizations").doc(targetId);
functions\src\account-safety.js:347:    ? db.collection("blacklistReports").doc(reportId)
functions\src\account-safety.js:353:    const receiptRef = db.collection("reportReceipts").doc(reportId);
functions\src\account-safety.js:427:    rejectedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:430:    blacklistedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:433:    updatedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:451:    rejectedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:454:    blacklistedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:457:    updatedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:468:    rejectedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:471:    blacklistedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:474:    suspendedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:477:    updatedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:490:    addedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:507:    blacklistedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:524:  transaction.delete(db.collection("publicCaregivers").doc(target.authUid));
functions\src\account-safety.js:526:    db.collection("blacklist").doc(target.authUid),
functions\src\account-safety.js:533:      db.collection("organizationBlacklist").doc(target.authUid),
functions\src\account-safety.js:571:      .collection("vendors")
functions\src\account-safety.js:585:        ...vendorChunk.map((vendor) => db.collection("users").doc(vendor.id)),
functions\src\account-safety.js:606:          userRef: db.collection("users").doc(caregiverId),
functions\src\account-safety.js:655:    .collection("organizationSafetyCascades")
functions\src\account-safety.js:656:    .doc(organizationId);
functions\src\account-safety.js:673:        updatedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:682:      .collection("vendors")
functions\src\account-safety.js:695:        completedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:696:        updatedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:703:        db.collection("users").doc(vendor.id),
functions\src\account-safety.js:725:        userRef: db.collection("users").doc(caregiverId),
functions\src\account-safety.js:748:          updatedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:758:      processedCaregiverCount: FieldValue.increment(vendorSnapshot.size),
functions\src\account-safety.js:760:      updatedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:778:        updatedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:797:  const auditRef = db.collection("adminAuditLogs").doc();
functions\src\account-safety.js:799:  const result = await db.runTransaction(async (transaction) => {
functions\src\account-safety.js:838:        db.collection("blacklist").doc(target.authUid),
functions\src\account-safety.js:848:          db.collection("organizationSafetyCascades").doc(target.targetId),
functions\src\account-safety.js:856:            createdAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:857:            updatedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:879:        db.collection("blacklist").doc(target.authUid),
functions\src\account-safety.js:889:        if (target.reportReceiptExists) transaction.update(db.collection("reportReceipts").doc(input.reportId), { status: "approved" });
functions\src\account-safety.js:892:          approvedAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:910:      createdAt: FieldValue.serverTimestamp(),
functions\src\account-safety.js:1028:    await db.collection("adminAuditLogs").doc(auditId).update({
functions\src\account-safety.js:1044:      authRevocationCompletedAt: FieldValue.serverTimestamp(),
src\CaregiverListPage.js:2:import { collection, getDocs, query, where } from "firebase/firestore";
src\CaregiverListPage.js:4:import { db } from "./firebaseConfig";
src\CaregiverListPage.js:575:          collection(db, "publicCaregivers"),
src\CaregiverListPage.js:581:        const snap = await getDocs(q);
src\CaregiverListPage.js:602:        const snap = await getDocs(collection(db, "publicServices"));
functions\src\provisioning.js:4:const { getAuth } = require("firebase-admin/auth");
functions\src\provisioning.js:5:const { FieldValue, getFirestore } = require("firebase-admin/firestore");
functions\src\provisioning.js:6:const { HttpsError } = require("firebase-functions/v2/https");
functions\src\provisioning.js:7:const { logger } = require("firebase-functions");
functions\src\provisioning.js:28:    createdAt: FieldValue.serverTimestamp(),
functions\src\provisioning.js:29:    roleAssignedAt: FieldValue.serverTimestamp(),
functions\src\provisioning.js:53:    createdAt: FieldValue.serverTimestamp(),
functions\src\provisioning.js:112:    const userRef = db.collection("users").doc(user.uid);
functions\src\provisioning.js:127:        db.collection("organizations").doc(user.uid),
functions\src\provisioning.js:132:    batch.set(db.collection("adminAuditLogs").doc(), {
functions\src\provisioning.js:139:      createdAt: FieldValue.serverTimestamp(),
functions\src\provisioning.js:184:  const organizationRef = db.collection("organizations").doc(requester.uid);
functions\src\provisioning.js:237:    db.collection("services").doc(serviceId),
functions\src\provisioning.js:263:    createdAt: FieldValue.serverTimestamp(),
functions\src\provisioning.js:308:    createdAt: FieldValue.serverTimestamp(),
functions\src\provisioning.js:332:      db.collection("users").doc(user.uid),
functions\src\provisioning.js:336:      db.collection("vendors").doc(user.uid),
functions\src\provisioning.js:340:      caregivers: FieldValue.arrayUnion(user.uid),
functions\src\provisioning.js:341:      totalCaregivers: FieldValue.increment(1),
functions\src\provisioning.js:342:      updatedAt: FieldValue.serverTimestamp(),
functions\src\provisioning.js:344:    batch.set(db.collection("adminAuditLogs").doc(), {
functions\src\provisioning.js:350:      createdAt: FieldValue.serverTimestamp(),
functions\src\organization-application.js:3:const { getAuth } = require("firebase-admin/auth");
functions\src\organization-application.js:4:const { FieldValue, getFirestore } = require("firebase-admin/firestore");
functions\src\organization-application.js:5:const { HttpsError } = require("firebase-functions/v2/https");
functions\src\organization-application.js:6:const { logger } = require("firebase-functions");
functions\src\organization-application.js:183:    approvedAt: FieldValue.serverTimestamp(),
functions\src\organization-application.js:186:    createdAt: FieldValue.serverTimestamp(),
functions\src\organization-application.js:204:    approvedAt: FieldValue.serverTimestamp(),
functions\src\organization-application.js:207:    updatedAt: FieldValue.serverTimestamp(),
functions\src\organization-application.js:226:    approvedAt: FieldValue.serverTimestamp(),
functions\src\organization-application.js:229:    createdAt: FieldValue.serverTimestamp(),
functions\src\organization-application.js:298:    .collection("organizationApplications")
functions\src\organization-application.js:299:    .doc(applicationId);
functions\src\organization-application.js:302:  return db.runTransaction(async (transaction) => {
functions\src\organization-application.js:325:      .collection("organizations")
functions\src\organization-application.js:326:      .doc(application.applicantId);
functions\src\organization-application.js:327:    const userRef = db.collection("users").doc(application.applicantId);
functions\src\organization-application.js:371:      approvedAt: FieldValue.serverTimestamp(),
functions\src\organization-application.js:376:    transaction.set(db.collection("adminAuditLogs").doc(), {
functions\src\organization-application.js:383:      createdAt: FieldValue.serverTimestamp(),
functions\src\organization-application.js:393:    .collection("organizationApplications")
functions\src\organization-application.js:394:    .doc(state.applicationId);
functions\src\organization-application.js:395:  const organizationRef = db.collection("organizations").doc(state.applicantId);
functions\src\organization-application.js:396:  const userRef = db.collection("users").doc(state.applicantId);
functions\src\organization-application.js:399:    await db.runTransaction(async (transaction) => {
functions\src\organization-application.js:450:            updatedAt: FieldValue.serverTimestamp(),
functions\src\organization-application.js:486:      transaction.set(db.collection("adminAuditLogs").doc(), {
functions\src\organization-application.js:492:        createdAt: FieldValue.serverTimestamp(),
functions\src\organization-application.js:506:      .collection("organizationApplications")
functions\src\organization-application.js:507:      .doc(applicationId)
functions\src\organization-application.js:510:        claimSyncedAt: FieldValue.serverTimestamp(),
functions\src\organization-application.js:522:    .collection("organizationApplications")
functions\src\organization-application.js:523:    .doc(applicationId)
functions\src\organization-application.js:551:  const latestOrg = await getFirestore().collection("organizations").doc(authUser.uid).get();
functions\src\organization-application.js:552:  const latestProfile = await getFirestore().collection("users").doc(authUser.uid).get();
src\CaregiverShiftWorkflow.js:2:import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
src\CaregiverShiftWorkflow.js:3:import { db } from "./firebaseConfig";
src\CaregiverShiftWorkflow.js:27:    const sessionRef = doc(db, "careSessions", booking.id);
src\CaregiverShiftWorkflow.js:29:      onSnapshot(sessionRef, (snapshot) => {
src\CaregiverShiftWorkflow.js:33:      onSnapshot(query(collection(sessionRef, "tasks"), orderBy("createdAt", "asc")), (snapshot) => setTasks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => setError("Care tasks could not be loaded. History may be incomplete.")),
src\CaregiverShiftWorkflow.js:34:      onSnapshot(query(collection(sessionRef, "updates"), orderBy("createdAt", "desc")), (snapshot) => setUpdates(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => setError("Care updates could not be loaded. History may be incomplete.")),
functions\src\public-projections.js:3:const { FieldPath, FieldValue, getFirestore } = require("firebase-admin/firestore");
functions\src\public-projections.js:4:const { logger } = require("firebase-functions");
functions\src\public-projections.js:5:const { onDocumentWritten } = require("firebase-functions/v2/firestore");
functions\src\public-projections.js:90:    updatedAt: FieldValue.serverTimestamp(),
functions\src\public-projections.js:96:  const publicRef = db.collection("publicCaregivers").doc(caregiverId);
functions\src\public-projections.js:99:  return db.runTransaction(async (transaction) => {
functions\src\public-projections.js:100:    const snapshot = await transaction.get(db.collection("vendors").doc(caregiverId));
functions\src\public-projections.js:103:    const orgSnapshot = orgId ? await transaction.get(db.collection("organizations").doc(orgId)) : null;
functions\src\public-projections.js:124:    updatedAt: FieldValue.serverTimestamp(),
functions\src\public-projections.js:137:  const db = getFirestore(); const publicRef = db.collection("publicServices").doc(serviceId);
functions\src\public-projections.js:138:  return db.runTransaction(async (transaction) => {
functions\src\public-projections.js:139:    const snapshot = await transaction.get(db.collection("services").doc(serviceId));
functions\src\public-projections.js:153:    createdAt: review.createdAt || FieldValue.serverTimestamp(),
functions\src\public-projections.js:154:    updatedAt: FieldValue.serverTimestamp(),
functions\src\public-projections.js:169:  const publicReviewRef = db.collection("publicReviews").doc(bookingId);
functions\src\public-projections.js:184:    .collection("reviews")
functions\src\public-projections.js:197:  const vendorRef = db.collection("vendors").doc(caregiverId);
functions\src\public-projections.js:204:    updatedAt: FieldValue.serverTimestamp(),
functions\src\public-projections.js:259:        .collection("vendors")
functions\src\public-projections.js:342:    .collection("vendors")
functions\src\public-projections.js:370:    .collection("reviews")
functions\src\public-projections.js:405:    .collection("services")
src\firebaseConfig.js:1:import { initializeApp } from "firebase/app";
src\firebaseConfig.js:2:import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
src\firebaseConfig.js:3:import { getAuth, connectAuthEmulator } from "firebase/auth";
src\firebaseConfig.js:4:import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
src\firebaseConfig.js:5:import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
src\firebaseConfig.js:6:import { getStorage, connectStorageEmulator } from "firebase/storage";
src\firebaseConfig.js:8:const firebaseConfig = {
src\firebaseConfig.js:10:  authDomain: "care-53593.firebaseapp.com",
src\firebaseConfig.js:12:  storageBucket: "care-53593.firebasestorage.app",
src\firebaseConfig.js:21:const app = initializeApp(emulatorMode ? { apiKey: "demo-only", projectId: "demo-sewak-test", authDomain: "localhost", storageBucket: "demo-sewak-test.appspot.com" } : firebaseConfig);
src\careSessionService.js:10:} from "firebase/firestore";
src\careSessionService.js:11:import { db } from "./firebaseConfig";
src\careSessionService.js:14:const sessionRefFor = (bookingId) => doc(db, "careSessions", bookingId);
src\careSessionService.js:20:  const batch = writeBatch(db);
src\careSessionService.js:22:  const bookingRef = doc(db, "bookings", normalized.id);
src\careSessionService.js:33:    actualCheckIn: serverTimestamp(),
src\careSessionService.js:34:    createdAt: serverTimestamp(),
src\careSessionService.js:35:    updatedAt: serverTimestamp(),
src\careSessionService.js:40:    updatedAt: serverTimestamp(),
src\careSessionService.js:49:  const batch = writeBatch(db);
src\careSessionService.js:52:    actualCheckOut: serverTimestamp(),
src\careSessionService.js:53:    updatedAt: serverTimestamp(),
src\careSessionService.js:55:  batch.update(doc(db, "bookings", bookingId), {
src\careSessionService.js:57:    updatedAt: serverTimestamp(),
src\careSessionService.js:68:  return addDoc(collection(sessionRefFor(bookingId), "tasks"), {
src\careSessionService.js:72:    createdAt: serverTimestamp(),
src\careSessionService.js:78:  await updateDoc(doc(sessionRefFor(bookingId), "tasks", taskId), {
src\careSessionService.js:80:    completedAt: completed ? serverTimestamp() : deleteField(),
src\careSessionService.js:91:  return addDoc(collection(sessionRefFor(bookingId), "updates"), {
src\careSessionService.js:95:    createdAt: serverTimestamp(),
src\careSessionService.js:107:  await setDoc(doc(db, "reviews", normalized.id), {
src\careSessionService.js:114:    createdAt: serverTimestamp(),
src\MyBookingsPage.js:6:} from "firebase/firestore";
src\MyBookingsPage.js:7:import { db } from "./firebaseConfig";
src\MyBookingsPage.js:48:      await updateDoc(doc(db, "bookings", booking.id), {
src\MyBookingsPage.js:50:        updatedAt: serverTimestamp(),
src\reportService.js:1:import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
src\reportService.js:2:import { db } from "./firebaseConfig";
src\reportService.js:11:  const receiptRef = doc(db, "reportReceipts", report.bookingId);
src\reportService.js:12:  const lockRef = doc(db, "reportLocks", report.bookingId);
src\reportService.js:13:  return runTransaction(db, async (transaction) => {
src\reportService.js:18:    const data = { ...report, status: "pending", createdAt: serverTimestamp() };
src\reportService.js:19:    transaction.set(doc(db, "blacklistReports", report.bookingId), data);
src\registrationService.js:1:import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
src\registrationService.js:2:import { db } from "./firebaseConfig";
src\registrationService.js:8:  const userRef = doc(db, "users", user.uid);
src\registrationService.js:9:  const applicationRef = doc(db, "organizationApplications", user.uid);
src\registrationService.js:10:  await runTransaction(db, async (transaction) => {
src\registrationService.js:15:      createdAt: serverTimestamp(), isApproved: false, isSuspended: false, profileComplete: false,
src\registrationService.js:19:      businessPhone: "", businessAddress: "", businessCity: "", status: "pending", createdAt: serverTimestamp(),
src\PublicCaregiverProfilePage.js:2:import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
src\PublicCaregiverProfilePage.js:4:import { db } from "./firebaseConfig";
src\PublicCaregiverProfilePage.js:61:        const caregiverSnap = await getDoc(
src\PublicCaregiverProfilePage.js:62:          doc(db, "publicCaregivers", caregiverId),
src\PublicCaregiverProfilePage.js:73:          getDocs(collection(db, "publicServices")),
src\PublicCaregiverProfilePage.js:74:          getDocs(
src\PublicCaregiverProfilePage.js:76:              collection(db, "publicReviews"),
src\useCustomerBookings.js:2:import { collection, onSnapshot, query, where } from "firebase/firestore";
src\useCustomerBookings.js:3:import { db } from "./firebaseConfig";
src\useCustomerBookings.js:19:    if (!store.stop) store.stop = onSnapshot(query(collection(db, "bookings"), where("userId", "==", uid)), { includeMetadataChanges: true },
src\servicePublishing.js:1:import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
src\servicePublishing.js:2:import { db } from "./firebaseConfig";
src\servicePublishing.js:9:    description: record.description || "", price: record.price ?? 0, isActive: record.isActive !== false, updatedAt: serverTimestamp() };
src\servicePublishing.js:12:  const previous = merge ? await getDoc(ref) : null;
src\servicePublishing.js:16:  const batch = writeBatch(db);batch.set(ref, record);
src\servicePublishing.js:17:  if (projection.isActive) batch.set(doc(db, "publicServices", ref.id), projection);
src\servicePublishing.js:18:  else batch.delete(doc(db, "publicServices", ref.id));
src\servicePublishing.js:23:  return saveService(ref, { isActive: false, updatedAt: serverTimestamp() }, true);
src\useOrganizationBookings.js:2:import { collection, getAggregateFromServer, count, sum, limit, onSnapshot, orderBy, query, startAfter, where } from "firebase/firestore";
src\useOrganizationBookings.js:3:import { db } from "./firebaseConfig";
src\useOrganizationBookings.js:21:    const base = query(collection(db, "bookings"), where("organizationId", "==", uid));
src\useOrganizationBookings.js:38:    const stop = onSnapshot(page, { includeMetadataChanges: true }, (snapshot) => {
src\UserProfilePage.js:2:import { doc, getDoc, setDoc } from "firebase/firestore";
src\UserProfilePage.js:8:} from "firebase/auth";
src\UserProfilePage.js:9:import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
src\UserProfilePage.js:10:import { db, storage } from "./firebaseConfig";
src\UserProfilePage.js:48:        const docSnap = await getDoc(doc(db, "users", user.uid));
src\UserProfilePage.js:116:      await uploadBytes(storageRef, imageFile);
src\UserProfilePage.js:119:      const downloadURL = await getDownloadURL(storageRef);
src\UserProfilePage.js:162:      await setDoc(doc(db, "users", user.uid), {
src\OrganizationProfilePage.js:2:import { doc, setDoc } from "firebase/firestore";
src\OrganizationProfilePage.js:3:import { db } from "./firebaseConfig";
src\OrganizationProfilePage.js:59:      await setDoc(doc(db, "organizations", user.uid), {
src\OrganizationProfilePage.js:69:      await setDoc(doc(db, "users", user.uid), {
src\components\CaregiverEditor.js:2:import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
src\components\CaregiverEditor.js:3:import { db } from "../firebaseConfig";
src\components\CaregiverEditor.js:16:      await runTransaction(db, async (transaction) => {
src\components\CaregiverEditor.js:17:        const ref = doc(db, "vendors", caregiver.id);
src\components\CaregiverEditor.js:22:        transaction.update(ref, { ...patch, updatedAt: serverTimestamp() });
src\OrganizationDashboard.js:16:} from "firebase/firestore";
src\OrganizationDashboard.js:17:import { httpsCallable } from "firebase/functions";
src\OrganizationDashboard.js:18:import { db, functions } from "./firebaseConfig";
src\OrganizationDashboard.js:96:        const orgSnap = await getDoc(doc(db, "organizations", user.uid));
src\OrganizationDashboard.js:113:          collection(db, "vendors"),
src\OrganizationDashboard.js:116:        const caregiversSnap = await getDocs(caregiversQuery);
src\OrganizationDashboard.js:127:        const servicesSnap = await getDocs(
src\OrganizationDashboard.js:129:            collection(db, "services"),
src\OrganizationDashboard.js:142:          collection(db, "organizationBlacklist"),
src\OrganizationDashboard.js:145:        const blacklistSnap = await getDocs(blacklistQueryRef);
src\OrganizationDashboard.js:205:        collection(db, "vendors"),
src\OrganizationDashboard.js:208:      const caregiversSnap = await getDocs(caregiversQuery);
src\OrganizationDashboard.js:241:      await saveService(doc(db, "services", serviceId), {
src\OrganizationDashboard.js:246:        createdAt: serverTimestamp(),
src\OrganizationDashboard.js:255:      const servicesSnap = await getDocs(
src\OrganizationDashboard.js:257:          collection(db, "services"),
src\OrganizationDashboard.js:286:      await saveService(doc(db, "services", editingService.id), {
src\OrganizationDashboard.js:289:        updatedAt: serverTimestamp(),
src\OrganizationDashboard.js:296:      const servicesSnap = await getDocs(
src\OrganizationDashboard.js:298:          collection(db, "services"),
src\OrganizationDashboard.js:318:      await retireService(doc(db, "services", serviceId));
src\OrganizationDashboard.js:320:      const servicesSnap = await getDocs(
src\OrganizationDashboard.js:322:          collection(db, "services"),
src\OrganizationDashboard.js:2168:                      await setDoc(
src\OrganizationDashboard.js:2169:                        doc(db, "organizations", orgId),
src\OrganizationDashboard.js:2177:                          updatedAt: serverTimestamp(),
src\OrganizationDashboard.js:2183:                        await updateDoc(
src\OrganizationDashboard.js:2184:                          doc(db, "users", organizationData.adminUid),
```
