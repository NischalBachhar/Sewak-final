import { decodeRecord } from './model.mjs';
import { canRead, caregiverActive, organizationActive } from './policy.ts';
import { entities, parseResource, Repository, requireActive, requireActor } from './repository.ts';
import { active, badInput, canonicalCategory, pick, requireThat, type Actor, type Data } from './types.ts';

const caregiverPublicKeys = ['name','location','category','workType','shifts','servicesOffered','hourlyRate','experience','bio','jobsCompleted','verified','backgroundChecked','isCertified','isAvailable','organizationId','organizationName','allowZeroRate','identityVerificationStatus','phoneVerificationStatus','trainingVerificationStatus','backgroundVerificationStatus','referencesVerificationStatus'];
function mediaUrl(id: unknown) { return typeof id === 'string' && id ? `/api/media/${encodeURIComponent(id)}` : ''; }
export function withImage(data: Data) {
  const url = mediaUrl(data.profile_image_id);
  return { ...data, profilePicture: url, profileImage: url };
}
function projection(name: string, id: string, data: Data, row: Data): Data {
  if (name === 'publicCaregivers') return { ...pick(data, caregiverPublicKeys), caregiverId: id,
    category: canonicalCategory(data.category), profileImage: mediaUrl(data.profile_image_id), profile_image_id: data.profile_image_id || null,
    isApproved: true, isSuspended: false, isBlacklisted: false, isOrganizationActive: true,
    isAvailable: data.isAvailable === true, allowZeroRate: data.allowZeroRate === true,
    commissionRate: row.org_commission ?? 15, reviewCount: row.verified_count || 0, rating: row.verified_rating || 0 };
  if (name === 'publicServices') return { ...pick(data, ['label','serviceName','category','description','price','isActive','organizationId','organizationName','updatedAt']), serviceId: id, category: canonicalCategory(data.category), label: data.label || data.serviceName, isActive: true };
  return { ...pick(data, ['caregiverId','rating','comment','createdAt','isVerifiedReview']), reviewId: id, reviewerName: 'Verified customer' };
}
const filtersByName: Record<string, string[]> = {
  users: ['role'], organizations: ['isApproved'], organizationApplications: ['status'], vendors: ['organizationId','category','isApproved'],
  publicCaregivers: ['isApproved','isSuspended','isBlacklisted','isOrganizationActive','category','location','isAvailable'],
  bookings: ['userId','caregiverId','organizationId','status'], services: ['organizationId','category'], publicServices: ['category'],
  publicReviews: ['caregiverId'], reviews: ['caregiverId','customerId'], reportReceipts: ['reportedBy'], organizationBlacklist: ['organizationId'],
};
const aliases: Record<string, string> = { publicCaregivers: 'vendors', publicServices: 'services', publicReviews: 'reviews' };

async function scope(repo: Repository, actor: Actor | null, name: string, parent: string | null, conditions: string[], params: any[]) {
  if (aliases[name]) return;
  const user = requireActor(actor);
  if (user.role === 'superadmin' && active(user.profile)) return;
  requireActive(user);
  const add = (sql: string, ...values: any[]) => { conditions.push(sql); params.push(...values); };
  if (name === 'bookings') {
    const roleClauses = ['t.user_id=?']; const values = [user.uid];
    if (user.role === 'caregiver' && await caregiverActive(repo, user.uid, false)) { roleClauses.push('t.caregiver_id=?'); values.push(user.uid); }
    if (user.role === 'orgadmin' && await organizationActive(repo, user.uid, false)) { roleClauses.push('t.organization_id=?'); values.push(user.uid); }
    add(`(${roleClauses.join(' OR ')})`, ...values); return;
  }
  if (['vendors','services','organizationBlacklist'].includes(name)) {
    if (name === 'vendors' && user.role === 'caregiver') { add('t.id=?', user.uid); return; }
    requireThat(user.role === 'orgadmin' && await organizationActive(repo, user.uid, false)); add('t.organization_id=?', user.uid); return;
  }
  if (name === 'reportReceipts') { add('t.reported_by=?', user.uid); return; }
  if (name === 'reviews') { add('(t.customer_id=? OR t.caregiver_id=?)', user.uid, user.uid); return; }
  if (['tasks','updates'].includes(name)) { await canRead(repo, user, `careSessions/${parent}`); return; }
  requireThat(false, 'You cannot list these private records.');
}

