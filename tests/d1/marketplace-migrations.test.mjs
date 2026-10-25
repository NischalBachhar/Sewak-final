import test from 'node:test';
import assert from 'node:assert/strict';
import {migrationPlan,marketplaceMigrations} from '../../scripts/marketplace-migration-plan.mjs';
import {assertMarketplaceReady} from '../../scripts/marketplace-release-readiness.mjs';

test('marketplace migration plan preserves both 0010 files and accepts only additive new schemas',()=>{
 const plan=migrationPlan();assert.equal(plan.length,8);
 assert.equal(plan.filter(m=>m.name.startsWith('0010_')).length,2);
 assert.ok(plan.every(m=>m.statements.length&&m.hash.length===64));
 const journal=plan.map(m=>({name:m.name,hash:m.hash,applied_at:'2026-10-19T00:00:00Z'}));
 assert.ok(migrationPlan({journal,tables:marketplaceMigrations.map(m=>m[1])}).every(m=>m.applied&&m.statements.length===0));
});
test('migration drift, missing applied tables and partial unjournaled state fail closed',()=>{
 const [migration]=migrationPlan();
 assert.throws(()=>migrationPlan({journal:[{name:migration.name,hash:'different',applied_at:'2026-10-19'}],tables:[migration.table]}),/hash differs/);
 assert.throws(()=>migrationPlan({journal:[{name:migration.name,hash:migration.hash,applied_at:'2026-10-19'}]}),/table is missing/);
 assert.throws(()=>migrationPlan({tables:[migration.table]}),/unjournaled/);
});

test('guarded production upload rejects missing marketplace schemas and accepts exact applied hashes',async()=>{
 const plan=migrationPlan();
 const mock=async(_path,{json})=>[{results:json.sql.includes('sqlite_master')?plan.map(m=>({name:m.table})):plan.map(m=>({name:m.name,hash:m.hash,applied_at:'2026-10-19'}))}];
 await assertMarketplaceReady('sewak-final',mock);
 await assert.rejects(()=>assertMarketplaceReady('sewak-final',async()=>[{results:[]}]),/migrations must pass/);
 await assertMarketplaceReady('sewak',async()=>{throw new Error('Staging must not inspect production');});
});
