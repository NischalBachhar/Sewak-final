const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, serverTimestamp, Timestamp, writeBatch, runTransaction } = require('firebase/firestore');
const { randomUUID } = require('node:crypto');
if (process.env.GCLOUD_PROJECT !== 'demo-sewak-test' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw new Error('Tests require the isolated demo emulator; refusing any other connection.');
let env;
const actor = (uid, role = 'user') => env.authenticatedContext(uid, { email: `${uid}@example.test`, platformRole: role }).firestore();
const seed = async (records) => env.withSecurityRulesDisabled(async (ctx) => {
  for (const [key, data] of Object.entries(records)) await setDoc(doc(ctx.firestore(), key), data);
});
const id = () => `customer_${randomUUID()}`;
const data = (overrides = {}) => ({
  schemaVersion: 2, requestFingerprint: 'a'.repeat(64), userId: 'customer', userName: 'Test Customer',
  userPhone: '+9779800000000', userEmail: 'customer@example.test', address: 'Test Street 12', city: 'Hetauda',
  date: '2090-01-01', time: '10:00', scheduleAt: Timestamp.fromDate(new Date('2090-01-01T10:00:00+05:45')),
  requestedTimeWindows: [], durationHours: 4, recurrence: 'one_time', notes: 'Synthetic notes', careRecipient: 'Test recipient', careNeeds: 'Synthetic care needs',
  serviceId: 'care', serviceLabel: 'Care', caregiverId: 'caregiver', vendorId: 'caregiver', organizationId: 'org',
  organizationName: 'Test Org', caregiverName: 'Test Caregiver', caregiverLocation: 'Hetauda', caregiverWorkType: 'parttime', caregiverShifts: [], caregiverCategory: 'caregiver',
  status: 'pending', hourlyRate: 500, commissionRate: 15, totalAmount: 2000, platformCommission: 300, vendorEarnings: 1700,
  paymentMethod: 'cash', paymentStatus: 'pending', amountDue: 2000, createdAt: serverTimestamp(), ...overrides,
});
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-sewak-test', firestore: { host: '127.0.0.1', port: 8080, rules: fs.readFileSync('firestore.rules','utf8') } }); });
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
 await env.clearFirestore();
 await seed({
  'users/customer': { uid: 'customer', role: 'user', isSuspended: false },
  'users/caregiver': { uid: 'caregiver', role: 'caregiver', isSuspended: false },
  'users/org': { uid: 'org', role: 'orgadmin', organizationId: 'org' },
  'users/admin': { uid: 'admin', role: 'superadmin' },
  'organizations/org': { adminUid: 'org', organizationId: 'org', role: 'orgadmin', isApproved: true, verified: true, isSuspended: false, commissionRate: 15 },
  'vendors/caregiver': { name: 'Test Caregiver', hourlyRate: 500, organizationId: 'org', isApproved: true, isAvailable: true, isSuspended: false, category: 'caregiver', workType: 'parttime', servicesOffered: ['care'] },
  'publicCaregivers/caregiver': { name: 'Stale listing', hourlyRate: 1, isApproved: true, isAvailable: true, isOrganizationActive: true, isSuspended: false, isBlacklisted: false },
  'services/care': { label: 'Care', category: 'caregiver', organizationId: 'org', isActive: true },
 });
});
test('valid cash booking succeeds using private authoritative terms', async () => assertSucceeds(setDoc(doc(actor('customer'),'bookings',id()), data())));
for (const [name, patch] of Object.entries({
 'zeroed price': {hourlyRate:0,totalAmount:0,amountDue:0,platformCommission:0,vendorEarnings:0},
 'forged commission': {commissionRate:0,platformCommission:0,vendorEarnings:2000},
 'foreign tenant': {organizationId:'other'}, 'unsupported service':{serviceId:'laundry'},
 'empty name':{userName:' '}, 'whitespace address':{address:'     '}, 'invalid phone':{userPhone:'123'},
 'empty recipient':{careRecipient:''}, 'past date':{date:'2000-01-01',scheduleAt:Timestamp.fromDate(new Date('2000-01-01T10:00:00+05:45'))},
 'forged schedule':{date:'2000-01-01'}, 'duration overflow':{durationHours:721}, 'invalid recurrence':{recurrence:'daily-forever'},
 'online payment':{paymentMethod:'fonepay',paymentStatus:'paid'}, 'identity spoof':{userEmail:'other@example.test'},
})) test(`rejects ${name}`, async () => assertFails(setDoc(doc(actor('customer'),'bookings',id()), data(patch))));
for (const target of ['vendors/caregiver','organizations/org','users/customer']) test(`stale listing cannot bypass suspension in ${target}`,async()=>{
 await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),target),{isSuspended:true}));
 await assertFails(setDoc(doc(actor('customer'),'bookings',id()), data()));
});
test('zero and custom commission rates are snapshotted', async()=>{
 for(const rate of [0,12.5]) {
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'organizations/org'),{commissionRate:rate}));
  await assertSucceeds(setDoc(doc(actor('customer'),'bookings',id()),data({commissionRate:rate,platformCommission:20*rate,vendorEarnings:2000-20*rate})));
 }
});
test('zero price requires an explicit private configuration',async()=>{
 await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'vendors/caregiver'),{hourlyRate:0}));
 const free=data({hourlyRate:0,totalAmount:0,amountDue:0,platformCommission:0,vendorEarnings:0});
 await assertFails(setDoc(doc(actor('customer'),'bookings',id()),free));
 await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'vendors/caregiver'),{allowZeroRate:true}));
 await assertSucceeds(setDoc(doc(actor('customer'),'bookings',id()),free));
});
test('concurrent transactions create one immutable booking per attempt',async()=>{
 const ref=doc(actor('customer'),'bookings',id());
 const save=()=>runTransaction(ref.firestore,async tx=>{const snap=await tx.get(ref);if(!snap.exists())tx.set(ref,data());return ref.id;});
 assert.equal(new Set(await Promise.all([save(),save(),save()])).size,1);
 await assertFails(updateDoc(ref,{requestFingerprint:'b'.repeat(64),notes:'Different request'}));
 await assertSucceeds(setDoc(doc(actor('customer'),'bookings',id()),data()));
});
test('customers cannot elevate roles, list users, read other bookings or approve organizations',async()=>{
 const db=actor('customer');
 await assertFails(updateDoc(doc(db,'users/customer'),{role:'superadmin'}));
 await assertFails(getDocs(collection(db,'users')));
 await assertSucceeds(setDoc(doc(db,'bookings',id()),data()));
 const foreign=id(); await seed({[`bookings/${foreign}`]:data({userId:'other'})});
 await assertFails(getDoc(doc(db,'bookings',foreign)));
 await assertFails(updateDoc(doc(db,'organizations/org'),{isApproved:true,isSuspended:false}));
 await assertFails(updateDoc(doc(actor('admin','superadmin'),'organizations/org'),{isApproved:false}));
});
test('household legacy and canonical categories save, but provider mismatch fails',async()=>{
 for(const category of ['household','vendor']) {
  await assertSucceeds(setDoc(doc(actor('org','orgadmin'),'services',`housework-${category}`),{label:'Housework',category,organizationId:'org',createdBy:'org',createdAt:serverTimestamp()}));
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'vendors/caregiver'),{servicesOffered:[`housework-${category}`],category:'vendor'}));
  await assertSucceeds(setDoc(doc(actor('customer'),'bookings',id()),data({caregiverCategory:'vendor',serviceId:`housework-${category}`,serviceLabel:'Housework'})));
 }
 await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'vendors/caregiver'),{category:'household'}));
 await assertSucceeds(setDoc(doc(actor('customer'),'bookings',id()),data({caregiverCategory:'vendor',serviceId:'housework-vendor',serviceLabel:'Housework'})));
});
test('customer -> acceptance -> atomic start -> atomic completion -> verified review; unpaid stays unpaid',async()=>{
 const bookingId=id(), customer=actor('customer'), caregiver=actor('caregiver','caregiver');
 const bookingRef=doc(customer,'bookings',bookingId);
 await assertSucceeds(setDoc(bookingRef,data()));
 await assertSucceeds(getDoc(doc(customer,'reviews',bookingId)));
 await assertFails(getDoc(doc(actor('unrelated'),'reviews',bookingId)));
 const review={bookingId,caregiverId:'caregiver',customerId:'customer',rating:5,comment:'Good care',isVerifiedReview:true,createdAt:serverTimestamp()};
 await assertFails(setDoc(doc(customer,'reviews',bookingId),review));
 await assertSucceeds(updateDoc(doc(caregiver,'bookings',bookingId),{status:'accepted',updatedAt:serverTimestamp()}));
 const session={bookingId,caregiverId:'caregiver',customerId:'customer',organizationId:'org',scheduledDate:'2090-01-01',scheduledTime:'10:00',scheduledDurationHours:4,status:'in_progress',actualCheckIn:serverTimestamp(),createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
 await assertFails(setDoc(doc(caregiver,'careSessions',bookingId),session));
 const start=writeBatch(caregiver);start.set(doc(caregiver,'careSessions',bookingId),session);start.update(doc(caregiver,'bookings',bookingId),{status:'in_progress',careSessionId:bookingId,updatedAt:serverTimestamp()});await assertSucceeds(start.commit());
 await assertFails(updateDoc(doc(caregiver,'careSessions',bookingId),{status:'completed',actualCheckOut:serverTimestamp(),updatedAt:serverTimestamp()}));
 const finish=writeBatch(caregiver);finish.update(doc(caregiver,'careSessions',bookingId),{status:'completed',actualCheckOut:serverTimestamp(),updatedAt:serverTimestamp()});finish.update(doc(caregiver,'bookings',bookingId),{status:'completed',updatedAt:serverTimestamp()});await assertSucceeds(finish.commit());
 await assertSucceeds(setDoc(doc(customer,'reviews',bookingId),review));
 await assertFails(setDoc(doc(customer,'reviews',bookingId),review));
 assert.equal((await getDoc(bookingRef)).data().paymentStatus,'pending');
});
test('pending cancellation and empty-roster organization booking history',async()=>{
 const bookingId=id();await setDoc(doc(actor('customer'),'bookings',bookingId),data());
 await assertSucceeds(updateDoc(doc(actor('customer'),'bookings',bookingId),{status:'cancelled',updatedAt:serverTimestamp()}));
 const owned=await assertSucceeds(getDocs(query(collection(actor('org','orgadmin'),'bookings'),where('organizationId','==','org'))));
 assert.equal(owned.size,1);
});

test('report and receipt are atomic, reporter-safe, unique, and moderated consistently',async()=>{
 const bookingId=id();await setDoc(doc(actor('customer'),'bookings',bookingId),data());
 const caregiver=actor('caregiver','caregiver');const reportRef=doc(caregiver,'blacklistReports',bookingId);const receiptRef=doc(caregiver,'reportReceipts',bookingId);
 await assertSucceeds(getDoc(receiptRef));
 const report={bookingId,userId:'customer',userType:'user',userName:'Test Customer',reportedBy:'caregiver',reportedByName:'Test Caregiver',reportedByOrgId:'org',reason:'Safety concerns',description:'Synthetic test report',status:'pending',createdAt:serverTimestamp()};
 const receipt={bookingId,reportedBy:'caregiver',reason:report.reason,status:'pending',createdAt:serverTimestamp()};
 await assertFails(setDoc(reportRef,report));
 const batch=writeBatch(caregiver);batch.set(reportRef,report);batch.set(receiptRef,receipt);batch.set(doc(caregiver,'reportLocks',bookingId),{reportId:bookingId,reportedBy:'caregiver'});await assertSucceeds(batch.commit());
 await assertSucceeds(getDocs(query(collection(caregiver,'reportReceipts'),where('reportedBy','==','caregiver'))));
 await assertFails(getDoc(reportRef));await assertFails(getDoc(doc(actor('other'),'reportReceipts',bookingId)));
 await assertFails(setDoc(reportRef,report));await assertFails(updateDoc(receiptRef,{status:'approved',moderatorNote:'Injected'}));
 const admin=actor('admin','superadmin');const reject=writeBatch(admin);
 reject.update(doc(admin,'blacklistReports',bookingId),{status:'rejected',rejectedAt:serverTimestamp(),rejectedBy:'admin'});
 reject.update(doc(admin,'reportReceipts',bookingId),{status:'rejected'});await assertSucceeds(reject.commit());
 assert.equal((await getDoc(receiptRef)).data().status,'rejected');
 assert.equal((await getDoc(receiptRef)).data().rejectedBy,undefined);
});

test('profile editor permissions exclude other caregivers and customers',async()=>{
 await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'vendors/caregiver'),{uid:'caregiver',vendorId:'caregiver',email:'caregiver@example.test',phone:'+9779800000000',shifts:['morning'],experience:3,location:'Hetauda',bio:'Synthetic profile',isBlacklisted:false,organizationName:'Test Organization',createdAt:Timestamp.now()}));
 await assertFails(updateDoc(doc(actor('customer'),'vendors/caregiver'),{name:'Spoofed Name'}));
 await assertFails(updateDoc(doc(actor('other','caregiver'),'vendors/caregiver'),{name:'Spoofed Name'}));
 await assertSucceeds(updateDoc(doc(actor('admin','superadmin'),'vendors/caregiver'),{name:'Edited Caregiver',location:'Hetauda',updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(actor('admin','superadmin'),'vendors/caregiver'),{hourlyRate:-1}));
 await assertFails(updateDoc(doc(actor('admin','superadmin'),'vendors/caregiver'),{isApproved:'yes'}));
 await assertFails(updateDoc(doc(actor('caregiver','caregiver'),'vendors/caregiver'),{organizationId:'other',isSuspended:false}));
});

