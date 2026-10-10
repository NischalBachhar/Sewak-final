import {emitKeypressEvents} from 'node:readline';

// No masking output, argv, environment, subprocess, file, or readline history.
// Input is retained only in this Node process until it exits.
export function privateInput(label,{input=process.stdin,output=process.stdout,timeoutMs=300000}={}) {
  if(!input.isTTY||!output.isTTY||typeof input.setRawMode!=='function')throw new Error('Use an interactive local terminal. Piped input is forbidden.');
  return new Promise((resolve,reject)=>{
    let value='',finished=false;const wasRaw=input.isRaw;
    const done=(error)=>{if(finished)return;finished=true;clearTimeout(timer);input.removeListener('keypress',key);input.removeListener('end',ended);input.setRawMode(Boolean(wasRaw));input.pause();output.write('\n');if(error)reject(new Error(error));else resolve(value);value='';};
    const ended=()=>done('Input ended.');
    const key=(text,event={})=>{
      if(event.ctrl&&event.name==='c')return done('Cancelled.');
      if(event.name==='return'||event.name==='enter')return done();
      if(event.name==='backspace'){value=Array.from(value).slice(0,-1).join('');return;}
      if(event.ctrl||event.meta||!text||/[\x00-\x1f\x7f]/.test(text))return;
      if(value.length+text.length>256)return done('Input too long.');
      value+=text;
    };
    const timer=setTimeout(()=>done('Input timed out.'),timeoutMs);
    output.write(label);emitKeypressEvents(input);input.setRawMode(true);input.on('keypress',key);input.once('end',ended);input.resume();
  });
}
