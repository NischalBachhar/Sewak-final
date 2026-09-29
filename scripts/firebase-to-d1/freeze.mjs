import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {accessToken} from './export.mjs';

export function readOnlyRules(source) {
 let matched=0;
 const text=source.replace(/allow\s+([a-z,\s]+):\s*if\s+([^;]*);/g,(_all,methods,condition)=>{
  matched++;const reads=methods.split(',').map(s=>s.trim()).filter(method=>['read','get','list'].includes(method));
  return reads.length?`allow ${reads.join(', ')}: if ${condition};`:'allow write: if false;';
 });
 const unsafe=[...text.matchAll(/allow\s+([a-z,\s]+):\s*if\s+([^;]*);/g)].some((match)=>match[1].split(',').some(method=>['write','create','update','delete'].includes(method.trim()))&&match[2].trim()!=='false');
 if(!matched||unsafe)throw new Error('Rules could not be safely made read-only; review manually.');
 return text;
}
export function assertNoDeployedFunctions(listing) {
 if(!listing||typeof listing!=='object'||Array.isArray(listing)||listing.error||
   (listing.functions!==undefined&&!Array.isArray(listing.functions))||
   (listing.unreachable!==undefined&&!Array.isArray(listing.unreachable)))throw new Error('Functions inventory returned an invalid response. Source writers are unconfirmed.');
 if(listing.unreachable?.length)throw new Error('Some Functions regions were unreachable. Source writers are unconfirmed; do not freeze from a partial inventory.');
 if(listing.functions?.length||listing.nextPageToken)throw new Error('Deployed Functions may bypass rules. Retire their database writers before applying this freeze.');
}
export async function verifySourceWriters(project,{google,noServerWritersConfirmed=false}) {
 if(!noServerWritersConfirmed)throw new Error('Confirm that no external Admin SDK/server writers remain, then pass --no-server-writers-confirmed. Rules cannot stop those writers.');
 try{
  for(const version of ['v1','v2'])assertNoDeployedFunctions(await google(`https://cloudfunctions.googleapis.com/${version}/projects/${project}/locations/-/functions`));
  return {verification:'functions-inventory-and-owner-confirmation',checkedAt:new Date().toISOString(),noServerWritersConfirmed:true};
 }catch(error){
  // A disabled API cannot enumerate functions. Only the owner's explicit
  // confirmation, independently verified disabled service and no billing
  // allow this alternative. Do not treat other permission/network errors,
  // partial inventories or discovered functions as an empty inventory.
  if(error.status!==403||error.reason!=='SERVICE_DISABLED'||error.service!=='cloudfunctions.googleapis.com')throw error;
  const service=await google(`https://serviceusage.googleapis.com/v1/projects/${project}/services/cloudfunctions.googleapis.com`);
  const billing=await google(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`);
  if(service.state!=='DISABLED'||billing.billingEnabled!==false)throw new Error('The disabled-Functions alternative requires both a disabled API and disabled project billing, plus owner confirmation of no server writers.');
  return {verification:'owner-confirmation-with-disabled-functions-and-billing',checkedAt:new Date().toISOString(),noServerWritersConfirmed:true,functionsApi:service.state,billingEnabled:false};
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),arg=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
 const project=arg('--project');if(!project)throw new Error('Pass --project with the reviewed Firebase project.');
 const directory=resolve(arg('--output')||'.local-tools/d1-migration/freeze');mkdirSync(directory,{recursive:true});
 const token=await accessToken();
 async function google(url,{method='GET',json}={}){
  const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(json?{body:JSON.stringify(json)}:{})});
  if(!response.ok){const body=await response.json().catch(()=>({}));const info=body.error?.details?.find(detail=>detail['@type']==='type.googleapis.com/google.rpc.ErrorInfo');const error=new Error(`Firebase maintenance request failed (${response.status}): ${body.error?.status||'unknown'}${info?.reason?` / ${info.reason}`:''}. No service or billing plan is enabled automatically.`);Object.assign(error,{status:response.status,reason:info?.reason,service:info?.metadata?.service});throw error;}
  return response.json();
 }
 const rulesRoot=`https://firebaserules.googleapis.com/v1/projects/${project}`;
 const manifestPath=`${directory}/manifest.json`;
 if(args.includes('--prepare')){
  if(existsSync(manifestPath))throw new Error('This freeze backup already exists. Choose a fresh --output directory.');
  const listed=await google(`${rulesRoot}/releases`),releases=(listed.releases||[]).filter(r=>r.name.endsWith('/cloud.firestore')||r.name.includes('/firebase.storage/'));
  if(!releases.some(r=>r.name.endsWith('/cloud.firestore')))throw new Error('The Firestore release was not found.');
  const manifest={project,preparedAt:new Date().toISOString(),releases:[]};
  for(const [i,release]of releases.entries()){
   const ruleset=await google(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
   const source=ruleset.source;
   writeFileSync(`${directory}/original-${i}.json`,JSON.stringify(source,null,2));
   writeFileSync(`${directory}/readonly-${i}.json`,JSON.stringify({...source,files:source.files.map(f=>({...f,content:readOnlyRules(f.content)}))},null,2));
   manifest.releases.push({name:release.name,originalRuleset:release.rulesetName,index:i});
  }
  writeFileSync(manifestPath,JSON.stringify(manifest,null,2));console.log(JSON.stringify({prepared:true,releases:manifest.releases.map(r=>r.name),liveRulesChanged:false}));
 }else if(args.includes('--apply')||args.includes('--restore')){
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));if(manifest.project!==project)throw new Error('Backup project mismatch.');
  if(args.includes('--apply')){
   if(!arg('--validation')||!JSON.parse(readFileSync(arg('--validation'),'utf8')).pass)throw new Error('Supply a passing remote reconciliation report with --validation before freezing source writes.');
   manifest.writerCheck=await verifySourceWriters(project,{google,noServerWritersConfirmed:args.includes('--no-server-writers-confirmed')});
   writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
  }
  for(const release of manifest.releases){
   const current=await google(`https://firebaserules.googleapis.com/v1/${release.name}`);
   const restore=args.includes('--restore');
   if(current.rulesetName===(restore?release.originalRuleset:release.frozenRuleset))continue;
   if(current.rulesetName!==(restore?release.frozenRuleset:release.originalRuleset))throw new Error('Live rules changed since backup. Reconcile rather than overwriting.');
   let ruleset=release.originalRuleset;
   if(!restore){
    const source=JSON.parse(readFileSync(`${directory}/readonly-${release.index}.json`,'utf8'));
    const created=release.frozenRuleset?{name:release.frozenRuleset}:await google(`${rulesRoot}/rulesets`,{method:'POST',json:{source}});ruleset=created.name;
    release.frozenRuleset=ruleset;writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
   }
   await google(`https://firebaserules.googleapis.com/v1/${release.name}`,{method:'PATCH',json:{release:{name:release.name,rulesetName:ruleset}}});
   release.state=restore?'restored':'frozen';writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
  }
  console.log(JSON.stringify({project,state:args.includes('--restore')?'restored':'frozen',dataDeleted:false}));
 }else throw new Error('Choose --prepare, --apply or --restore.');
}
