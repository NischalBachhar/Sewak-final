import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { entities, encodeRecord, insertSQL } from '../../worker/src/model.mjs';
import { createWorker } from '../../worker/src/index.ts';
import { PasswordHasher } from '../../worker/src/passwords.ts';

// Real SQLite semantics and BLOB values behind D1's small prepared-statement
// surface. Additional Miniflare tests cover actual workerd/D1 binding behavior.
export function sqliteD1() {
  const database = new DatabaseSync(':memory:'); database.exec('PRAGMA foreign_keys=ON');
  const adapter = {
    database,
    prepare(sql) {
      function statement(params = []) {
        const values = () => params.map((value)=>value instanceof ArrayBuffer ? new Uint8Array(value) : value);
        return { sql, params, bind(...bound) { return statement(bound); },
          async run() { const result = database.prepare(sql).run(...values()); return {success:true,meta:{changes:Number(result.changes)}}; },
          async all() { return {success:true,results:database.prepare(sql).all(...values())}; },
          async first() { return database.prepare(sql).get(...values()) || null; } };
      }
      return statement();
    },
    async batch(statements) {
      database.exec('BEGIN');
      try { const results=[]; for (const s of statements) results.push(await s.run()); database.exec('COMMIT'); return results; }
      catch(error) {database.exec('ROLLBACK'); throw error;}
    },
  };
  return adapter;
}
export function environment() {
  const DB=sqliteD1(),MEDIA_DB=sqliteD1();
  DB.database.exec(readFileSync(new URL('../../migrations/main/0001_sewak.sql',import.meta.url),'utf8'));
  DB.database.exec(readFileSync(new URL('../../migrations/main/0002_auth_state.sql',import.meta.url),'utf8'));
  DB.database.exec(readFileSync(new URL('../../migrations/main/0003_cloudflare_auth.sql',import.meta.url),'utf8'));
  MEDIA_DB.database.exec(readFileSync(new URL('../../migrations/media/0001_profile_images.sql',import.meta.url),'utf8'));
  return {DB,MEDIA_DB,AUTH_AUDIENCE:'sewak-test',PASSWORD_HASHER:{idFromName:x=>x,get:()=>({fetch:(url,init)=>new PasswordHasher().fetch(new Request(url,init))})},APP_WRITES_ENABLED:'true'};
}
export async function seed(env) {
  const records = {
    'users/customer':{uid:'customer',role:'user',name:'Test Customer',email:'customer@example.test',profileComplete:true,isSuspended:false},
    'users/other':{uid:'other',role:'user',name:'Other',email:'other@example.test',isSuspended:false},
    'users/admin':{uid:'admin',role:'superadmin',email:'admin@example.test',isSuspended:false},
    'users/org':{uid:'org',role:'orgadmin',name:'Organization',isSuspended:false},
    'users/caregiver':{uid:'caregiver',role:'caregiver',isSuspended:false},
    'organizations/org':{organizationId:'org',adminUid:'org',organizationName:'Test Organization',isApproved:true,verified:true,isSuspended:false,commissionRate:12.5},
    'services/care':{label:'Care',category:'caregiver',organizationId:'org',isActive:true},
    'vendors/caregiver':{uid:'caregiver',vendorId:'caregiver',name:'Test Caregiver',phone:'private-phone',email:'private@example.test',location:'Hetauda',category:'caregiver',workType:'parttime',shifts:['morning'],servicesOffered:['care'],hourlyRate:500,isAvailable:true,isApproved:true,isSuspended:false,isBlacklisted:false,organizationId:'org',organizationName:'Test Organization',bio:'Test bio',experience:3},
  };
  for(const [path,data] of Object.entries(records))await put(env,path,data);
  return records;
}
export async function put(env,path,data) { const [name,id]=path.split('/'); const q=insertSQL(name,encodeRecord(name,id,data),'upsert'); await env.DB.prepare(q.sql).bind(...q.params).run(); }
export const worker=createWorker(async request=>{
  const uid=request.headers.get('x-test-uid');
  return uid?{uid,email:`${uid}@example.test`,authTime:Date.now()/1000,claims:{}}:null;
});
export async function call(env,path,{uid,method='GET',json,body,type}={}) {
  const headers={...(uid?{'x-test-uid':uid}:{}),...(json?{'Content-Type':'application/json'}:type?{'Content-Type':type}:{})};
  const response=await worker.fetch(new Request(`http://localhost${path}`,{method,headers,...(json?{body:JSON.stringify(json)}:body?{body}: {})}),env);
  let data; if(response.headers.get('Content-Type')?.startsWith('application/json'))data=await response.json();
  return {response,status:response.status,data};
}
export const timestamp = {__op:'serverTimestamp'};
export function booking(id='customer_12345678-1234-1234-1234-123456789abc') {
  return {path:`bookings/${id}`,kind:'set',data:{
    schemaVersion:2,requestFingerprint:'a'.repeat(64),userId:'customer',userEmail:'customer@example.test',userName:'Test Customer',userPhone:'+9779800000000',careRecipient:'Test Recipient',address:'Test street 12',city:'Hetauda',careNeeds:'',notes:'',
    caregiverId:'caregiver',vendorId:'caregiver',organizationId:'org',organizationName:'Test Organization',caregiverName:'Test Caregiver',caregiverLocation:'Hetauda',caregiverWorkType:'parttime',caregiverCategory:'caregiver',caregiverShifts:['morning'],serviceId:'care',serviceLabel:'Care',
    date:'2090-01-01',time:'10:00',scheduleAt:'2090-01-01T04:15:00.000Z',durationHours:4,requestedTimeWindows:[],recurrence:'one_time',status:'pending',paymentMethod:'cash',paymentStatus:'pending',hourlyRate:500,commissionRate:12.5,totalAmount:2000,amountDue:2000,platformCommission:250,vendorEarnings:1750,createdAt:timestamp,
  }};
}
