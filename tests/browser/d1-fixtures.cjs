if(!process.env.SEWAK_E2E_TOKEN||process.env.SEWAK_LOCAL_TESTS!=='true')throw new Error('D1 fixtures require the isolated local test runner.');
async function call(command){const response=await fetch('http://127.0.0.1:4173/__test__/db',{method:'POST',headers:{'Content-Type':'application/json','X-Sewak-E2e-Token':process.env.SEWAK_E2E_TOKEN},body:JSON.stringify(command)});if(!response.ok)throw new Error(`Fixture request failed: ${response.status}`);return response.json();}
const snap=row=>({id:row.id,data:()=>row.data,exists:!!row.data});
const doc=path=>({path,async get(){return snap(await call({path,op:'get'}));},set:data=>call({path,op:'set',data}),update:data=>call({path,op:'update',data})});
const collection=(path,count)=>({async get(){const docs=(await call({path,op:'get',limit:count})).map(snap);return {docs,size:docs.length};},limit:n=>collection(path,n)});
const db={doc,collection,batch(){const writes=[];return {set(ref,data){writes.push([ref,data]);},async commit(){for(const [ref,data]of writes)await ref.set(data);}};}};
module.exports={db};
