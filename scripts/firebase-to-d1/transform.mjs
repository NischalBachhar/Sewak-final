import { createHash } from 'node:crypto';
import { entities, resource, encodeRecord } from '../../worker/src/model.mjs';
export const canonicalJSON = (value) => JSON.stringify(sort(value));
function sort(value) { return Array.isArray(value) ? value.map(sort) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key)=>[key,sort(value[key])])) : value; }
export const hashRecord = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
export function convert(value, key = '') {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`Non-finite number at ${key}`);
    if (typeof value === 'string' && /^data:image\//i.test(value)) throw new Error(`Image data URL at ${key} requires separate image migration, never main-D1 storage`);
    return value;
  }
  if (Array.isArray(value)) return value.map((v)=>convert(v,key));
  if (value.__timestamp !== undefined) {
    if (Number.isNaN(new Date(value.__timestamp).getTime())) throw new Error(`Invalid timestamp at ${key}`);
    return value.__timestamp; // preserve original fractional precision and UTC value
  }
  if (value.__reference !== undefined) return { __reference: value.__reference };
  if (value.__geopoint !== undefined) return { latitude: value.__geopoint.latitude, longitude: value.__geopoint.longitude };
  if (value.__unsupportedBytes || value.__integer !== undefined || value.__number !== undefined) throw new Error(`Unsupported binary or out-of-range numeric field at ${key}; raw backup preserved`);
  return Object.fromEntries(Object.entries(value).map(([k,v]) => {
    if (/password|private.?key|secret|refresh.?token/i.test(k)) throw new Error(`Secret field ${k} requires separate review; it is not copied to D1`);
    return [k,convert(v,`${key}.${k}`)];
  }));
}
export function migrationPlan(snapshot) {
  const failures = [...(snapshot.errors || [])], warnings = [], records = [];
  const paths = new Set(Object.keys(snapshot.documents));
  for (const [path, original] of Object.entries(snapshot.documents)) {
    try {
      const { name, spec, key, parent } = resource(path);
      if (!key) throw new Error('Expected a document path');
      const data = convert(original);
      // Resolve typed references only when their relationship is known. Keep
      // complete unknown/nested reference paths, rather than losing their
      // collection/project by reducing everything to its last path segment.
      for(const [field,targetTable] of Object.entries(spec.relations || {})) {
        if(!data[field]?.__reference)continue;
        const targetCollection=Object.keys(entities).find(n=>entities[n].table===targetTable);
        const reference=data[field].__reference;
        const prefix=`projects/${snapshot.project}/databases/${snapshot.database || '(default)'}/documents/`;
        if(reference.startsWith('projects/')&&!reference.startsWith(prefix))throw new Error(`Cross-project/database reference in ${field} requires explicit mapping`);
        const relative=reference.startsWith(prefix)?reference.slice(prefix.length):reference;
        if(!relative.startsWith(`${targetCollection}/`)||relative.split('/').length!==2)throw new Error(`Unexpected reference target in ${field}`);
        data[field]=relative.split('/')[1];
      }
      // No new roles or synthetic users are inferred from names or email.
      const encoded = encodeRecord(name,key,{...data,...(parent ? {sessionId:parent} : {})});
      const extra = JSON.parse(encoded.extra_json);
      for (const [field, targetTable] of Object.entries(spec.relations || {})) {
        const relatedId = data[field] || (field === 'sessionId' ? parent : null);
        if (!relatedId) continue;
        const targetCollection = Object.keys(entities).find((n)=>entities[n].table === targetTable);
        if (!paths.has(`${targetCollection}/${relatedId}`)) {
          // Historical bookings can outlive a deleted catalog item. Preserve
          // that exact original identifier for display, but do not invent a
          // service row or claim that its old catalog relationship is valid.
          if (name === 'bookings' && field === 'serviceId' && ['completed','cancelled'].includes(data.status)) {
            encoded[spec.fields[field].column] = null; extra[field] = relatedId;
            warnings.push({ path, field, reason:'Historical service reference has no source catalog record; exact ID preserved in legacy metadata, relational link NULL.' });
          } else throw new Error(`Missing ${field} relationship to ${targetCollection}/${relatedId}`);
        }
      }
      if (name === 'vendors') for (const id of data.servicesOffered || []) if (!paths.has(`services/${id}`)) throw new Error(`Offered service ${id} has no source record`);
      if (name === 'vendors' && !(data.servicesOffered || []).length) warnings.push({path,field:'servicesOffered',reason:'No services are assigned in Firebase; new bookings require genuine service configuration.'});
      encoded.extra_json = JSON.stringify(extra);
      if (Object.values(data).some((v)=>typeof v === 'string' && v.startsWith('data:image/'))) throw new Error('Image data URL requires separate image migration, never main-D1 storage');
      records.push({path,name,key,data,encoded,hash:hashRecord(data)});
    } catch (error) { failures.push({path,reason:error.message}); }
  }
  return { records, warnings, failures, sourceCount:Object.keys(snapshot.documents).length };
}
