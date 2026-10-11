import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertIncidentRecovery,INCIDENT_VERSION} from '../../scripts/incident-recovery-contract.mjs';
const now=Date.parse('2026-10-11T09:00:00.000Z'),iso='2026-10-11T08:59:00.000Z';
const fixture=()=>({
 now,gitSha:'goodsha',liveVersion:INCIDENT_VERSION,
 prepared:{worker:'sewak-final',gitSha:'goodsha',version:INCIDENT_VERSION,preparedAt:iso,bookmarks:{DB:'db-bookmark-12345',MEDIA_DB:'media-bookmark-12345'}},
 validation:{pass:true,backend:'cloudflare-d1',worker:'sewak-final',version:INCIDENT_VERSION,checkedAt:iso,
 health:{healthy:true,auth:'cloudflare-d1',writesEnabled:true},
 checks:{DB:{integrity:'ok',foreignKeyViolations:0},MEDIA_DB:{integrity:'ok',foreignKeyViolations:0}}},
 failedQa:{worker:'sewak-final',version:INCIDENT_VERSION,auth:'cloudflare-d1',qaMode:'production-write-enabled',pass:false,
 cleanupVerified:true,applicationRecordsUnchanged:true,completedAt:iso,
 failure:{message:'create synthetic user: HTTP 503 delivery-unavailable — Email delivery is not configured.'},
 checks:[{label:'create synthetic user',status:503}]},
});
test('only the exact broken version plus valid cleanup and both D1 bookmarks can enter recovery',()=>{
 assert.equal(assertIncidentRecovery(fixture()),true);
});
test('recovery rejects altered version, account checks, stale evidence, unfinished cleanup and wrong failure',()=>{
 const changes=[
   f=>{f.liveVersion='another-version'},
   f=>{f.prepared.version='another-version'},
   f=>{f.prepared.gitSha='wrong-tree'},
   f=>{delete f.prepared.bookmarks.MEDIA_DB},
   f=>{f.prepared.preparedAt='2026-10-11T07:00:00Z'},
   f=>{f.validation.pass=false},
   f=>{f.validation.version='another-version'},
   f=>{f.validation.checkedAt='2026-10-11T07:00:00Z'},
   f=>{f.validation.health.writesEnabled=false},
   f=>{f.validation.checks.DB.foreignKeyViolations=1},
   f=>{f.failedQa.pass=true},
   f=>{f.failedQa.cleanupVerified=false},
   f=>{f.failedQa.applicationRecordsUnchanged=false},
   f=>{f.failedQa.cleanupFailure={message:'cleanup incomplete'}},
   f=>{f.failedQa.version='wrong-worker'},
   f=>{f.failedQa.completedAt='2026-10-11T07:00:00Z'},
   f=>{f.failedQa.failure.message='Unexpected 503'},
   f=>{f.failedQa.checks=[]},
 ];
 for(const change of changes){const f=fixture();change(f);assert.throws(()=>assertIncidentRecovery(f));}
});
test('operator recovery is explicit, pinned, and does not auto-restore any D1 database',()=>{
 const code=readFileSync(new URL('../../scripts/incident-recover-sewak-final.mjs',import.meta.url),'utf8');
 assert.ok(code.includes("assert.equal(answer,'RECOVER sewak-final 750f1bb7'"));
 assert.ok(code.includes("assert.equal(sha,git('rev-parse','origin/main')"));
 assert.ok(code.includes("await assertFreeAccount(SEWAK_ACCOUNT,{attested:true})"));
 assert.ok(code.includes("'scripts/verify-cloudflare-auth.mjs'"));
 assert.ok(code.includes("'scripts/verify-cloudflare-data.mjs'"));
 assert.ok(code.includes("await smoke()"));
 assert.ok(code.includes("'rollback',INCIDENT_VERSION"));
 assert.ok(code.includes("'--message','Revert failed incident repair validation'"));
 assert.doesNotMatch(code,/time_travel\/restore|DELETE FROM|DROP TABLE|UPDATE cf_credentials/);
});
