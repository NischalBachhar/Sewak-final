import { scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
// OWASP scrypt alternative: N=2^15, r=8, p=3. ~32 MiB working memory.
// Executes only inside a compute Durable Object in production, not the 10ms
// Free HTTP Worker. No passwords, hashes or sessions are persisted in the DO.
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const prefix = 'scrypt-v1$32768$8$3';
export function hashPassword(password: string) {
  const salt = randomBytes(32);
  return `${prefix}$${Buffer.from(salt).toString('base64url')}$${Buffer.from(scryptSync(password, salt, 64, options)).toString('base64url')}`;
}
export function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts.slice(0,4).join('$') !== prefix || !/^[\w-]{43}$/.test(parts[4]) || !/^[\w-]{86}$/.test(parts[5])) return false;
  const actual = scryptSync(password, Buffer.from(parts[4], 'base64url'), 64, options);
  return timingSafeEqual(actual, Buffer.from(parts[5], 'base64url'));
}
export const dummyPasswordHash = `${prefix}$${Buffer.alloc(32).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`;
export class PasswordHasher {
  async fetch(request: Request) {
    // The class has no public route; only its internal binding can invoke it.
    if (request.method !== 'POST') return new Response(null,{status:405});
    const body = await request.json() as {password?:unknown;hash?:unknown};
    if (typeof body.password !== 'string' || body.password.length > 256 || (body.hash !== undefined && (typeof body.hash !== 'string' || body.hash.length > 256))) return new Response(null,{status:400});
    return Response.json(body.hash === undefined ? {hash:hashPassword(body.password)} : {valid:verifyPassword(body.password,body.hash as string)});
  }
}
