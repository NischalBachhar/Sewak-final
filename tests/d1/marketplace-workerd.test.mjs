import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {seed,booking} from './harness.mjs';
import {sqlStatements} from '../../scripts/sql-statements.mjs';
const require=createRequire(new URL('../../worker/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const {build}=require('esbuild');

test('actual workerd/D1 atomically rejects overlapping accepted care and persists private messaging and reminder consent',async()=>{
 // Synthetic identities are compiled only into this isolated test entry point.
 // Real credential/session enforcement is covered by workerd.test and live Auth QA.
 const bundle=await build({stdin:{contents:`import {createWorker} from './worker/src/index.ts';
 export default createWorker(async request=>{const uid=request.headers.get('x-test-uid');return uid?{uid,email:uid+'@example.test',authTime:Date.now()/1000,claims:{}}:null;});`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',external:['node:*'],target:'es2022',write:false});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'marketplace-workerd'},bindings:{APP_WRITES_ENABLED:'true'}}));
 try{
   const DB=await mf.getD1Database('DB');
   for(const name of readdirSync('migrations/main').filter(n=>n.endsWith('.sql')).sort())for(const sql of sqlStatements(readFileSync('migrations/main/'+name,'utf8')))await DB.prepare(sql).run();
   await seed({DB});
   const request=async(path,uid,json)=>{
     const r=await mf.dispatchFetch('http://localhost'+path,{method:json?'POST':'GET',headers:{...(uid?{'x-test-uid':uid}:{}),...(json?{'Content-Type':'application/json'}:{})},...(json?{body:JSON.stringify(json)}:{})});
     return {status:r.status,data:await r.json()};
   };
   const first=booking();
   assert.equal((await request('/api/commit','customer',{writes:[first]})).status,200);
   assert.equal((await request('/api/commit','caregiver',{writes:[{kind:'update',path:first.path,data:{status:'accepted',updatedAt:{__op:'serverTimestamp'}}}]})).status,200);
   const second=booking('customer_22345678-1234-1234-1234-123456789abc');
   second.data.time='11:00';second.data.scheduleAt='2090-01-01T05:15:00.000Z';
   assert.equal((await request('/api/commit','customer',{writes:[second]})).status,409);
   assert.equal((await DB.prepare('SELECT COUNT(*) n FROM bookings').first()).n,1);
   assert.equal((await request('/api/care-notifications','customer',{action:'preferences',bookingReminders:false})).status,200);
   assert.equal((await request('/api/care-notifications','customer')).data.preferences.bookingReminders,false);
   const id=first.path.split('/')[1];
   assert.equal((await request('/api/care-messages','customer',{kind:'booking',contextId:id,body:'Synthetic care coordination'})).status,200);
   const messages=await request('/api/care-messages?kind=booking&contextId='+id,'caregiver');
   assert.equal(messages.status,200);assert.equal(messages.data.messages.length,1);
   assert.equal((await request('/api/care-messages?kind=booking&contextId='+id,'other')).status,404);
   assert.deepEqual((await DB.prepare('PRAGMA foreign_key_check').all()).results,[]);
 }finally{await mf.dispose();}
});
