import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {sqlStatements} from '../../scripts/sql-statements.mjs';
import {put} from './harness.mjs';
const require=createRequire(new URL('../../worker/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare'),{build}=require('esbuild'),sharp=require('sharp');
test('real workerd authenticates reviewers and atomically stores, decrypts, reviews and revokes encrypted D1 evidence',async()=>{
  const bundle=await build({entryPoints:['worker/src/index.ts'],bundle:true,format:'esm',platform:'browser',external:['node:*'],target:'es2022',write:false});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-01',compatibilityFlags:['nodejs_compat'],durableObjects:{PASSWORD_HASHER:{className:'PasswordHasher',useSQLite:true}},d1Databases:{DB:'verification-main',MEDIA_DB:'verification-media',EVIDENCE_DB:'verification-evidence'},bindings:{AUTH_AUDIENCE:'verification-test',APP_WRITES_ENABLED:'true',VERIFICATION_ENCRYPTION_KEY:Buffer.alloc(32,8).toString('base64url')}}));
  try {
    const DB=await mf.getD1Database('DB'),EVIDENCE_DB=await mf.getD1Database('EVIDENCE_DB');
    for(const file of ['0001_sewak','0002_auth_state','0003_cloudflare_auth','0004_catalog_onboarding','0006_secure_verification'])for(const sql of sqlStatements(readFileSync('migrations/main/'+file+'.sql','utf8')))await DB.prepare(sql).run();
    for(const sql of sqlStatements(readFileSync('migrations/evidence/0001_private_evidence.sql','utf8')))await EVIDENCE_DB.prepare(sql).run();
    const request=async(path,token,body,method='POST',type='application/json')=>{
      const r=await mf.dispatchFetch('http://localhost'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':type},...(method==='GET'?{}:{body:type==='application/json'?JSON.stringify(body):body})});
      return {r,data:r.headers.get('Content-Type')?.includes('application/json')?await r.clone().json():null};
    };
    const accounts=[];
    for(const role of ['caregiver','superadmin']){
      const {r,data}=await request('/api/auth/register',null,{email:role+'@example.test',password:'Local-workerd-only-password!',name:'Test '+role,sessionMode:'bearer'});assert.equal(r.status,200,JSON.stringify(data));accounts.push(data);
      await DB.prepare('UPDATE users SET role=?,version=version+1 WHERE id=?').bind(role,data.user.uid).run();
    }
    const [caregiver,admin]=accounts,uid=caregiver.user.uid;
    await put({DB},'vendors/'+uid,{uid,name:'Workerd Caregiver',phone:'+9779800000000',isApproved:true,category:'both',isAvailable:true});
    const photo=await sharp({create:{width:1400,height:1000,channels:3,background:'#dfe7dd'}}).webp().toBuffer();
    const uploaded=await request('/api/verification/evidence?kind=identity',caregiver.token,photo,'PUT','image/webp');assert.equal(uploaded.r.status,200,JSON.stringify(uploaded.data));
    const id=uploaded.data.id,row=await EVIDENCE_DB.prepare('SELECT typeof(ciphertext) type,length(ciphertext) size FROM evidence_blobs').first();assert.equal(row.type,'blob');assert.equal(row.size,photo.length+29);
    const preview=await request('/api/verification/evidence/'+id,admin.token,null,'GET');assert.equal(preview.r.status,200);assert.deepEqual(Buffer.from(await preview.r.arrayBuffer()),photo);
    assert.equal((await request('/api/verification/evidence/'+id,null,null,'GET')).r.status,401);
    const submitted=await request('/api/verification/submit/identity',caregiver.token,{version:0,requestId:crypto.randomUUID(),details:{legalName:'Private Name',documentType:'passport',documentNumber:'SECRET-ID'},evidenceIds:[id],consent:true,readable:true});assert.equal(submitted.r.status,200,JSON.stringify(submitted.data));
    for(const [version,decision]of [[1,'under_review'],[2,'verified']]){
      const result=await request('/api/verification/review/'+uid+'/identity',admin.token,{version,decision,confirmed:true,method:'manual_document_review',outcome:'Original document checked manually.'});assert.equal(result.r.status,200,JSON.stringify(result.data));
    }
    const stale=await request('/api/verification/review/'+uid+'/identity',admin.token,{version:2,decision:'rejected',reason:'Stale review must fail.',confirmed:true});assert.equal(stale.r.status,409);
    const deleted=await request('/api/verification/evidence/'+id,caregiver.token,{},'DELETE');assert.equal(deleted.r.status,200,JSON.stringify(deleted.data));
    assert.equal((await DB.prepare('SELECT status FROM verification_records').first()).status,'revoked');assert.equal((await EVIDENCE_DB.prepare('SELECT used_bytes FROM evidence_capacity').first()).used_bytes,0);
    assert.deepEqual((await DB.prepare('PRAGMA foreign_key_check').all()).results,[]);
  }finally{await mf.dispose();}
});
