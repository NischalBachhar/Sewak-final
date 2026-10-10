// Offline only. No Cloudflare imports, account operations, credentials or files.
import {confirmPhrase,privateInput,TerminalInputError} from './private-terminal.mjs';
try {
  console.log(`Offline terminal check: ${process.platform}, Node ${process.version}, stdin TTY=${Boolean(process.stdin.isTTY)}, stdout TTY=${Boolean(process.stdout.isTTY)}.`);
  await confirmPhrase('TERMINAL CHECK','This is a terminal test only. It cannot access Cloudflare or create an account.');
  console.log('For the hidden-input test, enter the same disposable text twice. Do NOT use your real password. Nothing will appear while you type. Press Enter after each entry.');
  let first=await privateInput('Disposable test text (hidden): ');
  let second=await privateInput('Repeat disposable test text (hidden): ');
  const matched=first.length>0&&first===second;first='';second='';
  if(!matched)throw new TerminalInputError('test');
  console.log('PASS: visible approval, hidden input, Enter handling and repeated prompts worked. No network requests or account writes were made.');
} catch(error) {
  console.error(error instanceof TerminalInputError?error.message:'Terminal check failed. Use an interactive PowerShell terminal.');
  process.exitCode=1;
}
