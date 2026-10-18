import { requireThat, type Env } from './types.ts';
const encoder = new TextEncoder();
async function key(env: Env) {
  requireThat(env.VERIFICATION_ENCRYPTION_KEY && /^[A-Za-z0-9_-]{43}$/.test(env.VERIFICATION_ENCRYPTION_KEY), 'Private verification storage is not configured.', 503, 'verification-unavailable');
  const raw = Uint8Array.from(atob(env.VERIFICATION_ENCRYPTION_KEY.replace(/-/g,'+').replace(/_/g,'/')+'='), c => c.charCodeAt(0));
  requireThat(raw.length === 32, 'Private verification storage is not configured.', 503, 'verification-unavailable');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
}
export async function encryptEvidence(env: Env, bytes: Uint8Array, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(context)}, await key(env), bytes));
  const result = new Uint8Array(1 + iv.length + ciphertext.length);
  result[0]=1; result.set(iv,1); result.set(ciphertext,13);
  return result.buffer;
}
export async function decryptEvidence(env: Env, value: ArrayBuffer | number[] | Uint8Array, context: string) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  requireThat(bytes[0]===1 && bytes.length>=29, 'Evidence is unavailable.',503,'evidence-unavailable');
  return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(1,13),additionalData:encoder.encode(context)},await key(env),bytes.slice(13)));
}
export const encryptDetails = (env: Env, value: unknown, context: string) => encryptEvidence(env, encoder.encode(JSON.stringify(value)), context);
export const decryptDetails = async (env: Env, value: any, context: string) => value ? JSON.parse(new TextDecoder().decode(await decryptEvidence(env,value,context))) : null;
