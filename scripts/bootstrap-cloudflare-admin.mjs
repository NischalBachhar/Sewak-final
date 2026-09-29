import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {openTarget} from './d1-target.mjs';
const worker=process.argv[process.argv.indexOf('--worker')+1],output=process.argv[process.argv.indexOf('--output')+1];
assert.equal(worker,'sewak-final','Real-owner bootstrap is production-only');assert.ok(process.argv.includes('--apply'));assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,'860970f755498a4fe10e16c2fa99ce55');
assert.ok(output&&resolve(output).startsWith(resolve('.local-tools')+sep),'Output must be inside ignored local operator artifacts');assert.ok(!existsSync(output),'Never overwrite a bootstrap delivery artifact');
const config=readFileSync('wrangler.production.toml','utf8'),ids=[...config.matchAll(/^database_id = "([^"]+)"/gm)].map(m=>m[1]);assert.deepEqual(ids,['36fa1df1-aa5d-43a1-ad0e-a4e310c513c3','c3721e25-4fb2-4a0d-b350-518ec9abbea2']);
const target=await openTarget({remote:true,mainId:ids[0],mediaId:ids[1]}),{DB}=target,email='nischalbachhar9@gmail.com';
try{
 assert.equal(await DB.prepare('SELECT id FROM cf_bootstrap').first(),null,'Existing bootstrap must be investigated, not overwritten');assert.equal(await DB.prepare('SELECT user_id FROM cf_credentials WHERE email=?').bind(email).first(),null,'Owner already has an account; do not replace credentials');
 const token='swk_'+randomBytes(32).toString('base64url'),digest=createHash('sha256').update(token).digest('hex'),expires=Math.floor(Date.now()/1000)+86400,guard='bootstrap-operator-'+randomBytes(16).toString('hex');
 await DB.batch([DB.prepare("INSERT INTO commit_guards(id,valid) VALUES(?,NOT EXISTS(SELECT 1 FROM cf_credentials c JOIN users u ON u.id=c.user_id WHERE c.disabled=0 AND u.role='superadmin'))").bind(guard),DB.prepare('INSERT INTO cf_bootstrap(id,email,token_hash,expires_at) VALUES(1,?,?,?)').bind(email,digest,expires),DB.prepare('DELETE FROM commit_guards WHERE id=?').bind(guard)]);
 assert.equal((await DB.prepare('SELECT token_hash FROM cf_bootstrap WHERE id=1').first()).token_hash,digest);
 mkdirSync('.local-tools',{recursive:true});writeFileSync(output,`One-time Sewak owner setup for ${email}\nExpires: ${new Date(expires*1000).toISOString()}\nChoose your password on the page. Do not share this link.\n\nhttps://sewak-final.nischalbachhar9.workers.dev/account/setup?mode=bootstrap#token=${token}\n`,{flag:'wx',mode:0o600});
 console.log(JSON.stringify({worker,email,expiresAt:new Date(expires*1000).toISOString(),deliveryFile:output,hashVerified:true,privateTokenPrinted:false}));
}finally{await target.close();}
