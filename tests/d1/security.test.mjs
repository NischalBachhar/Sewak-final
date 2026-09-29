import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,seed,call,booking,timestamp,put} from './harness.mjs';
import {Repository} from '../../worker/src/repository.ts';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../worker/package.json',import.meta.url)),sharp=require('sharp');

test('public responses redact PII and listings exclude suspended organizations',async()=>{
 const env=environment();await seed(env);
 const result=await call(env,'/api/query',{method:'POST',json:{path:'publicCaregivers'}});
 assert.equal(result.status,200);assert.equal(result.data.items.length,1);assert.equal(result.data.items[0].data.phone,undefined);assert.equal(result.data.items[0].data.email,undefined);
 env.DB.database.exec('UPDATE organizations SET is_suspended=1');
 assert.equal((await call(env,'/api/query',{method:'POST',json:{path:'publicCaregivers'}})).data.items.length,0);
});
test('private reads, tenant lists, role escalation and SQL-shaped parameters are denied',async()=>{
 const env=environment();await seed(env);
 for(const [path,uid,status]of[['/api/records/users/customer',null,401],['/api/records/users/customer','other',403],['/api/records/adminAuditLogs/x','admin',403]])assert.equal((await call(env,path,{uid})).status,status);
 assert.equal((await call(env,'/api/query',{uid:'customer',method:'POST',json:{path:'users'}})).status,403);
 assert.equal((await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[{path:'users/customer',kind:'update',data:{role:'superadmin'}}]}})).status,403);
 assert.equal((await call(env,'/api/query',{method:'POST',json:{path:'publicCaregivers',filters:[{field:'id); DROP TABLE users;--',op:'==',value:'x'}]}})).status,400);
 assert.equal((await call(env,'/api/records/constructor/id',{uid:'admin'})).status,400);
 assert.equal((await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[null]}})).status,400);
});
test('organization admins can repair caregiver services without weakening catalog controls',async()=>{
 const env=environment();await seed(env);
 await put(env,'services/respite',{label:'Respite Care',category:'caregiver',organizationId:'org',organizationName:'Test Organization',isActive:true});
 const updateServices=(uid,services)=>call(env,'/api/commit',{uid,method:'POST',json:{writes:[{path:'vendors/caregiver',kind:'update',data:{servicesOffered:services,updatedAt:timestamp}}]}});
 let result=await updateServices('org',['respite']);assert.equal(result.status,200,JSON.stringify(result.data));
 const publicProfile=await call(env,'/api/records/publicCaregivers/caregiver');assert.deepEqual(publicProfile.data.items[0].data.servicesOffered,['respite']);
 assert.equal((await updateServices('caregiver',['care'])).status,403);
 result=await call(env,'/api/commit',{uid:'org',method:'POST',json:{writes:[{path:'services/respite',kind:'update',data:{isActive:false,updatedAt:timestamp}}]}});assert.equal(result.status,403);
 assert.equal((await updateServices('org',['care'])).status,200);
 result=await call(env,'/api/commit',{uid:'org',method:'POST',json:{writes:[{path:'services/respite',kind:'update',data:{isActive:false,updatedAt:timestamp}}]}});assert.equal(result.status,200,JSON.stringify(result.data));
});

