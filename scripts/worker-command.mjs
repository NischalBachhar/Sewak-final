import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {SEWAK_ACCOUNT} from './deployment-policy.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const command=process.argv[2];
if(!['deploy','dev'].includes(command))throw new Error('Use deploy or dev');
const args=command==='deploy'?['scripts/deploy-worker.mjs',...process.argv.slice(3)]:['worker/node_modules/wrangler/bin/wrangler.js','dev','--config','wrangler.toml',...process.argv.slice(3)];
if(command==='dev'&&process.argv.length>3)throw new Error('Use the explicit staging dev configuration without overrides');
const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,...(command==='dev'?{SEWAK_REVIEWED_TARGET:'sewak',CLOUDFLARE_ACCOUNT_ID:SEWAK_ACCOUNT}:{})}});process.exit(result.status??1);
