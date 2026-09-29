import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cloudflare,assertFreeAccount} from './cloudflare-operator.mjs';
import {openTarget} from './d1-target.mjs';
const staging=process.argv.includes('--staging');
const configFile=staging?'wrangler.toml':'wrangler.production.toml';
const names=staging?['sewak-staging-db','sewak-staging-media']:['sewak-db','sewak-media'];
const config=readFileSync(configFile,'utf8');const account=config.match(/^account_id\s*=\s*"([^"]+)"/m)?.[1];
if(!account||account!==process.env.CLOUDFLARE_ACCOUNT_ID)throw new Error('Set CLOUDFLARE_ACCOUNT_ID to the exact Sewak account pinned in wrangler.toml.');
const apply=process.argv.includes('--apply');
if(!apply){console.log(JSON.stringify({dryRun:true,account,databases:names,writesEnabled:false}));process.exit(0);}
const plan=await assertFreeAccount(account,{attested:process.argv.includes('--free-plan-confirmed')});
const existing=await cloudflare(`/accounts/${account}/d1/database`);const ids={};
for(const name of names){
 let database=existing.find(db=>db.name===name);
 if(!database)database=await cloudflare(`/accounts/${account}/d1/database`,{method:'POST',json:{name}});
 ids[name]=database.uuid;
}
let updated=config;
for(const [name,id]of Object.entries(ids)){
 if(!id)throw new Error(`Cloudflare did not return an ID for ${name}.`);
 updated=updated.replace(new RegExp(`(database_name = "${name}"\\s+database_id = ")[^"]+(")`),(_match,prefix,suffix)=>`${prefix}${id}${suffix}`);
}
writeFileSync(configFile,updated);
const target=await openTarget({remote:true,mainId:ids[names[0]],mediaId:ids[names[1]]});
try{
 for(const [binding,directory]of [['DB','migrations/main'],['MEDIA_DB','migrations/media']]){
  const db=target[binding];
  await db.prepare('CREATE TABLE IF NOT EXISTS sewak_schema_migrations(name TEXT PRIMARY KEY,hash TEXT NOT NULL,next_statement INTEGER NOT NULL,applied_at TEXT)').run();
  for(const name of readdirSync(directory).filter(n=>n.endsWith('.sql')).sort()){
   const sql=readFileSync(`${directory}/${name}`,'utf8'),hash=createHash('sha256').update(sql).digest('hex');
   const journal=await db.prepare('SELECT hash,next_statement,applied_at FROM sewak_schema_migrations WHERE name=?').bind(name).first();
   if(journal&&journal.hash!==hash)throw new Error(`Applied migration changed: ${binding}/${name}. Add a new migration instead.`);
   if(journal?.applied_at)continue;
   await db.prepare('INSERT INTO sewak_schema_migrations(name,hash,next_statement) VALUES(?,?,0) ON CONFLICT(name) DO NOTHING').bind(name,hash).run();
   const statements=sql.split(';').map(s=>s.trim()).filter(Boolean);
   for(let i=journal?.next_statement||0;i<statements.length;i++){
    // These schema files contain additive CREATE statements. IF NOT EXISTS
    // makes a crash after creation/before journal update safely restartable.
    const statement=statements[i].replace(/CREATE TABLE (?!IF NOT EXISTS)/g,'CREATE TABLE IF NOT EXISTS ').replace(/CREATE INDEX (?!IF NOT EXISTS)/g,'CREATE INDEX IF NOT EXISTS ');
    await db.prepare(statement).run();
    await db.prepare('UPDATE sewak_schema_migrations SET next_statement=? WHERE name=?').bind(i+1,name).run();
   }
   await db.prepare('UPDATE sewak_schema_migrations SET applied_at=? WHERE name=?').bind(new Date().toISOString(),name).run();
   console.log(`${binding}: ${name} applied`);
  }
 }
 mkdirSync('.local-tools/d1-migration',{recursive:true});
 writeFileSync(`.local-tools/d1-migration/cloudflare-${staging?'staging':'production'}-resources.json`,JSON.stringify({account,ids,plan,createdAt:new Date().toISOString()},null,2));
 console.log(JSON.stringify({account,ids,plan}));
}finally{await target.close();}
