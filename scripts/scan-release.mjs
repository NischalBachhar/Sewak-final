import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(p=>p&&existsSync(p)&&statSync(p).isFile());
const patterns=[/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/]/,/AIza[0-9A-Za-z_-]{35}/,/(?:oauth_token|api_token|refresh_token|private_key)\s*[=:]\s*["'][A-Za-z0-9_+/=-]{40,}["']/i];
const bad=[];for(const file of files){if(/\.(png|jpg|jpeg|webp|ico|woff2?|zip|pdf)$/i.test(file))continue;const content=readFileSync(file,'utf8');if(patterns.some(p=>p.test(content)))bad.push(file);}
const runtime=[];function walk(dir){for(const name of readdirSync(dir)){const p=dir+'/'+name;if(statSync(p).isDirectory())walk(p);else if(/\.(js|html)$/.test(p)&&/(?:identitytoolkit|securetoken)\.googleapis\.com|firebaseapp\.com|firebaseio\.com|firebase\/auth|firebase-admin/.test(readFileSync(p,'utf8')))runtime.push(p);}}
walk('build');
if(bad.length||runtime.length){console.error(JSON.stringify({pass:false,secretFilePaths:bad,runtimeFirebasePaths:runtime}));process.exit(1);}
console.log(JSON.stringify({pass:true,repositoryFilesScanned:files.length,firebaseRuntimeReferences:0,privateCredentialMatches:0}));
