import {SEWAK_ACCOUNT,targets} from './deployment-policy.mjs';
import {migrationPlan} from './marketplace-migration-plan.mjs';

export async function assertMarketplaceReady(worker,cloudflare){
 if(worker!=='sewak-final')return;
 const path=`/accounts/${SEWAK_ACCOUNT}/d1/database/${targets[worker].DB[1]}/query`;
 const query=async sql=>(await cloudflare(path,{method:'POST',json:{sql,params:[]}}))[0].results;
 const tables=(await query("SELECT name FROM sqlite_master WHERE type='table'")).map(r=>r.name);
 const journal=await query('SELECT name,hash,applied_at FROM sewak_schema_migrations');
 const missing=migrationPlan({tables,journal}).filter(m=>!m.applied);
 if(missing.length)throw new Error('Production marketplace migrations must pass before upload: '+missing.map(m=>m.name).join(', '));
}
