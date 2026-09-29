export interface Env {
  DB: D1Database;
  MEDIA_DB: D1Database;
  ASSETS?: Fetcher;
  AUTH_AUDIENCE?: string;
  PASSWORD_HASHER?: DurableObjectNamespace;
  ALLOWED_ORIGINS?: string;
  APP_WRITES_ENABLED?: string;
  MIGRATION_TOKEN?: string;
  MIGRATION_ENABLED?: string;
}
export type Data = Record<string, any>;
// uid is the compatibility name of the application ID, never a Firebase UID.
export interface Identity { uid: string; email: string; authTime: number; sessionId?: string; transport?: 'cookie'|'bearer'; csrfToken?: string }
export interface Actor extends Identity { role: string; profile: Data | null }
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export function requireThat(condition: unknown, message = 'You do not have permission to perform this action.', status = 403, code = 'permission-denied'): asserts condition {
  if (!condition) throw new ApiError(status, code, message);
}
export const badInput = (condition: unknown, message = 'Invalid request.') => requireThat(condition, message, 400, 'invalid-argument');
export const active = (record?: Data | null) => Boolean(record && !record.isSuspended && !record.isBlacklisted);
export const nowISO = () => new Date().toISOString();
export const canonicalCategory = (value: string) => value === 'household' ? 'vendor' : value;
export function pick(data: Data, keys: string[]) { return Object.fromEntries(keys.filter((key) => data[key] !== undefined).map((key) => [key, data[key]])); }
export function onlyKeys(data: Data, keys: string[]) {
  badInput(data && typeof data === 'object' && !Array.isArray(data), 'Expected an object.');
  badInput(Object.keys(data).every((key) => keys.includes(key)), 'Request contains unsupported fields.');
}
export function textField(value: unknown, name: string, min = 0, max = 160): string {
  badInput(typeof value === 'string' && value.trim().length >= min && value.length <= max, `${name} is invalid.`);
  return (value as string).trim();
}
