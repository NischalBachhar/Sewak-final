import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);

export async function accessToken() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const backend = createRequire(new URL('../../functions/package.json', import.meta.url));
    const { GoogleAuth } = backend('google-auth-library');
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore','https://www.googleapis.com/auth/firebase','https://www.googleapis.com/auth/cloud-platform'] });
    const token = await auth.getAccessToken();
    if (!token) throw new Error('Unable to obtain application credentials.');
    return token;
  }
  // Use the CLI's existing OAuth session in memory; never print or persist tokens.
  const auth = require('firebase-tools/lib/auth');
  const account = auth.getProjectDefaultAccount(process.cwd());
  if (!account?.tokens?.refresh_token) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS or run firebase login.');
  const result = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
  return result.access_token;
}
export function decodeFirestore(value) {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) {
    const number = Number(value.integerValue);
    return Number.isSafeInteger(number) ? number : { __integer: value.integerValue };
  }
  if ('doubleValue' in value) return Number.isFinite(value.doubleValue) ? value.doubleValue : { __number: String(value.doubleValue) };
  if ('timestampValue' in value) return { __timestamp: value.timestampValue };
  if ('stringValue' in value) return value.stringValue;
  if ('referenceValue' in value) return { __reference: value.referenceValue };
  if ('geoPointValue' in value) return { __geopoint: value.geoPointValue };
  if ('bytesValue' in value) return { __unsupportedBytes: true }; // Original typed value retained separately in raw backup.
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestore);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decodeFirestore(item)]));
  throw new Error(`Unsupported Firestore value type: ${Object.keys(value).join(',')}`);
}
export async function exportFirebase({ project, database = '(default)', output }) {
  if (!project || !output) throw new Error('Pass --project PROJECT --output PATH.');
  if (existsSync(output)) throw new Error('Output exists. Choose a new snapshot path to preserve the previous backup.');
  const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/${encodeURIComponent(database)}/documents`;
  let token = await accessToken();
  const request = async (url, options = {}) => {
    let response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    if (response.status === 401) { token = await accessToken(); response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }); }
    if (!response.ok) throw new Error(`Firebase export failed with HTTP ${response.status}; no successful snapshot will be written.`);
    return response.json();
  };
  const documents = {}, raw = {}, errors = [], counts = {}, discoveredCollections = [];
  async function walk(parent, depth = 0) {
    if (depth > 50) throw new Error('Subcollection depth exceeds export safety limit.');
    let pageToken = '';
    do {
      const listed = await request(`${parent}:listCollectionIds`, { method: 'POST', body: JSON.stringify({ pageSize: 100, ...(pageToken ? { pageToken } : {}) }) });
      for (const collectionId of listed.collectionIds || []) {
        const relative = `${parent.slice(root.length + 1)}${parent === root ? '' : '/'}${collectionId}`;
        discoveredCollections.push(relative); counts[relative] = 0;
        let docToken = '';
        do {
          const url = new URL(`${parent}/${encodeURIComponent(collectionId)}`);
          url.searchParams.set('pageSize','100'); url.searchParams.set('showMissing','true');
          if (docToken) url.searchParams.set('pageToken', docToken);
          const result = await request(url);
          for (const document of result.documents || []) {
            const path = document.name.split('/documents/')[1];
            if (document.createTime || document.updateTime) {
              raw[path] = document;
              try { documents[path] = Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decodeFirestore(value)])); counts[relative]++; }
              catch (error) { errors.push({ path, reason: error.message }); }
            }
            await walk(`https://firestore.googleapis.com/v1/${document.name}`, depth + 1);
          }
          docToken = result.nextPageToken || '';
        } while (docToken);
      }
      pageToken = listed.nextPageToken || '';
    } while (pageToken);
  }
  await walk(root);
  // Photo URLs and claims are needed to detect Auth-only profile images/roles.
  // Password hashes, salts and refresh tokens are deliberately not exported.
  const authUsers = [];
  let authNext = '';
  do {
    const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(project)}/accounts:batchGet`);
    url.searchParams.set('maxResults','100'); if (authNext) url.searchParams.set('nextPageToken', authNext);
    const result = await request(url);
    for (const u of result.users || []) authUsers.push({ uid: u.localId, email: u.email || '', displayName: u.displayName || '', photoURL: u.photoUrl || '', disabled: u.disabled === true, validSince: u.validSince || null, claims: JSON.parse(u.customAttributes || '{}') });
    authNext = result.nextPageToken || '';
  } while (authNext);
  mkdirSync(dirname(resolve(output)), { recursive: true });
  const snapshot = { formatVersion: 1, project, database, exportedAt: new Date().toISOString(), consistentSnapshot: false, documents, authUsers, counts, discoveredCollections, errors };
  writeFileSync(output, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
  writeFileSync(`${output}.raw.json`, JSON.stringify(raw), { mode: 0o600 });
  console.log(JSON.stringify({ output, documentCount: Object.keys(documents).length, authUserCount: authUsers.length, counts, errors: errors.length }));
  if (errors.length) process.exitCode = 1;
  return snapshot;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2); const arg = (name) => args[args.indexOf(name) + 1];
  exportFirebase({ project: args.includes('--project') ? arg('--project') : '', database: args.includes('--database') ? arg('--database') : '(default)', output: args.includes('--output') ? arg('--output') : '' }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
