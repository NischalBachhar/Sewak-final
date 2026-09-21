const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
if (process.env.GCLOUD_PROJECT !== 'demo-sewak-test' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Backend tests require local demo emulators.');
const app=initializeApp({projectId:'demo-sewak-test'});const db=getFirestore();const auth=getAuth();
const { requireSuperAdmin, requireApprovedOrganizationAdmin, assertActorActive }=require('../src/authz');
const { approveOrganizationAccount, approveOrganizationFirestore, rollBackFirestoreApproval }=require('../src/organization-approval');
const { prepareApplicationApproval, rollBackApplicationApproval }=require('../src/organization-application');
const { syncPublicCaregiver }=require('../src/public-projections');
const { normalizeCaregiverProvisioningInput }=require('../src/validation');
const { verifyFonepayPayment }=require('../src/fonepay');
const { applyAccountSafetyAction }=require('../src/account-safety');
const requester={uid:'backend-admin',token:{platformRole:'superadmin'}};
before(async()=>{for(const uid of ['backend-org','backend-admin','backend-customer']){try{await auth.createUser({uid,email:`${uid}@example.test`,password:'Local-test-only-123!'});}catch(e){if(e.code!=='auth/uid-already-exists')throw e;}}});
beforeEach(async()=>{
 await Promise.all([
 db.doc('organizations/backend-org').set({organizationId:'backend-org',adminUid:'backend-org',role:'orgadmin',isApproved:false,verified:false,isSuspended:false,isBlacklisted:false,commissionRate:0}),
 db.doc('users/backend-org').set({uid:'backend-org',role:'orgadmin',organizationId:'backend-org',isApproved:false,verified:false,isSuspended:false}),
 db.doc('users/backend-admin').set({uid:'backend-admin',role:'superadmin'}),
 db.doc('users/backend-customer').set({uid:'backend-customer',role:'user',name:'Synthetic customer'}),
 ]);await auth.updateUser('backend-org',{disabled:false});await auth.setCustomUserClaims('backend-org',{});
});
after(async()=>{await deleteApp(app);});
test('demo migration applies idempotent receipts and guarded rollback preserves original history',async()=>{
 const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');const token=require('node:crypto').randomUUID();
 const dir=path.resolve('.local-tools');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,`migration-${token}.json`),journal=path.join(dir,`migration-${token}-journal.json`);
 const records={'bookings/migration-booking':{caregiverId:'migration-caregiver',userId:'migration-customer'},'caregiverReports/migration-report':{bookingId:'migration-booking',reportedBy:'migration-caregiver',status:'pending',reason:'Safety concerns',createdAt:'2026-01-01',privateNotes:'PRIVATE'}};
 for(const [key,value]of Object.entries(records))await db.doc(key).set(value);fs.writeFileSync(file,JSON.stringify(records));
 const run=(...args)=>spawnSync(process.execPath,['scripts/migrate-demo.cjs',...args],{encoding:'utf8',env:process.env});
 const applied=run('--apply-demo',file,journal);assert.equal(applied.status,0,applied.stderr);assert.equal((await db.doc('reportReceipts/migration-report').get()).data().privateNotes,undefined);assert.equal((await db.doc('reportLocks/migration-booking').get()).data().reportId,'migration-report');
 await db.doc('reportReceipts/migration-report').update({status:'rejected'});assert.notEqual(run('--rollback-demo',journal).status,0);assert.equal((await db.doc('reportReceipts/migration-report').get()).data().status,'rejected');
 await db.doc('reportReceipts/migration-report').update({status:'pending'});const rollback=run('--rollback-demo',journal);assert.equal(rollback.status,0,rollback.stderr);assert.equal((await db.doc('reportReceipts/migration-report').get()).exists,false);assert.equal((await db.doc('caregiverReports/migration-report').get()).data().privateNotes,'PRIVATE');
 fs.unlinkSync(file);fs.unlinkSync(journal);
});
test('privileged guards deny customers and unapproved organizations',()=>{
 assert.throws(()=>requireSuperAdmin({auth:{uid:'customer',token:{platformRole:'user'}}}),{code:'permission-denied'});
 assert.throws(()=>requireSuperAdmin({}),{code:'unauthenticated'});
 assert.throws(()=>requireApprovedOrganizationAdmin({auth:{uid:'org',token:{platformRole:'orgadmin',organizationApproved:false}}}),{code:'permission-denied'});
});
test('revoked or suspended actor cannot use a stale privileged claim',async()=>{
 await db.doc('users/backend-admin').update({isSuspended:true});
 await assert.rejects(assertActorActive(requester),{code:'permission-denied'});
});
test('organization approval issues claims and retains intentionally zero commission',async()=>{
 const result=await approveOrganizationAccount({requester,organizationId:'backend-org'});assert.equal(result.approved,true);
 assert.equal((await db.doc('organizations/backend-org').get()).data().commissionRate,0);
 assert.equal((await auth.getUser('backend-org')).customClaims.organizationApproved,true);
 assert.ok((await db.collection('adminAuditLogs').where('action','==','organization_approved').get()).size>0);
});
test('approval refuses suspended and blacklisted records',async()=>{
 await db.doc('organizations/backend-org').update({isSuspended:true,isBlacklisted:true});
 await assert.rejects(approveOrganizationAccount({requester,organizationId:'backend-org'}),{code:'failed-precondition'});
 assert.equal((await db.doc('organizations/backend-org').get()).data().isApproved,false);
});
test('claim sync failure rolls back only its own approval',async()=>{
 const previous=await approveOrganizationFirestore({organizationId:'backend-org',requesterUid:requester.uid});
 await rollBackFirestoreApproval({organizationId:'backend-org',adminUid:'backend-org',requesterUid:requester.uid,previous});
 assert.equal((await db.doc('organizations/backend-org').get()).data().isApproved,false);
 assert.equal((await db.doc('users/backend-org').get()).data().isApproved,false);
});
test('a concurrent safety action survives approval rollback',async()=>{
 const previous=await approveOrganizationFirestore({organizationId:'backend-org',requesterUid:requester.uid});
 await db.doc('organizations/backend-org').update({isApproved:false,isSuspended:true,isBlacklisted:true});
 await db.doc('users/backend-org').update({isApproved:false,isSuspended:true,isBlacklisted:true});
 await rollBackFirestoreApproval({organizationId:'backend-org',adminUid:'backend-org',requesterUid:requester.uid,previous});
 for(const key of ['organizations/backend-org','users/backend-org']){const data=(await db.doc(key).get()).data();assert.equal(data.isSuspended,true);assert.equal(data.isApproved,false);}
});
test('application rollback cannot erase concurrent safety restrictions',async()=>{
 const applicationId='backend-application';
 await db.doc(`organizationApplications/${applicationId}`).set({applicantId:'backend-org',applicantName:'Test Applicant',applicantEmail:'backend-org@example.test',organizationName:'Test Organization',status:'pending',createdAt:new Date()});
 const state=await prepareApplicationApproval({applicationId,requesterUid:requester.uid,authUser:await auth.getUser('backend-org')});
 await db.doc('organizations/backend-org').update({isSuspended:true,isBlacklisted:true});await db.doc('users/backend-org').update({isSuspended:true,isBlacklisted:true});
 await rollBackApplicationApproval({requesterUid:requester.uid,state});
 assert.equal((await db.doc('organizations/backend-org').get()).data().isSuspended,true);assert.equal((await db.doc('users/backend-org').get()).data().isSuspended,true);
});
test('out-of-order public projection deliveries read current private safety state',async()=>{
 const ref=db.doc('vendors/backend-caregiver');await ref.set({name:'Test',category:'vendor',isApproved:true,isAvailable:true,organizationId:'backend-org',servicesOffered:['care'],hourlyRate:500});
 await db.doc('organizations/backend-org').update({isApproved:true});
 await syncPublicCaregiver('backend-caregiver');assert.equal((await db.doc('publicCaregivers/backend-caregiver').get()).data().commissionRate,0);
 await db.doc('organizations/backend-org').update({isSuspended:true});
 await Promise.all([syncPublicCaregiver('backend-caregiver',{isApproved:true},true),syncPublicCaregiver('backend-caregiver')]);
 assert.equal((await db.doc('publicCaregivers/backend-caregiver').get()).exists,false);
});
test('household provisioning normalizes to vendor and rejects arbitrary category',()=>{
 const input={email:'test@example.test',displayName:'Test Person',phone:'+9779800000000',location:'Hetauda',category:'household',workType:'parttime',shifts:['morning'],servicesOffered:['laundry'],hourlyRate:500,experience:1};
 assert.equal(normalizeCaregiverProvisioningInput(input).category,'vendor');
 assert.throws(()=>normalizeCaregiverProvisioningInput({...input,category:'owner'}),{code:'invalid-argument'});
});
test('report approval updates only the safe receipt plus private moderation and safety records',async()=>{
 await db.doc('blacklistReports/backend-report').set({userId:'backend-customer',userType:'user',status:'pending',reportedBy:'backend-caregiver',bookingId:'backend-booking',reason:'Safety concerns',description:'Synthetic report'});
 await db.doc('reportReceipts/backend-report').set({reportedBy:'backend-caregiver',bookingId:'backend-booking',reason:'Safety concerns',status:'pending',createdAt:new Date()});
 await applyAccountSafetyAction({requester,input:{targetType:'customer',targetId:'backend-customer',reason:'Synthetic safety concern',reportId:'backend-report'}});
 const receipt=(await db.doc('reportReceipts/backend-report').get()).data();assert.equal(receipt.status,'approved');assert.equal(receipt.approvedBy,undefined);
 assert.equal((await db.doc('users/backend-customer').get()).data().isSuspended,true);
});
test('online payment scaffold remains disabled',async()=>{await assert.rejects(verifyFonepayPayment({requester,paymentReference:'test-ref'}),{code:'unimplemented'});});
