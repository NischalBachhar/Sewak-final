import test from 'node:test';
import assert from 'node:assert/strict';
import {environment} from './harness.mjs';
import {migrationPlan} from '../../scripts/firebase-to-d1/transform.mjs';
import {importSnapshot} from '../../scripts/firebase-to-d1/import.mjs';
import {validateMigration} from '../../scripts/validate-migration/index.mjs';
test('migration preserves IDs, fractional timestamps, nested types, NULL and resumes idempotently',async()=>{
 const snapshot={exportedAt:'2026-09-21T00:00:00Z',documents:{'users/a':{uid:'a',role:'user',name:'Test',createdAt:{__timestamp:'2026-09-01T12:23:45.123456Z'},phone:null,preferences:{nested:[1,true,null],location:{__geopoint:{latitude:27.4,longitude:85}}}}}};
 const target=environment();const first=await importSnapshot(snapshot,target,{apply:true});assert.equal(first.inserted,1);
 assert.equal((await importSnapshot(snapshot,target,{apply:true})).unchanged,1);
 const result=await validateMigration(snapshot,target);assert.equal(result.pass,true,JSON.stringify(result));
});
test('unknown collections, secrets and missing participant links are reported without silent drops',()=>{
 const plan=migrationPlan({documents:{'unknown/id':{a:1},'users/a':{privateKey:'never-copy'},'bookings/b':{userId:'missing',status:'pending'}}});
 assert.equal(plan.sourceCount,3);assert.equal(plan.failures.length,3);assert.equal(plan.records.length,0);
});
test('deleted legacy service stays an explicit historical exception without invented catalog data',()=>{
 const plan=migrationPlan({documents:{'bookings/b':{status:'completed',serviceId:'old-service'}}});
 assert.equal(plan.failures.length,0);assert.equal(plan.warnings.length,1);assert.equal(plan.records[0].encoded.service_id,null);assert.equal(JSON.parse(plan.records[0].encoded.extra_json).serviceId,'old-service');
});
test('changed snapshots clear removed indexed fields and preserve NULL versus missing',async()=>{
 const target=environment(),snapshot={exportedAt:'2026-09-21T00:00:00Z',documents:{'users/a':{uid:'a',role:'user',city:'Old city',phone:null}}};
 await importSnapshot(snapshot,target,{apply:true});delete snapshot.documents['users/a'].city;
 await importSnapshot(snapshot,target,{apply:true});assert.equal((await validateMigration(snapshot,target)).pass,true);
 assert.equal(target.DB.database.prepare('SELECT city FROM users').get().city,null);
});
test('typed relation references normalize known IDs while nested references retain their full path',async()=>{
 const prefix='projects/demo/databases/(default)/documents/';
 const snapshot={project:'demo',database:'(default)',exportedAt:'2026-09-22T00:00:00Z',documents:{'users/u':{role:'user',metadata:{external:{__reference:'projects/other/databases/(default)/documents/items/same-id'}}},'organizationApplications/u':{applicantId:{__reference:prefix+'users/u'}}}};
 const target=environment();const result=await importSnapshot(snapshot,target,{apply:true});assert.equal(result.failures.length,0);assert.equal((await validateMigration(snapshot,target)).pass,true);
 const plan=migrationPlan(snapshot);assert.equal(plan.records.find(r=>r.name==='organizationApplications').data.applicantId,'u');assert.equal(plan.records[0].data.metadata.external.__reference,'projects/other/databases/(default)/documents/items/same-id');
 snapshot.documents['organizationApplications/u'].applicantId.__reference='projects/other/databases/(default)/documents/users/u';assert.equal(migrationPlan(snapshot).failures.length,1);
});
