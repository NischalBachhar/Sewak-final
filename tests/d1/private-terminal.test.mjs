import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough,Writable} from 'node:stream';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {confirmPhrase,visibleInput,privateInput,TerminalInputError} from '../../scripts/private-terminal.mjs';

// Feed real data bytes through Node's readline decoder, not invented keypress
// events. This exercises Enter/CRLF, paste and prompt transitions on every OS.
function terminal(){
  const input=new PassThrough();input.isTTY=true;input.isRaw=false;
  input.setRawMode=function(value){this.isRaw=value;};
  let text='';const output=new Writable({write(chunk,_encoding,next){text+=chunk.toString();next();}});
  output.isTTY=true;output.columns=120;
  return {input,output,timeoutMs:500,text:()=>text};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('visible approval accepts Windows CRLF and pasted text, restores raw mode and removes echo listeners',async()=>{
 const tty=terminal(),phrase='PRESERVE synthetic-legacy-id';
 const pending=confirmPhrase(phrase,'Step 1: Preserve the old record.',tty);
 tty.input.write(phrase+'\r\n');await pending;
 assert.match(tty.text(),/Approval accepted/);assert.equal(tty.input.isRaw,false);
 assert.equal(tty.input.listenerCount('keypress'),0);
 const start=tty.text().length;
 const password=privateInput('Password (hidden): ',tty);
 tty.input.write('Synthetic-hidden-text-2026!\r');
 assert.equal(await password,'Synthetic-hidden-text-2026!');
 assert.equal(tty.text().slice(start),'Password (hidden): \n');
 assert.equal(tty.input.isRaw,false);
});
test('both exact approvals must be entered; mismatches can retry without accepting a partial phrase',async()=>{
 const tty=terminal();const first=confirmPhrase('FIRST APPROVAL','Step 1',tty);
 tty.input.write('FIRST\r');await tick();assert.doesNotMatch(tty.text(),/Approval accepted/);
 tty.input.write('FIRST APPROVAL\r');await first;
 const second=confirmPhrase('SECOND APPROVAL','Step 2',tty);
 tty.input.write('SECOND APPROVAL \r');await tick();
 tty.input.write('SECOND APPROVAL\r');await second;
 assert.equal(tty.text().match(/Approval accepted/g).length,2);
 const start=tty.text().length;
 for(let i=0;i<2;i++){
  const hidden=privateInput('Hidden: ',tty);tty.input.write('secret\x7fT\r\n');
  assert.equal(await hidden,'secreT');
 }
 assert.equal(tty.text().slice(start),'Hidden: \nHidden: \n');
});
test('three mismatches, cancellation, timeout and closed input fail without granting approval',async()=>{
 const tty=terminal(),pending=confirmPhrase('EXACT','Step 1',tty);
 const rejected=assert.rejects(pending,TerminalInputError);
 for(let i=0;i<3;i++){tty.input.write('wrong\r');await tick();}
 await rejected;assert.doesNotMatch(tty.text(),/Approval accepted/);assert.equal(tty.input.isRaw,false);
 for(const prompt of [visibleInput,privateInput]){
  for(const failure of ['cancel','timeout','end']){
   const t=terminal(),p=prompt('Prompt: ',{...t,timeoutMs:20});const rejection=assert.rejects(p,TerminalInputError);
   if(failure==='cancel')t.input.write('\x03');
   if(failure==='end')t.input.end();
   await rejection;assert.equal(t.input.isRaw,false);assert.equal(t.input.listenerCount('keypress'),0);
  }
 }
});
test('readline displays edited approval input and invisible passwords remain invisible after repeated prompts',async()=>{
 // Non-interactive Codex shells set TERM=dumb, which deliberately disables
 // readline editing. VS Code's integrated terminal supplies xterm capabilities.
 const previous=process.env.TERM;process.env.TERM='xterm-256color';
 try {
  const tty=terminal();
  const p=visibleInput('Visible: ',tty);tty.input.write('testx');tty.input.write('\x7f');tty.input.write('\r');assert.equal(await p,'test');
  assert.match(tty.text(),/test/);
  const start=tty.text().length;
  const hidden=privateInput('Hidden: ',tty);tty.input.write('Synthetic text with spaces!\r');
  assert.equal(await hidden,'Synthetic text with spaces!');assert.equal(tty.text().slice(start),'Hidden: \n');
 }finally{if(previous===undefined)delete process.env.TERM;else process.env.TERM=previous;}
});
test('non-interactive apply fails before Cloudflare access and both npm recovery names use the same guarded command',()=>{
 const result=spawnSync(process.execPath,['--experimental-strip-types','scripts/superadmin-recovery.mjs','bootstrap','--acknowledge-legacy-admin','--apply'],{encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/Terminal > New Terminal/);assert.match(result.stderr,/No production account write was attempted/);
 const pkg=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.scripts.admin,pkg.scripts['admin:recovery']);
 const check=spawnSync(process.execPath,['scripts/check-admin-terminal.mjs'],{encoding:'utf8'});
 assert.equal(check.status,1);assert.match(check.stderr,/Piped input\/output is forbidden/);
});
