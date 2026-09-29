const base=require('@playwright/test');
// Each journey gets an independent rate-limit window. The fixture endpoint is
// loopback-only, secret-guarded and absent from the deployed Worker. Dedicated
// API tests exercise limits without resets, including failed-login exhaustion.
const test=base.test.extend({
 browser:async({browser},use)=>{
  const firebaseRequests=[];
  const proxy=new Proxy(browser,{get(target,key){if(key==='newContext')return async(...args)=>{
   const context=await target.newContext(...args);
   context.on('request',request=>{const host=new URL(request.url()).hostname;if(/(?:^|\.)(?:googleapis\.com|firebaseio\.com|firebaseapp\.com|firebase\.com)$/.test(host))firebaseRequests.push(request.url().split('?')[0]);});
   return context;
  };const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
  await use(proxy);base.expect(firebaseRequests,'Every browser journey must use zero Firebase runtime requests').toEqual([]);
 },
 isolatedLimits:[async({},use)=>{const r=await fetch('http://127.0.0.1:4173/__test__/reset-limits',{method:'POST',headers:{'X-Sewak-E2e-Token':process.env.SEWAK_E2E_TOKEN}});base.expect(r.status).toBe(200);await use();},{auto:true}],
});
module.exports={test,expect:base.expect};
