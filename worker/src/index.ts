import { authenticateSession, authRoute, enforceCsrf } from './cloudflare-auth.ts';
export { PasswordHasher } from './passwords.ts';
import { runAction } from './actions.ts';
import { boundedBytes, deleteProfileImage, serveProfileImage, uploadProfileImage } from './media.ts';
import { commitClient } from './policy.ts';
import { queryRecords } from './queries.ts';
import { Repository } from './repository.ts';
import { ApiError, badInput, requireThat, type Env, type Identity, type Data } from './types.ts';

async function jsonBody(request: Request): Promise<Data> {
  requireThat(request.headers.get('Content-Type')?.split(';')[0] === 'application/json', 'Send a JSON request.', 415, 'invalid-argument');
  try {
    const body = JSON.parse(new TextDecoder().decode(await boundedBytes(request, 64000)));
    badInput(body && typeof body === 'object' && !Array.isArray(body)); return body;
  } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400,'invalid-argument','The JSON request is malformed.'); }
}
export function createWorker(authenticate: (request: Request, env: Env) => Promise<Identity | null> = authenticateSession) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      const authPath = /^\/(?:api\/)?auth\/(me|login|register|logout|bootstrap|activate|sessions|revoke-sessions|change-password|complete-registration)$/.test(url.pathname);
      if (!url.pathname.startsWith('/api/') && !authPath) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
      const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' });
      try {
        const origin = request.headers.get('Origin');
        if (origin && origin !== url.origin) {
          requireThat((env.ALLOWED_ORIGINS || '').split(',').map((v)=>v.trim()).filter(Boolean).includes(origin), 'This origin is not allowed.');
          headers.set('Access-Control-Allow-Origin', origin);
        }
        if (request.method === 'OPTIONS') {
          headers.set('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS'); headers.set('Access-Control-Allow-Headers','Authorization,Content-Type,X-CSRF-Token'); headers.set('Access-Control-Max-Age','600');
          return new Response(null,{status:204,headers});
        }
        if (url.pathname === '/api/health' && request.method === 'GET') {
          await env.DB.prepare('SELECT 1 FROM users LIMIT 1').first();
          await env.MEDIA_DB.prepare('SELECT id FROM media LIMIT 1').first();
          await env.DB.prepare('SELECT user_id FROM cf_credentials LIMIT 1').first();
          return Response.json({ healthy: true, writesEnabled: env.APP_WRITES_ENABLED === 'true', auth: 'cloudflare-d1' },{headers});
        }
        if (url.pathname.startsWith('/api/migration/')) throw new ApiError(404,'not-found','Endpoint not found.');
        const publicAuth = authPath && /\/(login|register|bootstrap|activate)$/.test(url.pathname);
        const identity = publicAuth ? null : await authenticate(request,env);
        enforceCsrf(request,identity);
        if (authPath) return Response.json(await authRoute(request,env,headers,request.method==='POST'?await jsonBody(request):{},identity),{headers});
        const repo = new Repository(env), actor = await repo.actor(identity);
        let result: unknown;
        if (request.method === 'GET' && url.pathname.startsWith('/api/media/')) {
          const response = await serveProfileImage(request,env,repo,actor,decodeURIComponent(url.pathname.slice(11)));
          const mediaHeaders = new Headers(response.headers);
          if (headers.has('Access-Control-Allow-Origin')) { mediaHeaders.set('Access-Control-Allow-Origin',headers.get('Access-Control-Allow-Origin')!); mediaHeaders.set('Vary','Origin'); }
          return new Response(response.body,{status:response.status,headers:mediaHeaders});
        }
        if (request.method === 'GET' && url.pathname.startsWith('/api/records/')) result = await queryRecords(repo,actor,{path:decodeURIComponent(url.pathname.slice(13))},true);
        else if (request.method === 'POST' && url.pathname === '/api/query') result = await queryRecords(repo,actor,await jsonBody(request));
        else {
          requireThat(env.APP_WRITES_ENABLED === 'true', 'Sewak is temporarily read-only while maintenance is completed.',503,'maintenance');
          if (request.method === 'POST' && url.pathname === '/api/commit') result = await commitClient(repo,actor,await jsonBody(request));
          else if (request.method === 'POST' && url.pathname.startsWith('/api/actions/')) result = await runAction(repo,actor,decodeURIComponent(url.pathname.slice(13)),await jsonBody(request));
          else if (/^\/api\/profiles\/[^/]+\/image$/.test(url.pathname) && ['PUT','DELETE'].includes(request.method)) {
            const uid = decodeURIComponent(url.pathname.split('/')[3]);
            result = request.method === 'PUT' ? await uploadProfileImage(request,repo,actor,uid) : await deleteProfileImage(repo,actor,uid);
          } else throw new ApiError(404,'not-found','Endpoint not found.');
        }
        return Response.json(result,{headers});
      } catch (error) {
        const known = error instanceof ApiError;
        const quota = /quota|exceeded|overload|SQLITE_FULL|D1_ERROR/i.test(String(error));
        const status = known ? error.status : 503;
        if (!known) console.error('Sewak request failed', { category: quota ? 'database-capacity' : 'service-failure' });
        if (status === 503) headers.set('Retry-After','60');
        if (status === 429) headers.set('Retry-After','900');
        if (known && error.code === 'unauthenticated' && request.headers.has('Cookie')) headers.append('Set-Cookie','__Host-sewak_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
        return Response.json({ error: { code: known ? error.code : 'unavailable', message: known ? error.message : 'The service is temporarily unavailable. Please retry later.' } },{status,headers});
      }
    },
  };
}
export default createWorker();
