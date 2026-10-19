const {spawnSync}=require('node:child_process');
require('./check-build-ci.cjs');
const fs=require('node:fs');
const env={...process.env};
for(const key of Object.keys(env))if(/^REACT_APP_(FIREBASE|USE_EMULATORS)/.test(key))delete env[key];
delete env.DEBUG;
// Generate a short original moving illustration for public and signed-in heroes.
// Missing FFmpeg never blocks the release; the approved Sewak illustration remains.
const motion=spawnSync(process.execPath,['scripts/generate-care-video.cjs'],{env,stdio:'inherit'});
if(motion.status!==0)process.exit(motion.status??1);
if(!env.REACT_APP_SEWAK_HERO_VIDEO_URL&&fs.existsSync('public/videos/sewak-care-hero.mp4'))
  env.REACT_APP_SEWAK_HERO_VIDEO_URL='/videos/sewak-care-hero.mp4';
const result=spawnSync(process.execPath,['node_modules/react-scripts/scripts/build.js'],{env,stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
const metadata=spawnSync(process.execPath,['scripts/public-metadata.cjs'],{env,stdio:'inherit'});
if(metadata.status!==0)process.exit(metadata.status??1);
fs.mkdirSync('.local-tools',{recursive:true});
fs.writeFileSync('.local-tools/last-build.json',JSON.stringify({authMode:'cloudflare-production',builtAt:new Date().toISOString()}));