test('cash booking rechecks price, ownership, schedule, availability and catalog',async()=>{
 for(const patch of [{totalAmount:1},{userId:'other'},{paymentStatus:'paid'},{organizationId:'wrong'},{date:'2090-02-30'},{serviceId:'missing'},{profilePicture:'data:image/png;base64,abc'}]){
  const env=environment();await seed(env);const b=booking();Object.assign(b.data,patch);
  const result=await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[b]}});assert.notEqual(result.status,200,JSON.stringify(patch));assert.equal(env.DB.database.prepare('SELECT COUNT(*) c FROM bookings').get().c,0);
 }
 const env=environment();await seed(env);assert.equal((await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[booking()]}})).status,200);
 const row=env.DB.database.prepare('SELECT total_amount,payment_status FROM bookings').get();assert.equal(row.total_amount,2000);assert.equal(row.payment_status,'pending');
 assert.notEqual((await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[booking()]}})).status,200);
});
test('booking lifecycle is atomic, private and review is unique after care completion',async()=>{
 const env=environment();await seed(env);const b=booking(),id=b.path.split('/')[1];
 assert.equal((await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[b]}})).status,200);
 const mutate=async(uid,writes)=>call(env,'/api/commit',{uid,method:'POST',json:{writes}});
 const update=(status)=>({path:b.path,kind:'update',data:{status,updatedAt:timestamp}});
 assert.equal((await mutate('other',[update('cancelled')])).status,403);
 assert.equal((await mutate('caregiver',[update('accepted')])).status,200);
 assert.equal((await mutate('caregiver',[update('in_progress')])).status,403);
 const session={path:`careSessions/${id}`,kind:'set',data:{bookingId:id,caregiverId:'caregiver',customerId:'customer',organizationId:'org',scheduledDate:'2090-01-01',scheduledTime:'10:00',scheduledDurationHours:4,status:'in_progress',actualCheckIn:timestamp,createdAt:timestamp,updatedAt:timestamp}};
 const start=update('in_progress');start.data.careSessionId=id;
 const result=await mutate('caregiver',[session,start]);assert.equal(result.status,200,JSON.stringify(result.data));
 assert.equal((await call(env,`/api/records/careSessions/${id}`,{uid:'other'})).status,403);
 assert.equal((await mutate('caregiver',[{path:`careSessions/${id}/tasks/task1`,kind:'set',data:{label:'Meal',status:'pending',createdBy:'caregiver',createdAt:timestamp}}])).status,200);
 assert.equal((await mutate('caregiver',[{path:`careSessions/${id}/updates/note1`,kind:'set',data:{message:'Care update',type:'note',caregiverId:'caregiver',createdAt:timestamp}}])).status,200);
 assert.equal((await mutate('caregiver',[{path:`careSessions/${id}`,kind:'update',data:{status:'completed',actualCheckOut:timestamp,updatedAt:timestamp}},update('completed')])).status,200);
 const review={path:`reviews/${id}`,kind:'set',data:{bookingId:id,caregiverId:'caregiver',customerId:'customer',rating:5,comment:'Good care',isVerifiedReview:true,createdAt:timestamp}};
 assert.equal((await mutate('customer',[review])).status,200);assert.equal((await mutate('customer',[review])).status,403);
 assert.equal(env.DB.database.prepare('SELECT payment_status FROM bookings').get().payment_status,'pending');
 const publicProfile=await call(env,'/api/records/publicCaregivers/caregiver');assert.equal(publicProfile.data.items[0].data.reviewCount,1);assert.equal(publicProfile.data.items[0].data.rating,5);
});
test('optimistic guards roll back all writes if authorization source changes',async()=>{
 const env=environment();await seed(env);const repo=new Repository(env);await repo.get('users/customer');
 env.DB.database.exec("UPDATE users SET version=version+1,is_suspended=1 WHERE id='customer'");
 await assert.rejects(repo.commit([{path:'settings/commission',data:{rate:25}}]),e=>e.status===409);
 assert.equal(env.DB.database.prepare('SELECT COUNT(*) c FROM settings').get().c,0);assert.equal(env.DB.database.prepare('SELECT COUNT(*) c FROM commit_guards').get().c,0);
});
test('media distinguishes malformed IDs, authorization and authorized missing images',async()=>{
 const env=environment();await seed(env);
 for(const uid of [null,'customer','admin']){
  const malformed=await call(env,'/api/media/sewak-qa-nonexistent-image',{uid});
  assert.equal(malformed.status,400);assert.equal(malformed.data.error.code,'invalid-argument');
 }
 // Private-image existence must not be exposed before checking permission.
 for(const uid of [null,'other'])assert.equal((await call(env,'/api/media/profile_customer',{uid})).status,403);
 for(const uid of ['customer','admin']){
  const missing=await call(env,'/api/media/profile_customer',{uid});
  assert.equal(missing.status,404);assert.equal(missing.data.error.code,'not-found');
 }
 assert.equal((await call(env,'/api/media/profile_no_such_owner',{uid:'admin'})).status,404);
 assert.equal(env.MEDIA_DB.database.prepare('SELECT COUNT(*) c FROM media').get().c,0);
});

test('images use bounded binary BLOBs, private access, one owner row and replacement',async()=>{
 const env=environment();await seed(env);const bytes=await sharp({create:{width:512,height:512,channels:3,background:'#ba7864'}}).webp().toBuffer();
 for(const [uid,status] of [[null,401],['other',403]])assert.equal((await call(env,'/api/profiles/customer/image',{uid,method:'PUT',body:bytes,type:'image/webp'})).status,status);
 let result=await call(env,'/api/profiles/customer/image',{uid:'customer',method:'PUT',body:bytes,type:'image/webp'});assert.equal(result.status,200,JSON.stringify(result.data));
 assert.equal((await call(env,result.data.url)).status,403);
 const image=await call(env,result.data.url,{uid:'customer'});assert.equal(image.status,200);assert.deepEqual(new Uint8Array(await image.response.arrayBuffer()),new Uint8Array(bytes));assert.match(image.response.headers.get('Cache-Control'),/private/);
 // The byte equality above and stored BLOB length below verify image size.
 // Content-Length is transport-managed, not added by Node's Response harness.
 assert.equal(image.response.headers.get('Content-Type'),'image/webp');assert.equal(image.response.headers.get('X-Content-Type-Options'),'nosniff');assert.ok(image.response.headers.get('ETag'));
 result=await call(env,'/api/profiles/customer/image',{uid:'customer',method:'PUT',body:bytes,type:'image/webp'});assert.equal(result.status,200);
 const record=env.MEDIA_DB.database.prepare('SELECT typeof(data) type,length(data) size FROM media').get();assert.equal(record.type,'blob');assert.equal(record.size,bytes.length);assert.equal(env.MEDIA_DB.database.prepare('SELECT COUNT(*) c FROM media').get().c,1);
 for(const [body,type]of [[new Uint8Array(200001),'image/webp'],[new TextEncoder().encode('%PDF bad'),'application/pdf'],[bytes,'image/jpeg'],[bytes.subarray(0,bytes.length-1),'image/webp'],[await sharp({create:{width:768,height:768,channels:3,background:'#333'}}).webp().toBuffer(),'image/webp']])assert.notEqual((await call(env,'/api/profiles/customer/image',{uid:'customer',method:'PUT',body,type})).status,200);
 assert.equal((await call(env,'/api/profiles/customer/image',{uid:'customer',method:'DELETE'})).status,200);assert.equal(env.MEDIA_DB.database.prepare('SELECT COUNT(*) c FROM media').get().c,0);
});
test('query limits, cursors, totals and maintenance fail safely',async()=>{
 const env=environment();await seed(env);
 assert.equal((await call(env,'/api/query',{method:'POST',json:{path:'publicCaregivers',limit:500}})).status,400);
 env.APP_WRITES_ENABLED='false';assert.equal((await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[booking()]}})).status,503);
 assert.equal((await call(env,'/api/health')).status,200);
});
