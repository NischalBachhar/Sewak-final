import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {assertFreeAccount} from './cloudflare-operator.mjs';
let config=readFileSync('wrangler.toml','utf8');
const workerIndex=process.argv.indexOf('--worker');
const worker=workerIndex>=0?process.argv[workerIndex+1]:config.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
if(!['sewak','sewak-final'].includes(worker))throw new Error('Choose the reviewed Sewak staging or production Worker: sewak / sewak-final.');
const configFile=worker==='sewak-final'?'wrangler.production.toml':'wrangler.toml';
if(existsSync(configFile))config=readFileSync(configFile,'utf8');
const writesEnabled=/APP_WRITES_ENABLED\s*=\s*"true"/.test(config);
const cutoverMaintenance=process.argv.includes('--cutover-maintenance');
if(cutoverMaintenance&&(worker!=='sewak-final'||writesEnabled))throw new Error('--cutover-maintenance is only for the read-only production cutover phase.');
if(worker==='sewak-final'&&!writesEnabled&&!cutoverMaintenance)throw new Error('Keep the existing production frontend in place during staging. Deploy sewak-final only for the reconciled, source-frozen cutover.');
if(worker==='sewak-final'&&(writesEnabled||cutoverMaintenance)&&!process.argv.includes('--source-frozen'))throw new Error('Freeze old structured-data writes and reconcile the final snapshot before opening D1 writes or replacing the production frontend.');
config=readFileSync(configFile,'utf8');
const account=config.match(/^account_id\s*=\s*"([^"]+)"/m)?.[1];
const selectedWrites=/APP_WRITES_ENABLED\s*=\s*"true"/.test(config);
if(worker==='sewak-final'&&selectedWrites&&!process.argv.includes('--source-frozen'))throw new Error('Frozen source verification is required.');
if(worker==='sewak'&&/database_name\s*=\s*"sewak-(db|media)"/.test(config))throw new Error('Staging must use isolated D1 databases.');
if(account!==process.env.CLOUDFLARE_ACCOUNT_ID)throw new Error('Select the exact Sewak account pinned in wrangler.toml.');
if(config.includes('00000000-0000'))throw new Error('Provision both databases before deployment.');
if(JSON.parse(readFileSync('.local-tools/last-build.json','utf8')).authMode!=='cloudflare-production')throw new Error('Run npm run build:release. Never deploy the browser-test bundle.');
if(/FIREBASE_|MIGRATION_ENABLED\s*=\s*"true"/.test(config))throw new Error('Firebase runtime configuration and migration endpoints must be absent.');
await assertFreeAccount(account,{attested:process.argv.includes('--free-plan-confirmed')});
if(worker==='sewak-final'&&(selectedWrites||cutoverMaintenance)){
 const reportPath=process.argv[process.argv.indexOf('--validation')+1];
 if(!process.argv.includes('--validation')||!JSON.parse(readFileSync(reportPath,'utf8')).pass)throw new Error('Supply --validation with the passing final remote report.');
 if(/MIGRATION_ENABLED\s*=\s*"true"/.test(config))throw new Error('Disable the migration endpoint before opening application writes.');
 if(worker==='sewak-final'){
  const qaPath=process.argv[process.argv.indexOf('--auth-qa')+1];
  if(!process.argv.includes('--auth-qa'))throw new Error('Supply a passing Cloudflare Auth QA report.');
  const qa=JSON.parse(readFileSync(qaPath,'utf8'));
  if(!qa.pass||qa.auth!=='cloudflare-d1'||(selectedWrites&&qa.worker!=='sewak-final'))throw new Error('Cloudflare Auth gates have not passed for this deployment phase.');
 }
}
const result=spawnSync(process.execPath,['worker/node_modules/wrangler/bin/wrangler.js','deploy','--config',configFile,'--name',worker],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});process.exit(result.status??1);
