import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {entities,decodeRecord} from '../../worker/src/model.mjs';
import {migrationPlan,canonicalJSON} from '../firebase-to-d1/transform.mjs';
import {openTarget} from '../d1-target.mjs';

export async function validateMigration(snapshot,target) {
 const plan=migrationPlan(snapshot), mismatches=[],counts={};
 const authMismatches=[];
 for(const user of snapshot.authUsers || []){
  const row=await target.DB.prepare('SELECT disabled,valid_since FROM auth_accounts WHERE uid=?').bind(user.uid).first();
  if(!row||row.disabled!==Number(user.disabled)||row.valid_since!==(Number(user.validSince)||0))authMismatches.push({uid:user.uid,reason:'Imported Auth restriction state mismatch'});
 }
 for(const [name,spec]of Object.entries(entities)){
  const expected=plan.records.filter(r=>r.name===name);
  const count=await target.DB.prepare(`SELECT COUNT(*) count FROM ${spec.table}`).first();
  counts[name]={firebase:expected.length,d1:count.count,pass:expected.length===count.count};
 }
 for(const r of plan.records){
  const columns=['id','version','fields_present','extra_json',...Object.values(entities[r.name].fields).map(f=>`"${f.column}"`)];
  const row=await target.DB.prepare(`SELECT ${columns.join(',')} FROM ${entities[r.name].table} WHERE id=?`).bind(r.key).first();
  if(!row){mismatches.push({path:r.path,reason:'Missing record'});continue;}
  const actual=decodeRecord(r.name,row);if(entities[r.name].child)delete actual.sessionId;
  // A media migration can add only this independently validated reference.
  if(!Object.hasOwn(r.data,'profile_image_id'))delete actual.profile_image_id;
  if(canonicalJSON(actual)!==canonicalJSON(r.data))mismatches.push({path:r.path,reason:'Field value/type/timestamp/nested data mismatch'});
 }
 const integrity=await target.DB.prepare('PRAGMA quick_check').all();
 const mediaIntegrity=await target.MEDIA_DB.prepare('PRAGMA quick_check').all();
 const foreignKeys=await target.DB.prepare('PRAGMA foreign_key_check').all();
 // Metadata/length inspection only: never fetch all BLOB bodies for statistics.
 const media=await target.MEDIA_DB.prepare("SELECT COUNT(*) count,COALESCE(AVG(file_size),0) average_size,COALESCE(MAX(file_size),0) largest_size,COALESCE(SUM(file_size),0) bytes FROM media").first();
 const badMedia=await target.MEDIA_DB.prepare("SELECT id,owner_id FROM media WHERE typeof(data)!='blob' OR length(data)!=file_size OR file_size<1 OR file_size>200000 OR width>512 OR height>512 OR mime_type NOT IN ('image/webp','image/jpeg')").all();
 const images=[],referencedMedia=new Set();for(const r of plan.records.filter(r=>['users','vendors'].includes(r.name))){
  const row=await target.DB.prepare(`SELECT profile_image_id FROM ${entities[r.name].table} WHERE id=?`).bind(r.key).first();
  if(row?.profile_image_id){referencedMedia.add(row.profile_image_id);const image=await target.MEDIA_DB.prepare('SELECT id,owner_id,owner_type FROM media WHERE id=?').bind(row.profile_image_id).first();if(!image||image.owner_id!==r.key)images.push({path:r.path,reason:'Missing or incorrectly owned profile image'});}
 }
 let lastMedia='';
 while(true){const page=await target.MEDIA_DB.prepare('SELECT id,owner_id FROM media WHERE id>? ORDER BY id LIMIT 100').bind(lastMedia).all();for(const row of page.results)if(!referencedMedia.has(row.id))images.push({id:row.id,reason:'Unlinked media owner row requires reconciliation'});if(page.results.length<100)break;lastMedia=page.results.at(-1).id;}
 // D1 exposes database size in result metadata; page_count/integrity_check are
 // not supported by its SQLite authorizer. quick_check is supported.
 const mainBytes=integrity.meta?.size_after ?? null,mediaBytes=mediaIntegrity.meta?.size_after ?? null;
 return {sourceExportedAt:snapshot.exportedAt,counts,mismatches,authMismatches,sourceFailures:plan.failures,sourceWarnings:plan.warnings,integrity:integrity.results,mediaIntegrity:mediaIntegrity.results,foreignKeys:foreignKeys.results,media:{...media,invalid:badMedia.results,brokenReferences:images,mainStorageBytes:mainBytes,mediaStorageBytes:mediaBytes,additionalImagesAtAverage:media.average_size && mediaBytes!==null?Math.floor((500000000-mediaBytes)*0.8/media.average_size):null},
 pass:!plan.failures.length&&!authMismatches.length&&!mismatches.length&&!foreignKeys.results.length&&!badMedia.results.length&&!images.length&&Object.values(counts).every(c=>c.pass)&&[...integrity.results,...mediaIntegrity.results].every(r=>r.quick_check==='ok')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
 (async()=>{const snapshot=JSON.parse(readFileSync(arg('--input'),'utf8'));const target=await openTarget({remote:args.includes('--remote'),mainId:process.env.SEWAK_D1_ID,mediaId:process.env.SEWAK_MEDIA_D1_ID});try{const report=await validateMigration(snapshot,target);if(args.includes('--report'))writeFileSync(arg('--report'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({pass:report.pass,counts:report.counts,mismatches:report.mismatches.length,sourceWarnings:report.sourceWarnings.length,media:report.media}));if(!report.pass)process.exitCode=1;}finally{await target.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
}
