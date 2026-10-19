import {Repository,requireAdmin} from './repository.ts';
import {badInput,type Actor,type Data} from './types.ts';

export async function adminOperationsRoute(url:URL,repo:Repository,actor:Actor|null){
 requireAdmin(actor);
 const cursor=url.searchParams.get('cursor')||'';
 badInput(cursor.length<=300,'Invalid page cursor.');
 if(url.pathname==='/api/admin/accounts'){
   badInput(!cursor||/^[A-Za-z0-9_-]{1,160}$/.test(cursor),'Invalid account cursor.');
   const rows=await repo.env.DB.prepare(`SELECT id,name,email,role,is_suspended AS isSuspended,is_blacklisted AS isBlacklisted,
     json_extract(extra_json,'$.deletedAt') AS deletedAt FROM users WHERE role IN ('user','caregiver') AND id>? ORDER BY id LIMIT 26`)
     .bind(cursor).all<Data>();
   return {items:rows.results.slice(0,25),nextCursor:rows.results.length>25?rows.results[24].id:null};
 }
 let after:string[]= [];
 if(cursor){
   try{after=JSON.parse(atob(cursor));}catch{badInput(false,'Invalid audit cursor.');}
   badInput(Array.isArray(after)&&after.length===2&&after.every(v=>typeof v==='string'&&v.length<=160),'Invalid audit cursor.');
 }
 const rows=await repo.env.DB.prepare(`SELECT id,action,actor_uid AS actorUid,target_uid AS targetUid,target_id AS targetId,
   target_type AS targetType,organization_id AS organizationId,created_at AS createdAt FROM admin_audit_logs
   WHERE created_at IS NOT NULL ${after.length?'AND (created_at<? OR (created_at=? AND id<?))':''}
   ORDER BY created_at DESC,id DESC LIMIT 26`).bind(...(after.length?[after[0],after[0],after[1]]:[])).all<Data>();
 const last=rows.results[24];
 return {items:rows.results.slice(0,25),nextCursor:rows.results.length>25?btoa(JSON.stringify([last.createdAt,last.id])):null};
}
