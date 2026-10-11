import { requireThat, type Env } from './types.ts';
const encoder = new TextEncoder();
export const base64url = (data: Uint8Array) => btoa(String.fromCharCode(...data)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const unbase64 = (text: string) => Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
async function key(env: Env) {
 requireThat(env.OUTBOX_ENCRYPTION_KEY && /^[A-Za-z0-9_-]{43}$/.test(env.OUTBOX_ENCRYPTION_KEY), 'Transactional delivery is not configured.',503,'delivery-unavailable');
 return crypto.subtle.importKey('raw',unbase64(env.OUTBOX_ENCRYPTION_KEY),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function seal(env: Env, value: unknown, context: string) {
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(context)},await key(env),encoder.encode(JSON.stringify(value)));
 return base64url(iv)+'.'+base64url(new Uint8Array(bytes));
}
export async function unseal(env: Env, value: string, context: string) {
 const [iv,bytes]=value.split('.');
 return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(iv),additionalData:encoder.encode(context)},await key(env),unbase64(bytes))));
}