export async function queryRecords(repo: Repository, actor: Actor | null, input: Data, single = false) {
  badInput(input && typeof input === 'object' && !Array.isArray(input), 'Invalid query.');
  badInput(Object.keys(input).every((key) => ['path','filters','order','limit','cursor','aggregate'].includes(key)), 'Unsupported query option.');
  const { name, spec: requestedSpec, parent, id } = parseResource(input.path);
  requireThat(!requestedSpec.serverOnly);
  badInput(single ? id : !id, 'Invalid query path.');
  const source = aliases[name] || name;
  const spec = entities[source];
  const params: any[] = [];
  const conditions: string[] = [];
  const joins: string[] = [];
  let extraColumns = '';
  if (name === 'publicCaregivers') {
    joins.push('LEFT JOIN organizations o ON o.id=t.organization_id LEFT JOIN users u ON u.id=t.id');
    conditions.push('t.is_approved=1 AND COALESCE(t.is_suspended,0)=0 AND COALESCE(t.is_blacklisted,0)=0 AND COALESCE(u.is_suspended,0)=0 AND COALESCE(u.is_blacklisted,0)=0 AND (t.organization_id IS NULL OR (o.is_approved=1 AND COALESCE(o.is_suspended,0)=0 AND COALESCE(o.is_blacklisted,0)=0))');
    extraColumns = ',o.commission_rate AS org_commission,(SELECT COUNT(*) FROM reviews r WHERE r.caregiver_id=t.id AND r.is_verified_review=1 AND COALESCE(r.is_hidden,0)=0) AS verified_count,(SELECT AVG(r.rating) FROM reviews r WHERE r.caregiver_id=t.id AND r.is_verified_review=1 AND COALESCE(r.is_hidden,0)=0) AS verified_rating';
  } else if (name === 'organizations') extraColumns = ',(SELECT COUNT(*) FROM caregivers c WHERE c.organization_id=t.id) AS current_caregiver_count';
  else if (name === 'publicServices') conditions.push('COALESCE(t.is_active,1)=1 AND (t.organization_id IS NULL OR EXISTS (SELECT 1 FROM organizations o WHERE o.id=t.organization_id AND o.is_approved=1 AND COALESCE(o.is_suspended,0)=0 AND COALESCE(o.is_blacklisted,0)=0))');
  else if (name === 'publicReviews') conditions.push('t.is_verified_review=1 AND COALESCE(t.is_hidden,0)=0');
  if (single && !aliases[name]) await canRead(repo, actor, input.path);
  else await scope(repo, actor, name, parent, conditions, params);
  if (parent) { conditions.push('t.session_id=?'); params.push(parent); }
  if (single) { conditions.push('t.id=?'); params.push(parent ? `${parent}/${id}` : id); }
  badInput(!input.filters || Array.isArray(input.filters) && input.filters.length <= 8, 'Too many filters.');
  for (const filter of input.filters || []) {
    const { field, op, value } = filter;
    badInput(typeof field === 'string' && (field === '__name__' || filtersByName[name]?.includes(field)) && ['==','in'].includes(op), 'Unsupported filter.');
    if (name === 'publicCaregivers' && ['isApproved','isSuspended','isBlacklisted','isOrganizationActive'].includes(field)) {
      badInput(value === ['isApproved','isOrganizationActive'].includes(field), 'Invalid public visibility filter.'); continue;
    }
    const column = field === '__name__' ? 'id' : spec.fields[field]?.column;
    badInput(column, 'Unsupported field.');
    const values = op === 'in' ? value : [value];
    badInput(Array.isArray(values) && values.length > 0 && values.length <= 30 && values.every((v) => ['string','boolean','number'].includes(typeof v) && String(v).length <= 160), 'Invalid filter value.');
    conditions.push(`t."${column}" IN (${values.map(() => '?').join(',')})`);
    params.push(...values.map((v: any) => typeof v === 'boolean' ? Number(v) : v));
  }
  const base = `FROM ${spec.table} t ${joins.join(' ')} WHERE ${conditions.length ? conditions.join(' AND ') : '1=1'}`;
  if (input.aggregate) {
    requireThat(name === 'bookings' && actor, 'Aggregates are only available for authorized bookings.');
    badInput(!input.cursor && !input.order && Object.keys(input.aggregate).length <= 5, 'Invalid aggregate.');
    const aggregates = Object.entries(input.aggregate).map(([key, value]: [string, any]) => {
      badInput(/^[a-zA-Z]{1,24}$/.test(key) && ['count','sum'].includes(value.op), 'Invalid aggregate.');
      badInput(value.op === 'count' || ['totalAmount','vendorEarnings'].includes(value.field), 'Unsupported aggregate field.');
      return `${value.op === 'count' ? 'COUNT(*)' : `COALESCE(SUM(t."${spec.fields[value.field].column}"),0)`} AS "${key}"`;
    });
    return { aggregate: await repo.env.DB.prepare(`SELECT ${aggregates.join(',')} ${base}`).bind(...params).first() };
  }
  const order = input.order || { field: '__name__', direction: 'asc' };
  badInput(['__name__','createdAt'].includes(order.field) && ['asc','desc'].includes(order.direction), 'Unsupported sort.');
  const sort = order.field === '__name__' ? 'id' : 'created_at';
  const sortExpression = sort === 'id' ? 't.id' : 'COALESCE(t.created_at,\'\')';
  const size = single ? 1 : input.limit ?? 50;
  badInput(Number.isInteger(size) && size >= 1 && size <= 50, 'Page size must be 1–50.');
  let cursorClause = '';
  if (input.cursor) {
    badInput(typeof input.cursor.id === 'string' && input.cursor.id.length <= 330 && typeof input.cursor.value === 'string' && input.cursor.value.length <= 330, 'Invalid cursor.');
    const operator = order.direction === 'asc' ? '>' : '<';
    cursorClause = ` AND (${sortExpression},t.id) ${operator} (?,?)`;
    params.push(input.cursor.value, input.cursor.id);
  }
  const columns = ['t.id','t.version','t.fields_present','t.extra_json', ...Object.values(spec.fields).map((f: any) => `t."${f.column}"`)];
  badInput(params.length <= 98, 'Too many query parameters.');
  const sql = `SELECT ${columns.join(',')}${extraColumns} ${base}${cursorClause} ORDER BY ${sortExpression} ${order.direction},t.id ${order.direction} LIMIT ?`;
  params.push(size + (single ? 0 : 1));
  const result = await repo.env.DB.prepare(sql).bind(...params).all<Data>();
  const page = result.results.slice(0, size);
  const items = page.map((row) => {
    const record = decodeRecord(source, row)!;
    if (name === 'organizations') record.totalCaregivers = row.current_caregiver_count;
    if (parent) delete record.sessionId;
    const docId = parent ? row.id.slice(parent.length + 1) : row.id;
    return { id: docId, path: single ? input.path : `${input.path}/${docId}`, version: row.version,
      data: aliases[name] ? projection(name, row.id, record, row) : ['users','vendors'].includes(name) ? withImage(record) : record,
      cursor: { id: row.id, value: row[sort] ?? '' } };
  });
  return { items, nextCursor: result.results.length > size ? items.at(-1)?.cursor : null };
}
