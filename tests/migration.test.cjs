const {test}=require('node:test');const assert=require('node:assert/strict');
const {planMigration}=require('../scripts/migration-plan.cjs');
test('migration preserves private history and booking snapshots, redacts receipts, maps services and is idempotent',()=>{
 const records={'services/clean':{label:'Cleaning',category:'household',organizationId:'org'},'vendors/care':{category:'household',organizationId:'org',servicesOffered:['Cleaning']},'bookings/booking':{caregiverId:'care',userId:'customer',totalAmount:123},'caregiverReports/old':{bookingId:'booking',caregiverId:'care',reason:'Safety concerns',status:'pending',createdAt:{__timestamp:'2026-01-01T00:00:00.000Z'},moderatorNotes:'PRIVATE'}};
 const plan=planMigration(records);assert.equal(plan.blocked.length,0);const next={...records};for(const change of plan.changes)next[change.path]=change.after;
 assert.deepEqual(next['vendors/care'].servicesOffered,['clean']);assert.equal(next['services/clean'].category,'vendor');assert.equal(next['caregiverReports/old'].moderatorNotes,'PRIVATE');assert.equal(next['reportReceipts/old'].moderatorNotes,undefined);assert.equal(next['reportLocks/booking'].reportId,'old');assert.equal(next['bookings/booking'].totalAmount,123);assert.equal(planMigration(next).changes.length,0);
});
test('migration blocks ambiguous ownership and missing services without guessing',()=>{
 const plan=planMigration({'vendors/care':{servicesOffered:['Unknown']},'caregiverReports/x':{bookingId:'missing',reportedBy:'other',status:'pending'}});
 assert.equal(plan.blocked.length,2);assert.equal(plan.changes.length,0);
});
