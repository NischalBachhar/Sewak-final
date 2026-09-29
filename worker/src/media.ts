import { inspectImage, MAX_IMAGE_BYTES } from './image-validation.mjs';
import { Repository, requireActive } from './repository.ts';
import { organizationActive, caregiverActive } from './policy.ts';
import { active, ApiError, badInput, nowISO, requireThat, type Actor, type Data, type Env } from './types.ts';

export async function boundedBytes(request: Request, maximum: number) {
  if (Number(request.headers.get('Content-Length')) > maximum) throw new ApiError(413, 'too-large', `Upload exceeds ${maximum} bytes.`);
  if (!request.body) throw new ApiError(400, 'invalid-argument', 'A request body is required.');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > maximum) { await reader.cancel(); throw new ApiError(413, 'too-large', `Upload exceeds ${maximum} bytes.`); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function digestImage(bytes: Uint8Array) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((x) => x.toString(16).padStart(2,'0')).join(''); }
export async function authorizeImageOwner(repo: Repository, actor: Actor | null, uid: string) {
  const user = requireActive(actor);
  const profile = await repo.data(`users/${uid}`);
  const caregiver = await repo.data(`vendors/${uid}`);
  requireThat(profile || caregiver, 'The profile does not exist.', 404, 'not-found');
  requireThat(user.uid === uid || user.role === 'superadmin' || (caregiver && user.role === 'orgadmin' && caregiver.organizationId === user.uid && await organizationActive(repo, user.uid)));
  if (caregiver && user.role !== 'superadmin') requireThat(await caregiverActive(repo, uid, false));
  return { profile, caregiver, ownerType: caregiver ? 'caregiver' : profile?.role === 'superadmin' ? 'admin' : 'user' };
}
export async function uploadProfileImage(request: Request, repo: Repository, actor: Actor | null, uid: string) {
  const owner = await authorizeImageOwner(repo, actor, uid);
  return storeProfileImage(request,repo,uid,owner);
}
export async function storeProfileImage(request: Request, repo: Repository, uid: string, owner: {profile: Data | null; caregiver: Data | null; ownerType: string}, preserveTimestamps = false) {
  const bytes = await boundedBytes(request, MAX_IMAGE_BYTES);
  let info;
  try { info = inspectImage(bytes, request.headers.get('Content-Type') || ''); }
  catch (error) { throw new ApiError(400, 'invalid-image', (error as Error).message); }
  const digest = await digestImage(bytes);
  // One stable media row per account, even when caregiver and user profiles both
  // reference it. An unlinked write is recovered by the next upload; never an
  // unbounded series of abandoned versions across the two databases.
  const id = `profile_${uid}`;
  const now = nowISO();
  await repo.env.MEDIA_DB.prepare(`INSERT INTO media(id,owner_id,owner_type,mime_type,file_size,width,height,data,digest,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,media_type) DO UPDATE SET mime_type=excluded.mime_type,file_size=excluded.file_size,width=excluded.width,height=excluded.height,data=excluded.data,digest=excluded.digest,owner_type=excluded.owner_type,updated_at=excluded.updated_at`)
    .bind(id, uid, owner.ownerType, info.mime, info.size, info.width, info.height, bytes.buffer, digest, now, now).run();
  const writes = [];
  const changed = preserveTimestamps ? {} : { updatedAt: now };
  if (owner.profile) writes.push({ path: `users/${uid}`, data: { ...owner.profile, profile_image_id: id, ...changed } });
  if (owner.caregiver) writes.push({ path: `vendors/${uid}`, data: { ...owner.caregiver, profile_image_id: id, ...changed } });
  await repo.commit(writes);
  return { id, url: `/api/media/${encodeURIComponent(id)}?v=${digest.slice(0,16)}`, ...info };
}
export async function deleteProfileImage(repo: Repository, actor: Actor | null, uid: string) {
  const owner = await authorizeImageOwner(repo, actor, uid);
  const previous = await repo.env.MEDIA_DB.prepare('SELECT digest FROM media WHERE owner_id=?').bind(uid).first<Data>();
  const writes = [];
  if (owner.profile) writes.push({ path: `users/${uid}`, data: { ...owner.profile, profile_image_id: null, updatedAt: nowISO() } });
  if (owner.caregiver) writes.push({ path: `vendors/${uid}`, data: { ...owner.caregiver, profile_image_id: null, updatedAt: nowISO() } });
  await repo.commit(writes); // unlink before deleting: missing media always falls back
  if(previous) await repo.env.MEDIA_DB.prepare('DELETE FROM media WHERE owner_id=? AND digest=?').bind(uid,previous.digest).run();
  return { deleted: true };
}
export async function serveProfileImage(request: Request, env: Env, repo: Repository, actor: Actor | null, id: string) {
  badInput(id.startsWith('profile_') && id.length <= 160, 'Invalid image ID.');
  const uid = id.slice(8);
  // Resolve visibility from MAIN DB before reading any BLOB. Customer/admin
  // photos remain private. A caregiver photo is public only while listed.
  const vendor = await repo.data(`vendors/${uid}`);
  const user = await repo.data(`users/${uid}`);
  const publicImage = vendor?.profile_image_id === id && vendor.isApproved === true && active(vendor) && (!user || active(user)) && await organizationActive(repo, vendor.organizationId || '');
  if (!publicImage) {
    requireThat(actor && (actor.uid === uid || actor.role === 'superadmin' && active(actor.profile) || vendor && actor.role === 'orgadmin' && active(actor.profile) && vendor.organizationId === actor.uid && await organizationActive(repo, actor.uid, false)), 'This profile image is private.');
  }
  requireThat(user?.profile_image_id === id || vendor?.profile_image_id === id, 'Profile image not found.', 404, 'not-found');
  const metadata = await env.MEDIA_DB.prepare('SELECT mime_type,file_size,width,height,digest FROM media WHERE id=? AND owner_id=?').bind(id, uid).first<Data>();
  requireThat(metadata, 'Profile image not found.', 404, 'not-found');
  const cacheKey = new Request(`${new URL(request.url).origin}/api/media/${encodeURIComponent(id)}?v=${metadata.digest}`);
  if (publicImage && typeof caches !== 'undefined') {
    const cached = await caches.default.match(cacheKey);
    if (cached) return request.headers.get('If-None-Match') === cached.headers.get('ETag') ? new Response(null,{status:304,headers:cached.headers}) : cached;
  }
  const headers = new Headers({ 'Content-Type': metadata.mime_type, 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline',
    'Cache-Control': publicImage ? 'public, max-age=60, must-revalidate' : 'private, no-store', ETag: `"${metadata.digest}"` });
  if (request.headers.get('If-None-Match') === headers.get('ETag')) return new Response(null, { status: 304, headers });
  const row = await env.MEDIA_DB.prepare('SELECT data FROM media WHERE id=? AND digest=?').bind(id, metadata.digest).first<{ data: ArrayBuffer | number[] }>();
  requireThat(row?.data, 'Image changed while loading. Retry.', 503, 'unavailable');
  // D1 query results return BLOBs as byte arrays, although binding accepts an
  // ArrayBuffer. Restore a binary response body explicitly (never JSON/base64).
  const binary = Array.isArray(row.data) ? new Uint8Array(row.data) : row.data;
  const response = new Response(binary, { headers });
  if (publicImage && typeof caches !== 'undefined') await caches.default.put(cacheKey, response.clone());
  return response;
}
