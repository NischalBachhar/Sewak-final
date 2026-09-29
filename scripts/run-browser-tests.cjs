const {spawnSync}=require('node:child_process');
if(process.env.SEWAK_LOCAL_TESTS!=='true'||!process.env.SEWAK_E2E_TOKEN)throw new Error('Only isolated local browser tests are supported.');
const filter=process.env.SEWAK_BROWSER_GREP?['--grep',process.env.SEWAK_BROWSER_GREP]:[];
const result=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test',...filter,...process.argv.slice(2)],{env:process.env,stdio:'inherit'});process.exit(result.status??1);
