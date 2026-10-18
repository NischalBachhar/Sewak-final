import assert from 'node:assert/strict';

export const SEWAK_ACCOUNT='860970f755498a4fe10e16c2fa99ce55';
export const targets={
 'sewak':{config:'wrangler.toml',audience:'sewak-staging',DB:['sewak-staging-db','764b3560-fc46-4273-9026-f049941ab4c3'],MEDIA_DB:['sewak-staging-media','0060c4f7-828c-478d-b951-c1be0b43921e'],EVIDENCE_DB:['sewak-staging-verification-evidence','c6eb1466-20fa-40ca-bf53-29d1b35cf0e8']},
 'sewak-final':{config:'wrangler.production.toml',audience:'sewak-production',DB:['sewak-db','36fa1df1-aa5d-43a1-ad0e-a4e310c513c3'],MEDIA_DB:['sewak-media','c3721e25-4fb2-4a0d-b350-518ec9abbea2'],EVIDENCE_DB:['sewak-verification-evidence','591fe39d-688e-49b6-a3a0-015700c6c5d1']},
};
const value=(text,key)=>{const matches=[...text.matchAll(new RegExp('^'+key+'\\s*=\\s*"([^"\\r\\n]+)"\\s*(?:#.*)?$','gm'))];assert.equal(matches.length,1,'Exactly one '+key+' is required');return matches[0][1];};
export function assertDeploymentConfig(worker,config,env=process.env){
 const target=targets[worker];assert.ok(target,'Unknown Sewak deployment target');
 const top=config.split(/^\[/m)[0];assert.equal(value(top,'name'),worker,'Worker/config name mismatch');assert.equal(value(top,'account_id'),SEWAK_ACCOUNT,'Wrong Cloudflare account');
 assert.equal(env.CLOUDFLARE_ACCOUNT_ID,SEWAK_ACCOUNT,'Select the exact Sewak account');
 assert.ok(!env.CLOUDFLARE_ENV,'CLOUDFLARE_ENV must not override the reviewed config');
 assert.ok(!env.WRANGLER_CI_OVERRIDE_NAME||env.WRANGLER_CI_OVERRIDE_NAME===worker,'CI Worker name override conflicts with reviewed target');
 assert.ok(!env.WORKERS_CI&&!env.WRANGLER_CI_MATCH_TAG,'Connected Workers Builds must not bypass the operator QA gates');
 assert.ok(!/^\[env[.\]]/m.test(config),'Use the separate reviewed config, not named environment overrides');
 assert.equal(value(config,'AUTH_AUDIENCE'),target.audience,'Wrong auth audience');
 const writes=value(config,'APP_WRITES_ENABLED');assert.ok(['true','false'].includes(writes));if(worker==='sewak')assert.equal(writes,'false','Staging must remain read-only');
 const blocks=[...config.matchAll(/^\[\[d1_databases\]\]\s*\r?\n([\s\S]*?)(?=^\[|(?![\s\S]))/gm)].map(m=>m[1]);assert.equal(blocks.length,3,'Exactly three pinned D1 bindings required');
 const found=new Set();for(const block of blocks){const name=value(block,'binding');assert.ok(['DB','MEDIA_DB','EVIDENCE_DB'].includes(name)&&!found.has(name),'Unexpected or duplicate D1 binding');found.add(name);assert.equal(value(block,'database_name'),target[name][0],name+' database name mismatch');assert.equal(value(block,'database_id'),target[name][1],name+' database ID mismatch');}
 return {target,writesEnabled:writes==='true'};
}
export function assertLiveBindings(worker,bindings,writesEnabled,{requireEvidence=false}={}){
 const target=targets[worker];assert.ok(target);
 const expected=['DB','MEDIA_DB',...(requireEvidence||bindings.some(b=>b.name==='EVIDENCE_DB')?['EVIDENCE_DB']:[])];
 const d1=bindings.filter(b=>b.type==='d1');assert.ok(d1.every(b=>expected.includes(b.name)),'Unexpected live D1 binding');
 for(const name of expected){const matches=bindings.filter(b=>b.name===name);assert.equal(matches.length,1);assert.equal(matches[0].id||matches[0].database_id,target[name][1],name+' live database mismatch');}
 for(const[name,wanted]of [['AUTH_AUDIENCE',target.audience],['APP_WRITES_ENABLED',String(writesEnabled)]]){const matches=bindings.filter(b=>b.name===name);assert.equal(matches.length,1);assert.equal(matches[0].text,wanted,name+' live mismatch');}
}
