import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('production D1 forensic command is SELECT-only and logs only fixed statuses',()=>{
 const code=readFileSync(new URL('../../scripts/diagnose-production-d1-readonly.mjs',import.meta.url),'utf8');
 const sqls=[...code.matchAll(/\['[^']+',(?:DB|MEDIA_DB),'(SELECT [^']+)'/g)].map(x=>x[1]);
 assert.equal(sqls.length,9);
 for(const sql of sqls){assert.match(sql,/^SELECT /);assert.doesNotMatch(sql,/(?:;|\b)(?:DELETE|UPDATE|INSERT|DROP|ALTER)\b/i);}
 assert.ok(!code.includes('console.log(sql)'));
 assert.ok(code.includes('category:safeD1Category(error)'));
});
