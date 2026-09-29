async function createTestAccount(data){const r=await fetch('http://127.0.0.1:4173/__test__/auth',{method:'POST',headers:{'Content-Type':'application/json','X-Sewak-E2e-Token':process.env.SEWAK_E2E_TOKEN},body:JSON.stringify(data)});if(!r.ok)throw new Error('Fixture account creation failed');}
const {db}=require('./d1-fixtures.cjs');
async function seed(){

 for(const [uid,role]of[['e2e-customer','user'],['e2e-caregiver','caregiver'],['e2e-org','orgadmin'],['e2e-admin','superadmin']]){
  await createTestAccount({uid,email:uid+'@example.test',password:'Local-test-only-123!'});
  await db.doc(`users/${uid}`).set({uid,role,email:`${uid}@example.test`,name:uid==='e2e-customer'?'Test Customer':'Test '+role,phone:'+9779800000000',address:'Synthetic Street 12',city:'Hetauda',profileComplete:true,isApproved:true,isSuspended:false,isBlacklisted:false});
 }
 await db.doc('organizations/e2e-org').set({adminUid:'e2e-org',organizationId:'e2e-org',role:'orgadmin',organizationName:'Test Organization',adminName:'Test orgadmin',adminEmail:'e2e-org@example.test',isApproved:true,verified:true,isSuspended:false,isBlacklisted:false,profileComplete:true,commissionRate:12.5,caregivers:[]});
 const vendor={uid:'e2e-caregiver',vendorId:'e2e-caregiver',name:'Test Caregiver',email:'e2e-caregiver@example.test',phone:'+9779800000000',category:'caregiver',workType:'parttime',shifts:['morning'],servicesOffered:['e2e-care'],hourlyRate:500,experience:3,location:'Hetauda',bio:'Synthetic caregiver profile for local tests.',isApproved:true,isAvailable:true,isSuspended:false,isBlacklisted:false,organizationId:'e2e-org',organizationName:'Test Organization',createdAt:new Date()};
 await db.doc('vendors/e2e-caregiver').set(vendor);
 const service={label:'General care support',serviceName:'General care support',category:'caregiver',organizationId:'e2e-org',organizationName:'Test Organization',isActive:true,createdBy:'e2e-org',createdAt:new Date()};
 await db.doc('services/e2e-care').set(service);
}
module.exports={seed,db,createTestAccount};
