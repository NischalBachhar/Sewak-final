import {createHash} from 'node:crypto';
// Compare every preexisting column across additive ALTER migrations. Newly
// introduced nullable/default columns are schema changes, not record edits.
export async function applicationColumns(rows,tables){
 const columns={};
 for(const table of tables.filter(t=>!t.startsWith('_')&&!['sewak_schema_migrations','d1_migrations','sqlite_sequence','cf_sessions','cf_auth_limits'].includes(t)).sort()){
  if(!/^[a-z_]+$/.test(table))throw new Error('Invalid application table');
  columns[table]=(await rows('PRAGMA table_info('+table+')')).map(r=>r.name);
  if(columns[table].some(c=>!/^[a-z_]+$/.test(c)))throw new Error('Invalid application column');
 }
 return columns;
}
export async function snapshotRecords(rows,columns){
 const result={};
 for(const [table,names] of Object.entries(columns)){
  const data=await rows('SELECT '+names.map(n=>'"'+n+'"').join(',')+' FROM '+table+' ORDER BY rowid');
  result[table]={count:data.length,sha256:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
 }
 return result;
}
