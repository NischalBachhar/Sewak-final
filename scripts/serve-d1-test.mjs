import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {hashPassword} from '../worker/src/passwords.ts';
import { environment } from '../tests/d1/harness.mjs';
import { createWorker } from '../worker/src/index.ts';
import { Repository,parseResource } from '../worker/src/repository.ts';
import { encodeRecord,insertSQL,decodeRecord } from '../worker/src/model.mjs';
if(process.env.SEWAK_LOCAL_TESTS!=='true'||!process.env.SEWAK_E2E_TOKEN)throw new Error('Isolated local browser test runner required.');
const env=environment(),root=path.resolve('build');const worker=createWorker();
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:4173');const parts=[];for await(const part of req)parts.push(part);const body=Buffer.concat(parts);
  if(url.pathname==='/__test__/reset-limits'){
   if(req.headers['x-sewak-e2e-token']!==process.env.SEWAK_E2E_TOKEN){res.writeHead(403).end();return;}
   await env.DB.prepare('DELETE FROM cf_auth_limits').run();res.writeHead(200).end();return;
  }
  if(url.pathname==='/__test__/auth'){
   if(req.headers['x-sewak-e2e-token']!==process.env.SEWAK_E2E_TOKEN){res.writeHead(403).end();return;}
   const {uid,email,password}=JSON.parse(body);if(!/^e2e-[a-z0-9-]+$/.test(uid)||!email.endsWith('@example.test'))throw new Error('Synthetic test accounts only');
   const existing=await env.DB.prepare('SELECT user_id FROM cf_credentials WHERE user_id=?').bind(uid).first();
   if(!existing){const q=insertSQL('users',encodeRecord('users',uid,{uid,email,name:'Test account',role:'user',isSuspended:false}),'upsert');await env.DB.prepare(q.sql).bind(...q.params).run();await env.DB.prepare('INSERT INTO cf_credentials(user_id,email,password_hash,created_at) VALUES(?,?,?,?)').bind(uid,email,hashPassword(password),Math.floor(Date.now()/1000)).run();}
   res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true}));return;
  }
  if(url.pathname==='/__test__/db'){
   if(req.headers['x-sewak-e2e-token']!==process.env.SEWAK_E2E_TOKEN){res.writeHead(403).end();return;}
   const command=JSON.parse(body);const {name,spec,key}=parseResource(command.path);const db=env.DB;
   let result;
   if(command.op==='get'&&key){const saved=await new Repository(env).get(command.path);result={id:key,data:saved.data};}
   else if(command.op==='get'){
    const columns=['id','version','fields_present','extra_json',...Object.values(spec.fields).map(f=>`"${f.column}"`)];
    const rows=await db.prepare(`SELECT ${columns.join(',')} FROM ${spec.table} ORDER BY id LIMIT ?`).bind(command.limit||1000).all();
    result=rows.results.map(row=>({id:row.id,data:decodeRecord(name,row)}));
   }else if(command.op==='set'||command.op==='update'){
    const old=command.op==='update'?(await new Repository(env).get(command.path)).data:{};
    const q=insertSQL(name,encodeRecord(name,key,{...old,...command.data}),'upsert');await db.prepare(q.sql).bind(...q.params).run();result={ok:true};
   }else throw new Error('Unsupported fixture operation');
   res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(result));return;
  }
  if(url.pathname.startsWith('/api/')){
   const request=new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}: {})});
   const result=await worker.fetch(request,env);const responseBytes=Buffer.from(await result.arrayBuffer());
   // Isolated fixture server only: correlate the exact bytes sent to the
   // browser with its Blob and Playwright capture. No token/body is logged.
   if(req.method==='GET'&&url.pathname.startsWith('/api/media/')&&result.status===200){
    result.headers.set('X-Sewak-Test-Request-Id',randomUUID());
    result.headers.set('X-Sewak-Test-Body-Bytes',String(responseBytes.length));
    result.headers.set('X-Sewak-Test-Body-SHA256',createHash('sha256').update(responseBytes).digest('hex'));
   }
   res.writeHead(result.status,Object.fromEntries(result.headers));res.end(responseBytes);return;
  }
  let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
  // The browser test uses exactly the production CSP.
  for(const line of fs.readFileSync('public/_headers','utf8').split('\n')){
   const header=line.match(/^\s+([^:]+):\s*(.+)$/);if(!header)continue;
   const value=header[2];
   res.setHeader(header[1],value);
  }
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.jpeg':'image/jpeg','.png':'image/png','.xml':'application/xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
  if(/^\/(auth|user|caregiver|organization|superadmin|payment-callback)(\/|$)/.test(url.pathname))res.setHeader('X-Robots-Tag','noindex, nofollow');
  fs.createReadStream(file).pipe(res);
 }catch(error){console.error(error.message);res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Local test server error'}));}
}).listen(4173,'127.0.0.1');
