const {spawnSync}=require('node:child_process');
if(process.env.GCLOUD_PROJECT!=='demo-sewak-test')throw new Error('Only demo browser tests are supported.');
const result=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2)],{env:process.env,stdio:'inherit'});process.exit(result.status??1);
