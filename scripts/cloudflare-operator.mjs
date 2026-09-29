import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Operator CLI only; never imported into the browser or Worker.
export function cloudflareToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const file = join(process.env.XDG_CONFIG_HOME || join(process.env.APPDATA || '', 'xdg.config'),'.wrangler','config','default.toml');
  const config = readFileSync(file,'utf8');
  const match = config.match(/^oauth_token\s*=\s*"([^"]+)"/m);
  if (!match) throw new Error('Run wrangler login or set CLOUDFLARE_API_TOKEN.');
  return match[1];
}
export async function cloudflare(path, options = {}) {
  // The user explicitly excluded the Shoe Doctor account from this migration.
  // Refuse it even if the local Wrangler login still defaults to that account.
  if (path.includes('/accounts/a0f8addf5cb7c232eb998fd4656df9fc')) throw new Error('The Shoe Doctor Cloudflare account is excluded from the Sewak migration.');
  const account = path.match(/^\/accounts\/([^/]+)/)?.[1];
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || account !== process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error('Set CLOUDFLARE_ACCOUNT_ID to the explicitly selected Sewak account.');
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { ...options, headers: { Authorization: `Bearer ${cloudflareToken()}`, 'Content-Type':'application/json' }, ...(options.json !== undefined ? {body:JSON.stringify(options.json)} : {}) });
  const body = await response.json();
  if (!response.ok || body.success === false) throw new Error(`Cloudflare request failed (${response.status}): ${(body.errors || []).map((x)=>x.code).join(',')}`);
  return body.result;
}
export async function assertFreeAccount(account, {attested = false} = {}) {
  let subscriptions;
  try { subscriptions = await cloudflare(`/accounts/${account}/subscriptions`); }
  catch(error) {
    if(attested && /\(403\)/.test(error.message)) return { verification:'operator-attestation',account,confirmedAt:new Date().toISOString() };
    throw new Error('Workers billing plan cannot be verified with this token. Confirm Workers Free in the selected account, then pass --free-plan-confirmed. No resources were changed.');
  }
  const paidWorkers = subscriptions.filter((s) => /worker/i.test(JSON.stringify(s.rate_plan || {})) && !/free/i.test(s.rate_plan?.id || s.rate_plan?.public_name || ''));
  if (paidWorkers.length) throw new Error('This account has a paid Workers subscription. A Free account is required for zero-overage operation.');
  return { verification:'billing-api',paidWorkersSubscriptions: paidWorkers.length, subscriptions: subscriptions.map((s)=>({name:s.rate_plan?.public_name,id:s.rate_plan?.id})) };
}
