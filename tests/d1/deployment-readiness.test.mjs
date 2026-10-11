import test from 'node:test';
import assert from 'node:assert/strict';
import {DeploymentPending,waitForDeploymentReady} from '../../scripts/deployment-readiness.mjs';
test('readiness accepts only a fully passing check after explicit pending observations',async()=>{
 let calls=0;const waits=[],events=[];
 const result=await waitForDeploymentReady(async()=>{if(++calls<3)throw new DeploymentPending('smoke.invalid-cookie');return 'new-version';},{sleep:async ms=>waits.push(ms),onPending:e=>events.push(e)});
 assert.equal(result,'new-version');assert.equal(calls,3);assert.deepEqual(waits,[2000,2000]);assert.deepEqual(events,[{stage:'smoke.invalid-cookie',attempt:1},{stage:'smoke.invalid-cookie',attempt:2}]);
});
test('persistent 503 readiness failures never qualify as success',async()=>{
 let calls=0,waits=0;
 await assert.rejects(waitForDeploymentReady(async()=>{calls++;throw new DeploymentPending('smoke.health');},{sleep:async()=>{waits++;}}),DeploymentPending);
 assert.equal(calls,15);assert.equal(waits,14);
});
test('binding and security assertion failures are never retried or suppressed',async()=>{
 let calls=0;const reason=new Error('binding or authorization assertion failed');
 await assert.rejects(waitForDeploymentReady(async()=>{calls++;throw reason;},{sleep:async()=>assert.fail('must not retry')}),e=>e===reason);assert.equal(calls,1);
});
test('arbitrary readiness stages cannot expose private values',()=>{
 const e=new DeploymentPending('private-account@example.test');assert.equal(e.stage,'unknown-stage');assert.ok(!JSON.stringify(e).includes('private-account'));
});
