import { storeProfileImage } from './media.ts';
import { Repository } from './repository.ts';
import { requireThat, textField, type Env } from './types.ts';

// Temporary, bounded profile-image migration only. No SQL/general import API.
// Disabled unless explicitly enabled AND normal application writes are closed.
export async function importProfileImage(request: Request, env: Env, uid: string) {
  requireThat(env.MIGRATION_ENABLED === 'true' && env.APP_WRITES_ENABLED === 'false' && env.MIGRATION_TOKEN && env.MIGRATION_TOKEN.length >= 43, 'Endpoint not found.',404,'not-found');
  const supplied = request.headers.get('X-Sewak-Migration-Token') || '';
  requireThat(supplied.length === env.MIGRATION_TOKEN.length && supplied.length <= 128, 'Invalid migration credential.',401,'unauthenticated');
  const hash = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const a = await hash(supplied), b = await hash(env.MIGRATION_TOKEN);
  let difference = 0; for(let i=0;i<a.length;i++) difference |= a[i]^b[i];
  requireThat(difference === 0,'Invalid migration credential.',401,'unauthenticated');
  textField(uid,'Profile ID',1,128);
  const repo = new Repository(env);
  const profile = await repo.data(`users/${uid}`), caregiver = await repo.data(`vendors/${uid}`);
  requireThat(profile || caregiver,'Profile not found.',404,'not-found');
  return storeProfileImage(request,repo,uid,{profile,caregiver,ownerType:caregiver?'caregiver':profile?.role==='superadmin'?'admin':'user'},true);
}
