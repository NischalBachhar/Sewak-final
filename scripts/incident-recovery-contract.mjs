// One narrowly scoped production-outage recovery contract.
// This never changes the normal production deployment QA requirements.
export const INCIDENT_VERSION='750f1bb7-7bfd-43a8-89d2-f87cb90ab9c6';
const maxAge=30*60_000;
export function assertIncidentRecovery({validation,failedQa,prepared,liveVersion,gitSha,now=Date.now()}) {
  const must=(condition,message)=>{if(!condition)throw new Error(message);};
  const recent=(stamp)=>typeof stamp==='string'&&Number.isFinite(Date.parse(stamp))&&Date.parse(stamp)<=now+60_000&&now-Date.parse(stamp)<maxAge;
  must(liveVersion===INCIDENT_VERSION,'Production version changed; incident recovery no longer applies.');
  must(prepared?.worker==='sewak-final'&&prepared?.version===INCIDENT_VERSION&&prepared.gitSha===gitSha&&recent(prepared.preparedAt),'Run fresh incident --prepare against the matching release commit.');
  must(typeof prepared?.bookmarks?.DB==='string'&&prepared.bookmarks.DB.length>0&&typeof prepared?.bookmarks?.MEDIA_DB==='string'&&prepared.bookmarks.MEDIA_DB.length>0,'Both D1 Time Travel bookmarks are required.');
  must(validation?.pass===true&&validation?.worker==='sewak-final'&&validation.version===INCIDENT_VERSION&&
    validation.backend==='cloudflare-d1'&&recent(validation.checkedAt)&&validation.health?.healthy===true&&validation.health?.writesEnabled===true&&validation.health?.auth==='cloudflare-d1','Current passing production D1 evidence is required.');
  for (const key of ['DB','MEDIA_DB']) must(validation.checks?.[key]?.integrity==='ok'&&validation.checks[key].foreignKeyViolations===0,key+' integrity must pass.');
  must(failedQa?.worker==='sewak-final'&&failedQa?.version===INCIDENT_VERSION&&failedQa?.auth==='cloudflare-d1'&&failedQa?.qaMode==='production-write-enabled'&&
    failedQa?.pass===false&&failedQa?.cleanupVerified===true&&failedQa?.applicationRecordsUnchanged===true&&
    !failedQa.cleanupFailure&&recent(failedQa.completedAt),'Recent failing Auth QA with verified synthetic cleanup is required.');
  const message=failedQa.failure?.message||'';
  must(typeof message==='string'&&message.includes('create synthetic user: HTTP 503 delivery-unavailable'),'Only the verified email-delivery outage qualifies for this recovery.');
  must(failedQa.checks?.some(c=>c.label==='create synthetic user'&&c.status===503),'Expected registration HTTP 503 evidence is missing.');
  return true;
}
