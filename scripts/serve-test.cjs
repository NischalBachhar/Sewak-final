const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
if(process.env.GCLOUD_PROJECT!=='demo-sewak-test')throw new Error('This server is for demo-emulator browser tests only.');
const root=path.resolve('build');
http.createServer((req,res)=>{
 const route=new URL(req.url,'http://localhost').pathname;let file=path.resolve(root,'.'+decodeURIComponent(route));
 if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}
 if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.jpeg':'image/jpeg','.png':'image/png','.xml':'application/xml'})[path.extname(file)]||'text/plain');
 if(/^\/(auth|user|caregiver|organization|superadmin|payment-callback)(\/|$)/.test(route))res.setHeader('X-Robots-Tag','noindex, nofollow');
 fs.createReadStream(file).pipe(res);
}).listen(4173,'127.0.0.1');
