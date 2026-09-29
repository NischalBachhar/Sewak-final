import { createRequire } from 'node:module';
import { cloudflare } from './cloudflare-operator.mjs';
const require = createRequire(new URL('../worker/package.json',import.meta.url));
export async function openTarget({remote=false, mainId, mediaId, persist='.local-tools/d1-state'} = {}) {
  if (remote) {
    const account = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!account || !mainId || !mediaId) throw new Error('Remote import requires the selected account and BOTH D1 IDs.');
    const make = (id) => ({
      prepare(sql) {
        return { bind(...params) { return statement(sql,params); }, ...statement(sql,[]) };
        function statement(sql,params) {
          const run = async () => (await cloudflare(`/accounts/${account}/d1/database/${id}/query`,{method:'POST',json:{sql,params}}))[0];
          return {sql,params,run,all:run,async first(){return (await run()).results?.[0] || null;}};
        }
      },
      async batch(statements) {
        // Preserve per-statement bindings with the documented REST batch shape.
        // Joining SQL and flattening parameters gives every statement the wrong
        // binding count. Runtime application writes use native D1.batch instead.
        const batch=statements.map(({sql,params})=>({sql,params}));
        return cloudflare(`/accounts/${account}/d1/database/${id}/query`,{method:'POST',json:{batch}});
      },
    });
    return {DB:make(mainId),MEDIA_DB:make(mediaId),close:async()=>{}};
  }
  const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
  const mf = new Miniflare(convertV4MiniflareOptions({name:'sewak-local',modules:true, script:'export default {fetch(){return new Response("Local migration harness")}}', compatibilityDate:'2026-09-01', d1Databases:{DB:'sewak-db',MEDIA_DB:'sewak-media'}, resourcePersistencePath:persist}));
  return {DB:await mf.getD1Database('DB'),MEDIA_DB:await mf.getD1Database('MEDIA_DB'),close:()=>mf.dispose()};
}
