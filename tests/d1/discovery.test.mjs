import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { environment, seed, put, call, timestamp, booking } from './harness.mjs';
import { createWorker } from '../../worker/src/index.ts';
import { Repository } from '../../worker/src/repository.ts';

const organization = { selectedRole:'orgadmin', organizationName:'Synthetic Care', organizationType:'Caregiver Agency', businessPhone:'9800000000', businessAddress:'Test street 10', businessCity:'  Hetauda  ', servicesOffered:['catalog_elderly_care'] };
const password = 'Local-test-password-2026!';
const worker = createWorker();
async function auth(env, path, body, token) {
  const response = await worker.fetch(new Request('http://localhost/api/auth/'+path, { method:body?'POST':'GET', headers:{ ...(body?{'Content-Type':'application/json'}:{}), ...(token?{Authorization:'Bearer '+token}:{}) }, ...(body?{body:JSON.stringify(body)}:{}) }),env);
  return { status:response.status, data:await response.json() };
}
const signup = (env, role='user', extra={}) => auth(env,'register',{email:role+'@example.test',password,name:'Synthetic Owner',sessionMode:'bearer',selectedRole:role,...extra});
const commit = (env, uid, path, data) => call(env,'/api/commit',{uid,method:'POST',json:{writes:[{path,kind:'update',data}]}});
const search = (env, criteria={}, extra={}) => call(env,'/api/query',{method:'POST',json:{path:'publicCaregivers',search:criteria,...extra}});

test('organization registration is atomic, persists pending owner role across sessions and denies privilege escalation',async()=>{
  const env=environment(); await seed(env);
  const result=await signup(env,'orgadmin',organization); assert.equal(result.status,200,JSON.stringify(result.data));
  const {user,token}=result.data; assert.equal(user.role,'orgadmin'); assert.equal(user.profile.isApproved,false);
  const repo=new Repository(env), org=await repo.data('organizations/'+user.uid);
  assert.equal(org.adminUid,user.uid); assert.equal(org.businessCity,'Hetauda'); assert.deepEqual(org.servicesOffered,['catalog_elderly_care']);
  assert.equal((await repo.data('organizationApplications/'+user.uid)).status,'pending');
  assert.equal(env.DB.database.prepare('SELECT COUNT(*) n FROM organization_services WHERE organization_id=?').get(user.uid).n,1);
  assert.equal((await auth(env,'me',null,token)).data.user.role,'orgadmin');
  await auth(env,'logout',{},token);
  const login=await auth(env,'login',{email:'orgadmin@example.test',password,sessionMode:'bearer'});
  assert.equal(login.data.user.role,'orgadmin');
  assert.equal((await call(env,'/api/records/organizations/org',{uid:user.uid})).status,403);
  assert.equal((await commit(env,user.uid,'organizations/'+user.uid,{isApproved:true})).status,403);
  assert.equal((await commit(env,user.uid,'users/'+user.uid,{role:'superadmin'})).status,403);
  assert.equal((await call(env,'/api/actions/provisionCaregiverAccount',{uid:user.uid,method:'POST',json:{}})).status,403);
  assert.equal((await commit(env,user.uid,'organizations/'+user.uid,{businessCity:'  Tansen   Town ',profileComplete:true})).status,200);
  assert.equal((await new Repository(env).data('organizations/'+user.uid)).businessCity,'Tansen Town');
  assert.equal((await call(env,'/api/records/organizations/'+user.uid,{uid:'customer'})).status,403);
  assert.equal((await signup(env,'superadmin')).status,400);
  const customer=await signup(env); assert.equal(customer.data.user.role,'user');
  assert.equal((await auth(env,'complete-registration',{name:'Changed',...organization},customer.data.token)).status,403);
  assert.equal((await new Repository(env).data('users/'+customer.data.user.uid)).role,'user');
});

test('invalid organization fields create no partial identity, credential, session or application',async()=>{
  for(const invalid of [{organizationType:''},{organizationType:'Other',organizationTypeOther:''},{businessCity:'Other'},{businessCity:'<script>'},{servicesOffered:['missing']},{servicesOffered:['catalog_home_nursing']},{servicesOffered:'care'},{businessPhone:'x'}]) {
    const env=environment(); const result=await signup(env,'orgadmin',{...organization,...invalid}); assert.notEqual(result.status,200,JSON.stringify(invalid));
    for(const table of ['users','organizations','organization_applications','cf_credentials','cf_sessions']) assert.equal(env.DB.database.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0,table);
  }
});

