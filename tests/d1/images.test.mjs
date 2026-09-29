import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {inspectImage} from '../../worker/src/image-validation.mjs';
import {stripImageMetadata} from '../../src/profileImageMetadata.mjs';
const require=createRequire(new URL('../../worker/package.json',import.meta.url));const sharp=require('sharp');
test('image validation accepts bounded encodings and rejects appended content',async()=>{
 const source=await sharp({create:{width:1800,height:900,channels:3,background:'#947166'}}).jpeg().withMetadata().toBuffer();
 const webp=await sharp(source).resize(512,256).webp().toBuffer();assert.equal(inspectImage(webp,'image/webp').width,512);assert.ok(webp.length<200000);
 const jpeg=await sharp(source).resize(512,256).jpeg().toBuffer();assert.equal(inspectImage(jpeg,'image/jpeg').width,512);
 assert.throws(()=>inspectImage(Buffer.concat([jpeg,Buffer.from('<script>')]),'image/jpeg'));
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
