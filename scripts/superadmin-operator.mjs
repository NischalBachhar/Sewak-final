import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {cloudflareToken} from './cloudflare-operator.mjs';
import {assertDeploymentConfig,assertLiveBindings,SEWAK_ACCOUNT,targets} from './deployment-policy.mjs';
import {assertOperator} from './superadmin-recovery-core.mjs';

export async function verifiedOwnerTarget({fetchImpl=fetch,token=cloudflareToken(),config=readFileSync(new URL('../wrangler.production.toml',import.meta.url),'utf8'),env=process.env}={}) {
  const {writesEnabled}=assertDeploymentConfig('sewak-final',config,env);
  const target=targets['sewak-final'],prefix='/accounts/'+SEWAK_ACCOUNT;
  // Capture one credential for identity, binding verification and the transaction.
  const api=async(path,json)=>{
    const response=await fetchImpl('https://api.cloudflare.com/client/v4'+path,{
      method:json?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(30000),
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      ...(json?{body:JSON.stringify(json)}:{})});
    const body=await response.json();
    if(!response.ok||body.success!==true||Array.isArray(body.result)&&body.result.some(r=>r.success===false))
      throw new Error('Cloudflare verification/query failed. Inspect before retrying a write.');
    return body.result;
  };
  const identity=await api('/user');assertOperator(identity);
  const verifyBindings=async()=>{
    const settings=await api(prefix+'/workers/scripts/sewak-final/settings');
    assertLiveBindings('sewak-final',settings.bindings,writesEnabled);
    const db=await api(prefix+'/d1/database/'+target.DB[1]);
    assert.equal(db.uuid,target.DB[1],'Incorrect production database ID.');
    assert.equal(db.name,target.DB[0],'Incorrect production database name.');
  };
  await verifyBindings();
  const endpoint=prefix+'/d1/database/'+target.DB[1]+'/query';
  const DB={
    prepare(sql){
      const statement=(params=[])=>({sql,params,bind:(...values)=>statement(values),
        async all(){return (await api(endpoint,{sql,params}))[0];},
        async first(){return (await this.all()).results?.[0]||null;},
        async run(){return this.all();}});
      return statement();
    },
    async batch(statements){return api(endpoint,{batch:statements.map(({sql,params})=>({sql,params}))});},
  };
  return {DB,identity:{id:identity.id,email:identity.email},verifyBindings};
}