test('catalog migration is rerunnable and preserves records and actual assignments; medical services stay closed',async()=>{
  const env=environment(); const originals=await seed(env);
  const migration=readFileSync(new URL('../../migrations/main/0004_catalog_onboarding.sql',import.meta.url),'utf8');
  env.DB.database.exec(migration); env.DB.database.exec(migration);
  const services=await call(env,'/api/query',{method:'POST',json:{path:'publicServices'}});
  assert.equal(services.data.items.filter(item=>item.id.startsWith('catalog_')).length,16);
  assert.ok(!services.data.items.some(item=>/nursing|wound|medication/.test(item.id)));
  assert.deepEqual((await new Repository(env).data('vendors/caregiver')),originals['vendors/caregiver']);
  assert.deepEqual(env.DB.database.prepare('SELECT service_id FROM caregiver_services WHERE caregiver_id=?').all('caregiver').map(r=>r.service_id),['care']);
  assert.equal((await commit(env,'admin','services/catalog_home_nursing',{isActive:true})).status,403);
  assert.equal((await commit(env,'caregiver','vendors/caregiver',{servicesOffered:['catalog_elderly_care','catalog_personal_care_assistance']})).status,200);
  assert.equal((await search(env,{serviceId:'catalog_elderly_care'})).data.total,1);
  assert.equal((await search(env,{serviceId:'catalog_housekeeping'})).data.total,0);
  assert.equal((await commit(env,'caregiver','vendors/caregiver',{category:'household'})).status,403);
  assert.equal((await commit(env,'caregiver','vendors/caregiver',{servicesOffered:[]})).status,200);
  assert.deepEqual((await call(env,'/api/records/publicCaregivers/caregiver')).data.items[0].data.servicesOffered,[]);
  assert.equal((await search(env,{serviceId:'catalog_elderly_care'})).data.total,0);
  assert.deepEqual(env.DB.database.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('verified rating uses matching completed bookings, raw average and eligible review counts',async()=>{
  const env=environment(); const data=await seed(env);
  for(const [id,rating,hidden,status,customer,verified] of [['one',5,false,'completed','customer',true],['two',3,false,'completed','customer',true],['hidden',1,true,'completed','customer',true],['pending',5,false,'pending','customer',true],['mismatch',5,false,'completed','other',true],['unverified',5,false,'completed','customer',false]]){
    await put(env,'bookings/'+id,{caregiverId:'caregiver',userId:'customer',status});
    await put(env,'reviews/'+id,{bookingId:id,caregiverId:'caregiver',customerId:customer,rating,isVerifiedReview:verified,isHidden:hidden});
  }
  await put(env,'vendors/unrated',{...data['vendors/caregiver'],uid:'unrated',vendorId:'unrated',rating:5,reviewCount:999});
  let result=await search(env,{minimumRating:4}); assert.equal(result.data.total,1);
  assert.equal(result.data.items[0].data.rating,4); assert.equal(result.data.items[0].data.reviewCount,2); assert.equal(result.data.items[0].data.jobsCompleted,5);
  assert.equal((await search(env,{minimumRating:5})).data.total,0);
  assert.equal((await search(env)).data.total,2);
  assert.equal((await call(env,'/api/query',{method:'POST',json:{path:'publicReviews'}})).data.items.length,2);
  await put(env,'reviews/two',{bookingId:'two',caregiverId:'caregiver',customerId:'customer',rating:5,isVerifiedReview:true});
  assert.equal((await search(env,{minimumRating:5})).data.total,1);
});

test('every discovery criterion combines in SQL with accurate count and stable pagination',async()=>{
  const env=environment(); const data=await seed(env);
  await commit(env,'caregiver','vendors/caregiver',{servicesOffered:['catalog_elderly_care'],location:'  Tansen   Town '});
  await commit(env,'admin','vendors/caregiver',{verified:true});
  for(let i=0;i<28;i++) await put(env,'vendors/page_'+String(i).padStart(2,'0'),{...data['vendors/caregiver'],name:'Other Person',location:'Kathmandu',experience:0,workType:'full_time',servicesOffered:[]});
  const criteria={text:'test',category:'caregiver',serviceId:'catalog_elderly_care',workType:'parttime',shift:'morning',location:'tansen town',minimumExperience:2,verifiedOnly:true};
  for(const [key,value] of Object.entries(criteria)){const result=await search(env,{[key]:value});assert.equal(result.status,200,JSON.stringify(result.data));assert.ok(result.data.items.some(item=>item.id==='caregiver'),key);}
  assert.equal((await search(env,criteria)).data.total,1);
  assert.equal((await search(env,{...criteria,location:'Pokhara'})).data.total,0);
  assert.equal((await search(env,{text:"' OR 1=1 --"})).data.total,0);
  let cursor, ids=[]; do {const page=await search(env,{}, {limit:7,...(cursor?{cursor}:{})});assert.equal(page.data.total,29);ids.push(...page.data.items.map(item=>item.id));cursor=page.data.nextCursor;}while(cursor);
  assert.equal(ids.length,29); assert.equal(new Set(ids).size,29);
  for(const city of ['Other','','<img src=x>','1234','A'.repeat(101),'Town\u0000City']) assert.equal((await commit(env,'customer','users/customer',{city})).status,400,city);
  assert.equal((await commit(env,'customer','users/customer',{city:'  Hetauda  '})).status,200);
  assert.equal((await new Repository(env).data('users/customer')).city,'Hetauda');
});

test('legacy applications repair only through audited admin approval; tenant and history boundaries remain',async()=>{
  const env=environment(); await seed(env);
  await put(env,'organizationApplications/other',{applicantId:'other',applicantName:'Legacy Applicant',applicantEmail:'other@example.test',organizationName:'Legacy Org',status:'pending'});
  assert.equal((await call(env,'/api/actions/approveOrganizationApplication',{uid:'customer',method:'POST',json:{applicationId:'other'}})).status,403);
  assert.equal((await call(env,'/api/actions/approveOrganizationApplication',{uid:'admin',method:'POST',json:{applicationId:'other'}})).status,200);
  assert.equal((await new Repository(env).data('users/other')).role,'orgadmin');
  assert.equal((await new Repository(env).data('users/customer')).role,'user');
  assert.equal(env.DB.database.prepare("SELECT COUNT(*) n FROM admin_audit_logs WHERE action='organization_approved'").get().n,1);
  assert.equal((await commit(env,'other','vendors/caregiver',{servicesOffered:[]})).status,403);
  assert.equal((await commit(env,'org','vendors/caregiver',{organizationId:'other'})).status,403);
  assert.equal((await call(env,'/api/commit',{uid:'customer',method:'POST',json:{writes:[booking()]}})).status,200);
  assert.equal((await call(env,'/api/query',{uid:'other',method:'POST',json:{path:'bookings'}})).data.items.length,0);
  assert.equal((await call(env,'/api/commit',{uid:'org',method:'POST',json:{writes:[{path:'vendors/caregiver',kind:'delete'}]}})).status,403);
});

test('twenty service assignments fit guarded D1 writes without dropping version protection',async()=>{
  const env=environment();await seed(env);
  const ids=Array.from({length:20},(_,i)=>'extra-'+i);
  for(const id of ids)await put(env,'services/'+id,{label:'Support '+id,category:'caregiver',isActive:true});
  const result=await commit(env,'caregiver','vendors/caregiver',{servicesOffered:ids});
  assert.equal(result.status,200,JSON.stringify(result.data));
  assert.equal(env.DB.database.prepare('SELECT COUNT(*) n FROM caregiver_services WHERE caregiver_id=?').get('caregiver').n,20);
  const registered=await signup(env,'orgadmin',{...organization,servicesOffered:ids});
  assert.equal(registered.status,200,JSON.stringify(registered.data));
  assert.equal((await commit(env,'admin','services/extra-0',{isActive:false})).status,403);
  const originalBatch=env.DB.batch.bind(env.DB);
  env.DB.batch=async statements=>{
    await env.DB.prepare("UPDATE services SET version=version+1 WHERE id='extra-0'").run();
    return originalBatch(statements);
  };
  assert.equal((await commit(env,'caregiver','vendors/caregiver',{servicesOffered:[...ids].reverse()})).status,409);
  assert.deepEqual((await new Repository(env).data('vendors/caregiver')).servicesOffered,ids);
});