test('time-window schedule is allowed for part-time but not full-time providers',async()=>{
 const window=data({time:'',requestedTimeWindows:['morning','night'],scheduleAt:Timestamp.fromDate(new Date('2090-01-01T23:59:00+05:45'))});
 await assertSucceeds(setDoc(doc(actor('customer'),'bookings',id()),window));
 await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'vendors/caregiver'),{workType:'fulltime'}));
 await assertFails(setDoc(doc(actor('customer'),'bookings',id()),{...window,caregiverWorkType:'fulltime'}));
});

test('organization publishes canonical household service atomically without exposing private metadata',async()=>{
 const db=actor('org','orgadmin'), serviceId='household-published';
 const privateData={label:'Housework',category:'vendor',organizationId:'org',createdBy:'org',createdAt:serverTimestamp()};
 const publicData={serviceId,label:'Housework',serviceName:'Housework',category:'vendor',description:'',price:0,isActive:true,updatedAt:serverTimestamp()};
 const batch=writeBatch(db);batch.set(doc(db,'services',serviceId),privateData);batch.set(doc(db,'publicServices',serviceId),publicData);await assertSucceeds(batch.commit());
 const publicSnap=await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),'publicServices',serviceId)));
 assert.equal(publicSnap.data().category,'vendor');assert.equal(publicSnap.data().createdBy,undefined);
 await assertFails(setDoc(doc(actor('customer'),'publicServices',serviceId),publicData));
 await assertFails(updateDoc(doc(db,'publicServices',serviceId),{label:'Forged',updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(db,'publicServices',serviceId),{organizationId:'org',updatedAt:serverTimestamp()}));
});

