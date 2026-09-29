import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {targets,assertDeploymentConfig} from './deployment-policy.mjs';
const worker=process.argv[2];
assert.equal(process.env.SEWAK_REVIEWED_TARGET,worker,'Use npm run deploy:cloudflare (or dev:worker); direct Wrangler deployment is disabled');
assertDeploymentConfig(worker,readFileSync(targets[worker].config,'utf8'));
