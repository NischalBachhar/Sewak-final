// Small UI transport adapter, not a database SDK. Only the finite query/write
// shapes supported by Sewak are serialized. The Worker independently validates
// each resource, actor, field, transition, quote and optimistic precondition.
import { apiRequest, notifyDataChanged } from './apiClient';
import { auth } from './authClient';
export const db = Object.freeze({ provider: 'worker-d1' });
export const collection = (base, ...parts) => ({ path: [base?.path, ...parts].filter(Boolean).join('/'), kind: 'collection' });
export const doc = (base, ...parts) => {
  const path = [base?.path, ...(parts.length ? parts : [crypto.randomUUID()])].filter(Boolean).join('/');
  return { path, id: path.split('/').pop(), kind: 'document' };
};
export const where = (field, op, value) => ({ kind: 'filter', field, op, value });
export const documentId = () => '__name__';
export const orderBy = (field, direction = 'asc') => ({ kind: 'order', field, direction });
export const limit = (value) => ({ kind: 'limit', value });
export const startAfter = (snapshot) => ({ kind: 'cursor', value: snapshot.cursor || { id: snapshot.id, value: snapshot.id } });
export const query = (base, ...clauses) => ({ ...base, clauses: [...(base.clauses || []), ...clauses] });
export const serverTimestamp = () => ({ __op: 'serverTimestamp' });
export const deleteField = () => ({ __op: 'delete' });
export const Timestamp = { fromDate: (date) => date.toISOString() };
export const count = () => ({ op: 'count' });
export const sum = (field) => ({ op: 'sum', field });
function hydrate(value, key = '') {
  if (value && typeof value === 'object') return Array.isArray(value) ? value.map((v) => hydrate(v)) : Object.fromEntries(Object.entries(value).map(([k,v]) => [k, hydrate(v,k)]));
  if (typeof value === 'string' && /At$|^actualCheckIn$|^actualCheckOut$/.test(key) && /^\d{4}-\d\d-\d\dT/.test(value)) {
    return { toDate: () => new Date(value), toMillis: () => new Date(value).getTime(), toJSON: () => value, seconds: new Date(value).getTime() / 1000 };
  }
  return value;
}
function snapshot(item, reference) {
  return { id: reference.id, ref: reference, version: item?.version || 0, cursor: item?.cursor,
    exists: () => Boolean(item), data: () => item ? hydrate(item.data) : undefined,
    metadata: { fromCache: false, hasPendingWrites: false } };
}
function queryInput(reference) {
  const result = { path: reference.path, filters: [] };
  for (const item of reference.clauses || []) {
    if (item.kind === 'filter') result.filters.push({ field: item.field, op: item.op, value: item.value });
    if (item.kind === 'order') result.order = { field: item.field, direction: item.direction };
    if (item.kind === 'limit') result.limit = item.value;
    if (item.kind === 'cursor') result.cursor = item.value;
  }
  return result;
}
export async function getDoc(reference) {
  const result = await apiRequest(`/api/records/${reference.path.split('/').map(encodeURIComponent).join('/')}`);
  return snapshot(result.items[0], reference);
}
export const getDocFromServer = getDoc;
export async function getDocs(reference) {
  const input = queryInput(reference);
  const all = [];
  // Existing small admin dashboards need complete totals. Fetch bounded pages,
  // never silently display a partial dataset as the full result.
  const requested = input.limit;
  do {
    const result = await apiRequest('/api/query', { method: 'POST', json: { ...input, limit: Math.min(50, requested || 50) } });
    all.push(...result.items);
    input.cursor = result.nextCursor;
    if (!input.cursor || requested) break;
    if (all.length >= 1000) throw Object.assign(new Error('This list exceeds 1,000 records. Narrow the filter before loading more.'), { code: 'resource-exhausted' });
  } while (input.cursor);
  const docs = all.map((item) => snapshot(item, { path: item.path, id: item.id, kind: 'document' }));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn), metadata: { fromCache: false, hasPendingWrites: false } };
}
export async function getAggregateFromServer(reference, aggregate) {
  const result = await apiRequest('/api/query', { method: 'POST', json: { ...queryInput(reference), aggregate } });
  return { data: () => result.aggregate };
}
function batch(preconditions = []) {
  const writes = [];
  return {
    set: (ref, data, options = {}) => writes.push({ path: ref.path, kind: 'set', data, merge: options.merge === true }),
    update: (ref, data) => writes.push({ path: ref.path, kind: 'update', data }),
    delete: (ref) => writes.push({ path: ref.path, kind: 'delete' }),
    commit: async () => {
      if (!writes.length) return;
      await apiRequest('/api/commit', { method: 'POST', json: { writes, preconditions } });
      notifyDataChanged();
    },
  };
}
export const writeBatch = () => batch();
export const setDoc = async (ref, data, options) => { const b = batch(); b.set(ref,data,options); await b.commit(); };
export const updateDoc = async (ref, data) => { const b = batch(); b.update(ref,data); await b.commit(); };
export const addDoc = async (ref, data) => { const created = doc(ref); await setDoc(created,data); return created; };
export async function runTransaction(_unused, fn) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const preconditions = []; const tx = batch(preconditions);
    tx.get = async (ref) => { const value = await getDoc(ref); preconditions.push({ path: ref.path, version: value.version }); return value; };
    const result = await fn(tx);
    try { await tx.commit(); return result; }
    catch (error) { if (error.code !== 'aborted' || attempt === 2) throw error; }
  }
}
// Ordinary HTTP refresh. No Firestore listeners, websocket service, or local
// persistence of private records. Cross-device care updates can take 60 seconds.
export function onSnapshot(reference, options, next, error) {
  if (typeof options === 'function') { error = next; next = options; }
  let stopped = false, loading = false, rerun = false, lastFetch = 0;
  const uid = auth.currentUser?.uid;
  const refresh = async (force = false) => {
    if (stopped || auth.currentUser?.uid !== uid || document.visibilityState === 'hidden') return;
    if (loading) { rerun = true; return; }
    if (!force && Date.now() - lastFetch < 3000) return;
    loading = true; lastFetch = Date.now();
    try { const value = await (reference.kind === 'document' ? getDoc(reference) : getDocs(reference)); if (!stopped && auth.currentUser?.uid === uid) next(value); }
    catch (err) { if (!stopped) error?.(err); }
    finally { loading = false; if (rerun) { rerun = false; refresh(true); } }
  };
  const changed = () => refresh(true); const focused = () => refresh();
  window.addEventListener('sewak:data-changed', changed); window.addEventListener('focus', focused); window.addEventListener('online', changed); document.addEventListener('visibilitychange', focused);
  const timer = /^(bookings|careSessions|reportReceipts)\//.test(`${reference.path}/`) ? setInterval(focused, 60000) : null;
  refresh(true);
  return () => { stopped = true; clearInterval(timer); window.removeEventListener('sewak:data-changed', changed); window.removeEventListener('focus', focused); window.removeEventListener('online', changed); document.removeEventListener('visibilitychange', focused); };
}
