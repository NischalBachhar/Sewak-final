import { entities as models, resource, encodeRecord, decodeRecord, insertSQL } from './model.mjs';
import { ApiError, badInput, requireThat, type Actor, type Data, type Env, type Identity } from './types.ts';
export const entities: Record<string, any> = models;
export type Saved = { data: Data | null; version: number; path: string };
export type Write = { path: string; data: Data | null };
export class Repository {
  env: Env;
  reads = new Map<string, Saved>();
  sessionIdentity: Identity | null = null;
  constructor(env: Env) { this.env = env; }
  async get(path: string): Promise<Saved> {
    if (this.reads.has(path)) return this.reads.get(path)!;
    const { name, spec, key } = parseResource(path);
    badInput(key, 'A record ID is required.');
    const columns = ['id', 'version', 'fields_present', 'extra_json', ...Object.values(spec.fields).map((f: any) => `"${f.column}"`)];
    const row = await this.env.DB.prepare(`SELECT ${columns.join(',')} FROM ${spec.table} WHERE id=?`).bind(key).first<Data>();
    const saved = { data: decodeRecord(name, row), version: row?.version || 0, path };
    if (spec.child && saved.data) delete saved.data.sessionId;
    this.reads.set(path, saved);
    return saved;
  }
  async data(path: string) { return (await this.get(path)).data; }
  async actor(identity: Identity | null): Promise<Actor | null> {
    this.sessionIdentity = identity;
    if (!identity) return null;
    const profile = await this.data(`users/${identity.uid}`);
    return { ...identity, profile, role: profile?.role || 'user' };
  }
  // Every source read during authorization/validation is checked INSIDE the same
  // D1 batch as its writes. A failed guard rolls the whole transaction back.
  async commit(writes: Write[], extraStatements: D1PreparedStatement[] = []) {
    const statements: D1PreparedStatement[] = [];
    const transactionId = crypto.randomUUID();
    // Recheck session revocation in the same transaction as application writes.
    if (this.sessionIdentity?.sessionId) {
      statements.push(this.env.DB.prepare('INSERT INTO commit_guards(id,valid) VALUES(?,EXISTS(SELECT 1 FROM cf_sessions s JOIN cf_credentials c ON c.user_id=s.user_id WHERE s.id=? AND s.user_id=? AND s.credential_version=c.credential_version AND c.disabled=0 AND s.expires_at>? AND s.last_seen_at>?))').bind(`${transactionId}/session`,this.sessionIdentity.sessionId,this.sessionIdentity.uid,Math.floor(Date.now()/1000),Math.floor(Date.now()/1000)-86400));
    }
    for (const [path, saved] of this.reads) {
      const { spec, key } = parseResource(path);
      statements.push(this.env.DB.prepare(`INSERT INTO commit_guards(id,valid) VALUES(?, COALESCE((SELECT version FROM ${spec.table} WHERE id=?),0)=?)`).bind(`${transactionId}/${statements.length}`, key, saved.version));
    }
    for (const write of writes) {
      const { name, spec, key, parent } = parseResource(write.path);
      if (write.data === null) statements.push(this.env.DB.prepare(`DELETE FROM ${spec.table} WHERE id=?`).bind(key));
      else {
        const record = encodeRecord(name, key!, { ...write.data, ...(parent ? { sessionId: parent } : {}) }, (this.reads.get(write.path)?.version || 0) + 1);
        const query = insertSQL(name, record, 'upsert');
        statements.push(this.env.DB.prepare(query.sql).bind(...query.params));
        if (name === 'vendors') {
          statements.push(this.env.DB.prepare('DELETE FROM caregiver_services WHERE caregiver_id=?').bind(key));
          const ids = write.data.servicesOffered || [];
          // One parameterized INSERT handles all links, below Free query limits.
          if (ids.length) statements.push(this.env.DB.prepare('INSERT INTO caregiver_services(caregiver_id,service_id) SELECT ?,value FROM json_each(?)').bind(key, JSON.stringify(ids)));
        }
      }
    }
    statements.push(...extraStatements);
    statements.push(this.env.DB.prepare('DELETE FROM commit_guards WHERE id LIKE ?').bind(`${transactionId}/%`));
    badInput(this.reads.size + statements.length <= 48, 'This operation is too large. Submit fewer changes at once.');
    try { await this.env.DB.batch(statements); }
    catch (error) {
      if (String(error).includes('CHECK constraint failed: valid')) throw new ApiError(409, 'aborted', 'This record changed. Refresh and retry.');
      if (/UNIQUE constraint/.test(String(error))) throw new ApiError(409, 'already-exists', 'This record already exists.');
      throw error;
    }
  }
}
export function parseResource(path: unknown): any {
  badInput(typeof path === 'string' && path.length < 600, 'Invalid resource.');
  try { return resource(path as string); } catch { throw new ApiError(400, 'invalid-argument', 'Unknown resource or invalid ID.'); }
}
export function requireActor(actor: Actor | null): Actor {
  requireThat(actor, 'Sign in to continue.', 401, 'unauthenticated');
  return actor;
}
export function requireActive(actor: Actor | null): Actor {
  const user = requireActor(actor);
  requireThat(user.profile && !user.profile.isSuspended && !user.profile.isBlacklisted, 'Your account is not active.');
  return user;
}
export function requireAdmin(actor: Actor | null) {
  const user = requireActive(actor);
  requireThat(user.role === 'superadmin');
  return user;
}
