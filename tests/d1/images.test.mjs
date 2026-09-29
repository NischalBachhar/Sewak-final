import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {discoverImages,compressImage} from '../../scripts/firebase-to-d1/images.mjs';
import {inspectImage} from '../../worker/src/image-validation.mjs';
import {stripImageMetadata} from '../../src/profileImageMetadata.mjs';
import {importProfileImage} from '../../worker/src/migration.ts';
import {environment,seed} from './harness.mjs';
const require=createRequire(new URL('../../worker/package.json',import.meta.url));const sharp=require('sharp');
test('profile discovery reports conflicting aliases and Auth-only missing owners',()=>{
 const result=discoverImages({documents:{'users/a':{profilePicture:'https://one',photoURL:'https://two'}},authUsers:[{uid:'orphan',photoURL:'https://photo'}]});
 assert.equal(result.discoveredOwners,2);assert.equal(result.failures.length,2);assert.equal(result.images.length,0);
});
test('offline compression resizes and strips metadata; both accepted encodings are inspected',async()=>{
 const source=await sharp({create:{width:1800,height:900,channels:3,background:'#947166'}}).jpeg().withMetadata().toBuffer();
 const result=await compressImage(source);assert.equal(result.info.width,512);assert.equal(result.info.height,256);assert.ok(result.info.size<200000);
 const jpeg=await sharp(source).resize(512,256).jpeg().toBuffer();assert.equal(inspectImage(jpeg,'image/jpeg').width,512);
 assert.throws(()=>inspectImage(Buffer.concat([jpeg,Buffer.from('<script>')]),'image/jpeg'));
});
test('temporary migration upload is unavailable after application writes open',async()=>{
 const env=environment();await seed(env);env.MIGRATION_ENABLED='true';env.MIGRATION_TOKEN='a'.repeat(64);
 await assert.rejects(importProfileImage(new Request('http://localhost',{method:'PUT',headers:{'X-Sewak-Migration-Token':env.MIGRATION_TOKEN},body:'x'}),env,'customer'),error=>error.status===404);
});
test('browser metadata stripping retains decodable image pixels without ICC/EXIF attachments',async()=>{
 for(const mime of ['image/webp','image/jpeg']){
  const source=sharp({create:{width:512,height:288,channels:3,background:'#b68164'}}).withMetadata();
  const binary=await (mime==='image/webp'?source.webp():source.jpeg()).toBuffer();
  assert.throws(()=>inspectImage(binary,mime));
  const clean=stripImageMetadata(binary,mime);assert.equal(inspectImage(clean,mime).width,512);
  const decoded=await sharp(clean).raw().toBuffer({resolveWithObject:true});assert.equal(decoded.info.width,512);assert.equal(decoded.info.height,288);assert.ok(clean.length<binary.length);
 }
});
