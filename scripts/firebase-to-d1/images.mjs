import { createRequire } from 'node:module';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectImage } from '../../worker/src/image-validation.mjs';
import { storeProfileImage } from '../../worker/src/media.ts';
import { Repository } from '../../worker/src/repository.ts';
import { openTarget } from '../d1-target.mjs';
const require=createRequire(new URL('../../worker/package.json',import.meta.url));
const sharp=require('sharp');
const aliases=['profilePicture','profileImage','photoURL','photoUrl','image'];

export function discoverImages(snapshot) {
 const byOwner=new Map();const failures=[];
 for(const [path,data]of Object.entries(snapshot.documents || {})) {
  if(!/^(users|vendors)\/[^/]+$/.test(path))continue;
  const uid=path.split('/')[1];
  for(const field of aliases)if(typeof data[field]==='string'&&data[field]) {
   const entry=byOwner.get(uid)||{uid,urls:new Set(),sources:[]};entry.urls.add(data[field]);entry.sources.push(`${path}.${field}`);byOwner.set(uid,entry);
  }
 }
 for(const auth of snapshot.authUsers || [])if(auth.photoURL) {
  const entry=byOwner.get(auth.uid)||{uid:auth.uid,urls:new Set(),sources:[]};
  // Prefer the current database profile over a potentially stale Auth alias.
  if(!entry.urls.size)entry.urls.add(auth.photoURL);
  entry.sources.push('Firebase Auth photoURL');byOwner.set(auth.uid,entry);
 }
 const images=[];
 for(const entry of byOwner.values()) {
  if(entry.urls.size!==1)failures.push({uid:entry.uid,reason:'Conflicting profile image aliases require an explicit choice.'});
  else if(!snapshot.documents[`users/${entry.uid}`]&&!snapshot.documents[`vendors/${entry.uid}`])failures.push({uid:entry.uid,reason:'Auth photo has no structured profile owner.'});
  else images.push({...entry,url:[...entry.urls][0],urls:undefined});
 }
 return {images,failures,discoveredOwners:byOwner.size};
}
function safeSource(value,project) {
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.port)throw new Error('Image URL must use trusted HTTPS.');
 const buckets=[`${project}.firebasestorage.app`,`${project}.appspot.com`];
 const match=url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
 if(url.hostname!=='firebasestorage.googleapis.com'||!match||!buckets.includes(decodeURIComponent(match[1]))||!decodeURIComponent(match[2]).startsWith('profile_pictures/'))throw new Error('Source is outside this project profile_pictures storage path; review and explicitly map it.');
 return url;
}
async function download(url,project) {
 const response=await fetch(safeSource(url,project),{redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`Source download returned HTTP ${response.status}.`);
 if(Number(response.headers.get('content-length'))>10000000)throw new Error('Source image exceeds 10 MB.');
 const chunks=[];let length=0;
 for await(const chunk of response.body){length+=chunk.byteLength;if(length>10000000){await response.body.cancel().catch(()=>{});throw new Error('Source image exceeds 10 MB.');}chunks.push(chunk);}
 return Buffer.concat(chunks,length);
}
export async function compressImage(bytes) {
 const source=sharp(bytes,{limitInputPixels:40000000,failOn:'warning',animated:false});
 const metadata=await source.metadata();
 if(!['jpeg','png','webp'].includes(metadata.format)||(metadata.pages||1)>1)throw new Error('Unsupported or animated source image.');
 for(const quality of [82,74,66,58,48]) {
  const binary=await source.clone().rotate().resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).webp({quality,effort:4}).toBuffer();
  if(binary.length<=150000 || quality===48&&binary.length<=200000){const info=inspectImage(binary,'image/webp');return {binary,info};}
 }
 throw new Error('Cannot compress this image under 200 KB.');
}
export async function migrateImages(snapshot,{apply=false,target,origin,output}) {
 const discovery=discoverImages(snapshot),report={discovered:discovery.discoveredOwners,migrated:0,planned:discovery.images.length,failures:[...discovery.failures],images:[],dryRun:!apply};
 if(origin){const url=new URL(origin);if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash)throw new Error('Remote image target must be a reviewed HTTPS origin.');if(!process.env.SEWAK_MIGRATION_TOKEN)throw new Error('Set SEWAK_MIGRATION_TOKEN for the temporary image endpoint.');}
 for(const entry of discovery.images) {
  try {
   const {binary,info}=await compressImage(await download(entry.url,snapshot.project));
   if(output){const path=resolve(output,'images',`${encodeURIComponent(entry.uid)}.webp`);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,binary,{mode:0o600});}
   if(apply){
    if(origin){const response=await fetch(`${origin.replace(/\/$/,'')}/api/migration/profiles/${encodeURIComponent(entry.uid)}/image`,{method:'PUT',headers:{'Content-Type':info.mime,'X-Sewak-Migration-Token':process.env.SEWAK_MIGRATION_TOKEN},body:binary,redirect:'error'});if(!response.ok)throw new Error(`Migration upload returned HTTP ${response.status}.`);}
    else {const repo=new Repository(target),profile=await repo.data(`users/${entry.uid}`),caregiver=await repo.data(`vendors/${entry.uid}`);if(!profile&&!caregiver)throw new Error('The target profile is missing.');await storeProfileImage(new Request('http://localhost/image',{method:'PUT',headers:{'Content-Type':info.mime},body:binary}),repo,entry.uid,{profile,caregiver,ownerType:caregiver?'caregiver':profile.role==='superadmin'?'admin':'user'},true);}
    report.migrated++;
   }
   report.images.push({uid:entry.uid,...info});
  }catch(error){report.failures.push({uid:entry.uid,reason:error.message});}
 }
 const sizes=report.images.map(i=>i.size);report.averageBytes=sizes.length?sizes.reduce((a,b)=>a+b,0)/sizes.length:0;report.largestBytes=sizes.length?Math.max(...sizes):0;
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),arg=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
 (async()=>{const snapshot=JSON.parse(readFileSync(arg('--input'),'utf8')),apply=args.includes('--apply'),origin=arg('--origin');const target=apply&&!origin?await openTarget():null;try{const report=await migrateImages(snapshot,{apply,target,origin,output:arg('--output')});if(arg('--report'))writeFileSync(arg('--report'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({...report,images:report.images.length,failures:report.failures.length}));if(report.failures.length)process.exitCode=1;}finally{await target?.close();}})().catch(error=>{console.error(error.message);process.exitCode=1;});
}
