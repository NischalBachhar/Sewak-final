import { epoch, invitationStatement } from './cloudflare-auth.ts';
import { caregiverActive, organizationActive, validateServices } from './policy.ts';
import { Repository, requireActive, requireAdmin, type Write } from './repository.ts';
import { active, ApiError, badInput, canonicalCategory, nowISO, onlyKeys, requireThat, textField, type Actor, type Data, type Env } from './types.ts';

const accountInput = (input: Data, caregiver: boolean, organization: boolean) => {
  const keys = ['email','displayName', ...(caregiver ? ['phone','location','category','workType','shifts','servicesOffered','hourlyRate','experience'] : organization ? ['organizationName','businessPhone','businessAddress','businessCity'] : [])];
  onlyKeys(input, keys);
  const email = textField(input.email, 'Email', 3, 254).toLowerCase();
  badInput(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Invalid email.');
  const data: Data = { email, displayName: textField(input.displayName, 'Name', 2, 120) };
  for (const field of keys.filter((k) => !['email','displayName','hourlyRate','experience','servicesOffered','shifts'].includes(k))) data[field] = textField(input[field] ?? '', field, ['organizationName','phone','location'].includes(field) ? 2 : 0, field === 'businessAddress' ? 300 : 160);
  if (caregiver) {
    data.category = canonicalCategory(data.category);
    badInput(['caregiver','vendor','both'].includes(data.category) && ['parttime','fulltime'].includes(data.workType), 'Invalid caregiver work category.');
    badInput(Number.isInteger(input.experience) && input.experience >= 0 && input.experience <= 80 && typeof input.hourlyRate === 'number' && input.hourlyRate >= 0 && input.hourlyRate <= 1000000, 'Invalid rate or experience.');
    for (const key of ['shifts','servicesOffered']) {
      const values = input[key] || [];
      badInput(Array.isArray(values) && values.length <= (key === 'shifts' ? 3 : 20) && new Set(values).size === values.length && values.every((v) => typeof v === 'string' && v.length <= 120 && !v.includes('/')), `Invalid ${key}.`);
      data[key] = values;
    }
    badInput(data.shifts.every((s: string) => ['morning','day','night'].includes(s)) && (data.workType !== 'fulltime' || data.shifts.length === 0), 'Invalid shifts.');
    data.hourlyRate = input.hourlyRate; data.experience = input.experience;
  }
  return data;
};
const audit = (actor: Actor, action: string, target: string, extra: Data = {}): Write => ({ path: `adminAuditLogs/${crypto.randomUUID()}`, data: { actorUid: actor.uid, action, targetUid: target, createdAt: nowISO(), ...extra } });

async function provision(repo: Repository, actor: Actor | null, operation: string, input: Data) {
  const caregiver=operation==='provisionCaregiverAccount',organization=operation==='provisionOrganizationAccount';
  const user=caregiver?requireActive(actor):requireAdmin(actor),org=caregiver?await repo.data('organizations/'+user.uid):null;
  if(caregiver)requireThat(user.role==='orgadmin'&&org?.adminUid===user.uid&&org.verified===true&&await organizationActive(repo,user.uid));
  const data=accountInput(input,caregiver,organization);
  if(caregiver)await validateServices(repo,data.servicesOffered,user.uid,data.category);
  const role=caregiver?'caregiver':organization?'orgadmin':'superadmin',now=nowISO();
  const current=await repo.env.DB.prepare('SELECT user_id,password_hash,disabled FROM cf_credentials WHERE email=?').bind(data.email).first<Data>();
  const uid=current?.user_id||'usr_'+crypto.randomUUID();
  if(current){const profile=await repo.data('users/'+uid);requireThat(!current.disabled&&!current.password_hash&&active(profile)&&profile?.role===role&&profile?.roleAssignedBy===user.uid,'An account already exists for this email.',409,'account-exists');const invite=await invitationStatement(repo.env,uid,user.uid);await repo.commit([], [repo.env.DB.prepare('DELETE FROM cf_invitations WHERE user_id=? AND used_at IS NULL').bind(uid),invite.statement]);return {uid,email:data.email,role,invitation:{delivery:'manual',activationToken:invite.token}};}
    const profile: Data = { uid, name: data.displayName, email: data.email, role, roleSource: 'd1', profileComplete: !organization, isApproved: role === 'superadmin', isSuspended: false, isBlacklisted: false, createdAt: now, roleAssignedBy: user.uid };
    const writes: Write[] = [];
    if (caregiver) Object.assign(profile, { phone: data.phone, organizationId: user.uid, organizationName: org!.organizationName, addedBy: user.uid });
    writes.push({ path: `users/${uid}`, data: profile });
    if (organization) writes.push({ path: `organizations/${uid}`, data: { organizationId: uid, adminUid: uid, adminName: data.displayName, adminEmail: data.email, organizationName: data.organizationName, businessPhone: data.businessPhone, businessAddress: data.businessAddress, businessCity: data.businessCity, commissionRate: 15, role, isApproved: false, verified: false, isSuspended: false, isBlacklisted: false, profileComplete: false, createdAt: now } });
    if (caregiver) {
      writes.push({ path: `vendors/${uid}`, data: { ...data, displayName: undefined, uid, vendorId: uid, name: data.displayName, organizationId: user.uid, organizationName: org!.organizationName, bio: '', isApproved: false, isAvailable: false, isSuspended: false, isBlacklisted: false, verified: false, backgroundChecked: false, isCertified: false, rating: 0, reviewCount: 0, jobsCompleted: 0, createdAt: now } });
      // Counts are derived in list responses, not a growing membership array.
    }
    writes.push(audit(user, `${role}_account_provisioned`, uid));

  const invite=await invitationStatement(repo.env,uid,user.uid);
  try{await repo.commit(writes,[repo.env.DB.prepare('INSERT INTO cf_credentials(user_id,email,password_hash,created_at) VALUES(?,?,NULL,?)').bind(uid,data.email,epoch()),invite.statement]);}catch(e){if(e instanceof ApiError&&e.code==='already-exists')throw new ApiError(409,'account-exists','An account already exists for this email.');throw e;}
  return {uid,email:data.email,role,isApproved:role==='superadmin',invitation:{delivery:'manual',activationToken:invite.token}};
}

async function approve(repo: Repository, actor: Actor | null, operation: string, input: Data) {
  const user = requireAdmin(actor), applicationMode = operation === 'approveOrganizationApplication';
  onlyKeys(input, [applicationMode ? 'applicationId' : 'organizationId']);
  const id = textField(input[applicationMode ? 'applicationId' : 'organizationId'], 'Organization ID', 1, 128);
  const application = applicationMode ? await repo.data(`organizationApplications/${id}`) : null;
  if (applicationMode) requireThat(application && ['pending','approved'].includes(application.status) && application.applicantId === id, 'This application is not pending.');
  const org = await repo.data(`organizations/${id}`), profile = await repo.data(`users/${id}`);
  requireThat(active(profile) && (!org || active(org)), 'Blocked or missing accounts cannot be approved.');
  requireThat(applicationMode ? ['user','orgadmin'].includes(profile!.role || 'user') : profile!.role === 'orgadmin' && org?.adminUid === id, 'The organization account is inconsistent.');
  const now = nowISO();
  const writes: Write[] = [
    { path: `organizations/${id}`, data: { ...(org || {}), organizationId: id, adminUid: id, organizationName: org?.organizationName || application!.organizationName, adminName: org?.adminName || application!.applicantName, adminEmail: org?.adminEmail || application!.applicantEmail, ...(org ? {} : { businessPhone: application!.businessPhone || '', businessAddress: application!.businessAddress || '', businessCity: application!.businessCity || '', commissionRate: 15, createdAt: now }), role: 'orgadmin', isApproved: true, verified: true, approvedAt: now, approvedBy: user.uid, updatedAt: now } },
    { path: `users/${id}`, data: { ...profile!, uid: id, role: 'orgadmin', organizationId: id, organizationName: org?.organizationName || application!.organizationName, isApproved: true, verified: true, updatedAt: now } },
    audit(user, 'organization_approved', id),
  ];
  if (applicationMode) writes.push({ path: `organizationApplications/${id}`, data: { ...application!, status: 'approved', approvedAt: now, approvedBy: user.uid } });
  await repo.commit(writes);
  return { organizationId: id, approved: true };
}

async function blockAccount(repo: Repository, actor: Actor | null, input: Data) {
  const user = requireAdmin(actor);
  onlyKeys(input,['targetType','targetId','reason','reportId']);
  badInput(['organization','caregiver','customer'].includes(input.targetType), 'Invalid target type.');
  const id = textField(input.targetId,'Account ID',1,128), reason = textField(input.reason,'Reason',3,1000);
  requireThat(id !== user.uid, 'You cannot restrict your own administrator account.');
  const path = `${input.targetType === 'organization' ? 'organizations' : input.targetType === 'caregiver' ? 'vendors' : 'users'}/${id}`;
  const target = await repo.data(path), profile = await repo.data(`users/${id}`);
  requireThat(target && profile?.role !== 'superadmin', 'This target cannot be restricted.');
  requireThat(input.targetType !== 'customer' || !profile?.role || profile.role === 'user', 'This target is not a customer.');
  const now = nowISO(), block = { isSuspended: true, isBlacklisted: true, blacklistReason: reason, blacklistedAt: now, blacklistedBy: user.uid, updatedAt: now };
  const byPath = new Map<string, Write>();
  byPath.set(path, { path, data: { ...target!, ...block, ...(input.targetType !== 'customer' ? { isApproved: false } : {}) } });
  if (profile) byPath.set(`users/${id}`, { path: `users/${id}`, data: { ...profile, ...block, tokensValidAfter: Math.floor(Date.now()/1000) + 1 } });
  const writes = [...byPath.values(), { path: `blacklist/${id}`, data: { userId: id, userType: input.targetType, reason, blacklistedBy: user.uid, createdAt: now } }, audit(user,'account_safety_action_applied',id,{ targetType: input.targetType })];
  if (input.reportId) {
    requireThat(input.targetType === 'customer');
    const report = await repo.data(`blacklistReports/${input.reportId}`);
    requireThat(report?.userId === id && ['pending','approved'].includes(report.status), 'Report does not match this customer.');
    writes.push({ path: `blacklistReports/${input.reportId}`, data: { ...report!, status: 'approved', approvedAt: now, approvedBy: user.uid } });
    const receipt = await repo.data(`reportReceipts/${input.reportId}`);
    if (receipt) writes.push({ path: `reportReceipts/${input.reportId}`, data: { ...receipt, status: 'approved' } });
  }
  const statements=[repo.env.DB.prepare('UPDATE cf_credentials SET disabled=1,credential_version=credential_version+1 WHERE user_id=?').bind(id),repo.env.DB.prepare('DELETE FROM cf_sessions WHERE user_id=?').bind(id)];
  if(input.targetType==='organization'){
    statements.push(repo.env.DB.prepare('UPDATE cf_credentials SET disabled=1,credential_version=credential_version+1 WHERE user_id IN (SELECT id FROM caregivers WHERE organization_id=?)').bind(id));
    statements.push(repo.env.DB.prepare('DELETE FROM cf_sessions WHERE user_id IN (SELECT id FROM caregivers WHERE organization_id=?)').bind(id));
  }
  await repo.commit(writes,statements);
  return {targetId:id,authRevocationStatus:'complete',caregiverCascadeStatus:'complete',caregiverAuthRevocationDeferred:false,remaining:0};
}
export async function processAuthOperations(_env: Env){return {remaining:0};}

export async function runAction(repo: Repository, actor: Actor | null, operation: string, input: Data) {
  if (operation === 'createAccountRecoveryInvitation') {
    const admin=requireAdmin(actor);onlyKeys(input,['targetUid']);
    requireThat(epoch()-admin.authTime<300,'Sign in again before issuing account recovery.',401,'recent-login-required');
    const uid=textField(input.targetUid,'Account ID',1,128),profile=await repo.data('users/'+uid);
    const account=await repo.env.DB.prepare('SELECT disabled,credential_version FROM cf_credentials WHERE user_id=?').bind(uid).first<Data>();
    requireThat(account&&!account.disabled&&active(profile),'This account cannot receive recovery.',400,'invalid-account');
    const invitation=await invitationStatement(repo.env,uid,admin.uid,'recover',account.credential_version);
    await repo.commit([audit(admin,'account_recovery_issued',uid)],[repo.env.DB.prepare('DELETE FROM cf_invitations WHERE user_id=? AND used_at IS NULL').bind(uid),invitation.statement]);
    return {invitation:{delivery:'manual',activationToken:invitation.token}};
  }
  if (['provisionOrganizationAccount','provisionCaregiverAccount','provisionSuperAdminAccount'].includes(operation)) return provision(repo,actor,operation,input);
  if (['approveOrganizationAccount','approveOrganizationApplication'].includes(operation)) return approve(repo,actor,operation,input);
  if (operation === 'applyAccountSafetyAction') return blockAccount(repo,actor,input);
  if (operation === 'processAccountOperations') { requireAdmin(actor); onlyKeys(input,[]); return processAuthOperations(repo.env); }
  if (operation === 'backfillPublicCaregivers' || operation === 'backfillPublicServices' || operation === 'backfillPublicReviews') {
    requireAdmin(actor); onlyKeys(input,[]); return { automatic: true, message: 'Public listings are derived from current approved records.' };
  }
  if (operation === 'verifyFonepayPayment') { requireActive(actor); throw new ApiError(503,'failed-precondition','Online payment verification is not configured. Cash bookings remain available.'); }
  throw new ApiError(404,'not-found','Unknown operation.');
}
