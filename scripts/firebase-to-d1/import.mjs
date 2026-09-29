import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { entities, insertSQL } from '../../worker/src/model.mjs';
import { migrationPlan } from './transform.mjs';
import { openTarget } from '../d1-target.mjs';

export async function importSnapshot(snapshot, target, { apply = false } = {}) {
  const plan = migrationPlan(snapshot);
  const report = { sourceCount:plan.sourceCount,planned:plan.records.length,failures:plan.failures,warnings:plan.warnings,inserted:0,updated:0,unchanged:0,dryRun:!apply };
  if (plan.failures.length || !apply) return report;
  for (const user of snapshot.authUsers || []) {
    await target.DB.prepare('INSERT INTO auth_accounts(uid,disabled,valid_since,imported_at) VALUES(?,?,?,?) ON CONFLICT(uid) DO UPDATE SET disabled=excluded.disabled,valid_since=excluded.valid_since,imported_at=excluded.imported_at').bind(user.uid,Number(user.disabled),Number(user.validSince)||0,snapshot.exportedAt).run();
  }
  // Insert skeletons with deferred relation columns empty, then fill exact
  // records after all target IDs exist. This handles the user/org cycle with
  // small restartable requests; writes stay disabled throughout import.
  for (const record of plan.records) {
    const current = await target.DB.prepare('SELECT source_hash FROM migration_records WHERE source_path=?').bind(record.path).first();
    if (current?.source_hash === record.hash) { report.unchanged++; continue; }
    const exists = await target.DB.prepare(`SELECT id,version FROM ${entities[record.name].table} WHERE id=?`).bind(record.key).first();
    if (exists && !current) throw new Error(`Refusing to overwrite a non-migration record: ${record.path}`);
    if (exists && exists.version !== 1) throw new Error(`Record was modified in D1 after import: ${record.path}. Reconcile instead of overwriting.`);
    if (!exists) {
      // Reserve before inserting. A crash at either step resumes from this
      // pending journal entry without adopting unrelated D1 rows.
      await target.DB.prepare('INSERT INTO migration_records(source_path,source_hash,migrated_at) VALUES(?,?,?) ON CONFLICT(source_path) DO NOTHING').bind(record.path,`pending:${record.hash}`,new Date().toISOString()).run();
      const skeleton = {id:record.key,version:1,fields_present:'[]',extra_json:'{}'};
      const q=insertSQL(record.name,skeleton);
      await target.DB.prepare(q.sql).bind(...q.params).run(); report.inserted++;
    } else report.updated++;
  }
  for (const record of plan.records) {
    const current=await target.DB.prepare('SELECT source_hash FROM migration_records WHERE source_path=?').bind(record.path).first();
    if(current?.source_hash===record.hash)continue;
    const q=insertSQL(record.name,record.encoded,'upsert');
    await target.DB.prepare(q.sql).bind(...q.params).run();
    if (record.name === 'vendors') {
      await target.DB.prepare('DELETE FROM caregiver_services WHERE caregiver_id=?').bind(record.key).run();
      if (record.data.servicesOffered?.length) await target.DB.prepare('INSERT INTO caregiver_services(caregiver_id,service_id) SELECT ?,value FROM json_each(?)').bind(record.key,JSON.stringify(record.data.servicesOffered)).run();
    }
    await target.DB.prepare('INSERT INTO migration_records(source_path,source_hash,migrated_at) VALUES(?,?,?) ON CONFLICT(source_path) DO UPDATE SET source_hash=excluded.source_hash,migrated_at=excluded.migrated_at').bind(record.path,record.hash,new Date().toISOString()).run();
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args=process.argv.slice(2), arg=(key)=>args[args.indexOf(key)+1];
  (async()=>{
    const snapshot=JSON.parse(readFileSync(arg('--input'),'utf8'));
    const apply=args.includes('--apply');
    const target=apply?await openTarget({remote:args.includes('--remote'),mainId:process.env.SEWAK_D1_ID,mediaId:process.env.SEWAK_MEDIA_D1_ID}):null;
    try{
      const report=await importSnapshot(snapshot,target,{apply});
      if(args.includes('--report'))writeFileSync(arg('--report'),JSON.stringify(report,null,2),{mode:0o600});
      console.log(JSON.stringify({...report,warnings:report.warnings.length,failures:report.failures.length}));
      if(report.failures.length)process.exitCode=1;
    }finally{await target?.close();}
  })().catch(error=>{console.error(error.message);process.exitCode=1;});
}
