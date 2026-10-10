import {createInterface,emitKeypressEvents} from 'node:readline';

// Only fixed messages may be logged. Never include what the operator entered.
const messages={
  terminal:'Open VS Code > Terminal > New Terminal and select PowerShell. Run the command there, not in Output, Debug Console, or Codex chat. Piped input/output is forbidden.',
  timeout:'Input timed out after five minutes. Click inside the PowerShell terminal, paste/type the requested value, then press Enter. No approval was accepted for this step.',
  cancelled:'Cancelled with Ctrl+C. No approval was accepted for this step.',
  ended:'Terminal input closed. Open a new PowerShell terminal and retry.',
  long:'Input is too long. This step was not accepted.',
  mismatch:'Approval did not match after three attempts. No approval was accepted for this step.',
  password:'Passwords must match and contain 12–128 characters. Retry the command; do not put passwords in chat or command arguments.',
  test:'The disposable test entries did not match or were empty. Run the offline terminal check again; do not use your real password.',
};
export class TerminalInputError extends Error {
  constructor(code){super(messages[code]||messages.terminal);this.name='TerminalInputError';}
}
function requireTerminal(input,output){
  if(!input.isTTY||!output.isTTY||typeof input.setRawMode!=='function')throw new TerminalInputError('terminal');
}

// Standard Node readline handles visible editing, Windows Enter and pasted text.
// Close it completely before a password reader is installed: no secret echoes
// and no readline history may survive into the hidden-input phase.
export function visibleInput(label,{input=process.stdin,output=process.stdout,timeoutMs=300000}={}) {
  requireTerminal(input,output);
  return new Promise((resolve,reject)=>{
    const wasRaw=Boolean(input.isRaw);
    const reader=createInterface({input,output,terminal:true,historySize:0,crlfDelay:Infinity});
    let finished=false;
    const done=(code,value)=>{
      if(finished)return;finished=true;clearTimeout(timer);
      reader.removeListener('SIGINT',cancel);reader.removeListener('close',ended);
      input.removeListener('error',ended);reader.close();
      input.setRawMode(wasRaw);input.pause();
      if(code){output.write('\n');reject(new TerminalInputError(code));}else resolve(value);
    };
    const cancel=()=>done('cancelled'),ended=()=>done('ended');
    const timer=setTimeout(()=>done('timeout'),timeoutMs);
    reader.on('SIGINT',cancel);reader.on('close',ended);input.on('error',ended);
    reader.question(label,value=>done(value.length>256?'long':null,value));
  });
}

export async function confirmPhrase(phrase,instructions,options={}) {
  const output=options.output||process.stdout;
  output.write(`${instructions}\nClick inside the TERMINAL panel. Copy and paste ONLY the following line, then press Enter.\nInput is visible. This step expires after five minutes; Ctrl+C cancels.\n\n${phrase}\n\n`);
  for(let attempt=0;attempt<3;attempt++){
    const answer=await visibleInput('Approval (visible): ',options);
    if(answer===phrase){output.write('Approval accepted.\n\n');return;}
    output.write('That did not match. Copy the exact line above, without quotes or extra spaces, and press Enter.\n');
  }
  throw new TerminalInputError('mismatch');
}

// No masking output, argv, environment, subprocess, file, or readline history.
// Input is retained only in this Node process until it exits.
export function privateInput(label,{input=process.stdin,output=process.stdout,timeoutMs=300000}={}) {
  requireTerminal(input,output);
  return new Promise((resolve,reject)=>{
    let value='',finished=false;const wasRaw=input.isRaw;
    const done=(error)=>{if(finished)return;finished=true;clearTimeout(timer);input.removeListener('keypress',key);input.removeListener('end',ended);input.removeListener('error',ended);input.setRawMode(Boolean(wasRaw));input.pause();output.write('\n');if(error)reject(new TerminalInputError(error));else resolve(value);value='';};
    const ended=()=>done('ended');
    const key=(text,event={})=>{
      if(event.ctrl&&event.name==='c')return done('cancelled');
      if(event.name==='return'||event.name==='enter')return done();
      if(event.name==='backspace'){value=Array.from(value).slice(0,-1).join('');return;}
      if(event.ctrl||event.meta||!text||/[\x00-\x1f\x7f]/.test(text))return;
      if(value.length+text.length>256)return done('long');
      value+=text;
    };
    const timer=setTimeout(()=>done('timeout'),timeoutMs);
    output.write(label);emitKeypressEvents(input);input.setRawMode(true);input.on('keypress',key);input.once('end',ended);input.once('error',ended);input.resume();
  });
}
