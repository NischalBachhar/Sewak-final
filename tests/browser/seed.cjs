const backendRequire=require('node:module').createRequire(require.resolve('../../functions/package.json'));
const { initializeApp, getApps }=backendRequire('firebase-admin/app');
const { getAuth }=backendRequire('firebase-admin/auth');
const { getFirestore }=backendRequire('firebase-admin/firestore');
if(process.env.GCLOUD_PROJECT!=='demo-sewak-test'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw new Error('Browser fixtures refuse production connections.');
if(!getApps().length)initializeApp({projectId:'demo-sewak-test'});
const db=getFirestore();
async function seed(){
 const auth=getAuth();
 for(const [uid,role]of[['e2e-customer','user'],['e2e-caregiver','caregiver'],['e2e-org','orgadmin'],['e2e-admin','superadmin']]){
  try{await auth.createUser({uid,email:`${uid}@example.test`,password:'Local-test-only-123!'});}catch(e){if(e.code!=='auth/uid-already-exists')throw e;}
  await auth.setCustomUserClaims(uid,{platformRole:role,...(role==='orgadmin'?{organizationApproved:true}:{})});
  await db.doc(`users/${uid}`).set({uid,role,email:`${uid}@example.test`,name:uid==='e2e-customer'?'Test Customer':'Test '+role,phone:'+9779800000000',address:'Synthetic Street 12',city:'Hetauda',profileComplete:true,isApproved:true,isSuspended:false,isBlacklisted:false,...(role==='orgadmin'||role==='caregiver'?{organizationId:'e2e-org',organizationName:'Test Organization'}:{})});
 }
 await db.doc('organizations/e2e-org').set({adminUid:'e2e-org',organizationId:'e2e-org',role:'orgadmin',organizationName:'Test Organization',adminName:'Test orgadmin',adminEmail:'e2e-org@example.test',isApproved:true,verified:true,isSuspended:false,isBlacklisted:false,profileComplete:true,commissionRate:12.5,caregivers:[]});
 const vendor={uid:'e2e-caregiver',vendorId:'e2e-caregiver',name:'Test Caregiver',email:'e2e-caregiver@example.test',phone:'+9779800000000',category:'caregiver',workType:'parttime',shifts:['morning'],servicesOffered:['e2e-care'],hourlyRate:500,experience:3,location:'Hetauda',bio:'Synthetic caregiver profile for local tests.',isApproved:true,isAvailable:true,isSuspended:false,isBlacklisted:false,organizationId:'e2e-org',organizationName:'Test Organization',createdAt:new Date()};
 await db.doc('vendors/e2e-caregiver').set(vendor);
 const {publicCaregiverRecord}=require('../../functions/src/public-projections');
 await db.doc('publicCaregivers/e2e-caregiver').set(publicCaregiverRecord('e2e-caregiver',vendor,true,12.5));
 const service={label:'General care support',serviceName:'General care support',category:'caregiver',organizationId:'e2e-org',organizationName:'Test Organization',isActive:true,createdBy:'e2e-org',createdAt:new Date()};
 await db.doc('services/e2e-care').set(service);await db.doc('publicServices/e2e-care').set({serviceId:'e2e-care',label:service.label,category:'caregiver',isActive:true});
}
module.exports={seed,db};
