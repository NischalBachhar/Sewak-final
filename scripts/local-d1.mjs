import {readFileSync,readdirSync} from 'node:fs';
import {openTarget} from './d1-target.mjs';
const target=await openTarget();
try{
 for(const [binding,directory]of [['DB','migrations/main'],['MEDIA_DB','migrations/media']]){
  for(const name of readdirSync(directory).filter(n=>n.endsWith('.sql')).sort()){
   const sentinels={ '0001_sewak.sql':'users', '0002_auth_state.sql':'auth_accounts', '0003_cloudflare_auth.sql':'cf_credentials', '0004_catalog_onboarding.sql':'organization_services', '0001_profile_images.sql':'media' };
   const table=sentinels[name];
   if(!table) throw new Error('Add an explicit migration completion check for '+name);
   const existing=await target[binding].prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first();
   if(existing){console.log(`${binding}: ${name} exists`);continue;}
   const statements=readFileSync(`${directory}/${name}`,'utf8').split(';').map(s=>s.trim()).filter(Boolean);
   for(const sql of statements)await target[binding].prepare(sql).run();
   console.log(`${binding}: ${name} applied`);
  }
 }
}finally{await target.close();}
