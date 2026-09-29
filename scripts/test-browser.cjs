const {spawnSync}=require('node:child_process'),fs=require('node:fs');
const env={...process.env,SEWAK_LOCAL_TESTS:'true',REACT_APP_CANONICAL_ORIGIN:'http://127.0.0.1:4173',GENERATE_SOURCEMAP:'false',SEWAK_E2E_TOKEN:require('node:crypto').randomBytes(32).toString('hex')};
delete env.DEBUG;for(const key of Object.keys(env))if(/CLOUDFLARE|FIREBASE|GCLOUD|GOOGLE_APPLICATION|MIGRATION_TOKEN/.test(key))delete env[key];
fs.mkdirSync('.local-tools',{recursive:true});fs.writeFileSync('.local-tools/last-build.json',JSON.stringify({authMode:'cloudflare-local-test'}));
const filter=env.SEWAK_BROWSER_GREP?['--grep',env.SEWAK_BROWSER_GREP]:[];
for(const args of [['node_modules/react-scripts/scripts/build.js'],['scripts/public-metadata.cjs'],['node_modules/@playwright/test/cli.js','test',...filter,...process.argv.slice(2)]]){const r=spawnSync(process.execPath,args,{env,stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);}