test('partial registration resumes atomically as customer with pending organization application',async()=>{
 const uid='applicant', db=actor(uid);
 const profile={uid,name:'Test Applicant',email:`${uid}@example.test`,role:'user',phone:'',address:'',city:'',createdAt:serverTimestamp(),isApproved:false,isSuspended:false,profileComplete:false};
 const application={applicantId:uid,applicantName:profile.name,applicantEmail:profile.email,organizationName:'Test Organization',businessPhone:'',businessAddress:'',businessCity:'',status:'pending',createdAt:serverTimestamp()};
 const save=()=>runTransaction(db,async tx=>{const p=await tx.get(doc(db,'users',uid));const a=await tx.get(doc(db,'organizationApplications',uid));if(!p.exists())tx.set(p.ref,profile);if(!a.exists())tx.set(a.ref,application);});
 await assertSucceeds(save());await assertSucceeds(save());
 assert.equal((await getDoc(doc(db,'users',uid))).data().role,'user');
 await assertFails(updateDoc(doc(db,'users',uid),{role:'orgadmin'}));
 await assertFails(updateDoc(doc(db,'organizationApplications',uid),{status:'approved'}));
});

test('backfilled legacy report lock prevents a second report under the new deterministic ID',async()=>{
 const bookingId=id();await setDoc(doc(actor('customer'),'bookings',bookingId),data());
 await seed({[`reportLocks/${bookingId}`]:{reportId:'legacy-random-id',reportedBy:'caregiver'},'reportReceipts/legacy-random-id':{bookingId,reportedBy:'caregiver',reason:'Safety concerns',status:'pending',createdAt:Timestamp.now()}});
 const caregiver=actor('caregiver','caregiver');await assertSucceeds(getDoc(doc(caregiver,'reportLocks',bookingId)));await assertFails(getDoc(doc(actor('other'),'reportLocks',bookingId)));
 await assertSucceeds(getDocs(query(collection(caregiver,'reportReceipts'),where('reportedBy','==','caregiver'))));
 await assertFails(setDoc(doc(caregiver,'blacklistReports',bookingId),{bookingId,reportedBy:'caregiver',status:'pending',createdAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(caregiver,'reportLocks',bookingId),{reportId:bookingId}));
});
