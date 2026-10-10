import assert from 'node:assert/strict';
import {OWNER} from './superadmin-recovery-core.mjs';

export async function verifyOwnerLogin(DB,uid,password,fetchImpl=fetch,base='https://sewak-final.nischalbachhar9.workers.dev') {
  const request=(path,body,token)=>fetchImpl(base+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(30000),
    headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  const response=await request('/auth/login',{email:OWNER.email,password,sessionMode:'bearer'});
  if(!response.ok)throw new Error('Application login verification failed.');
  const login=await response.json();
  try {
    assert.ok(login.user?.uid===uid&&login.user?.role==='superadmin','Unexpected authenticated identity.');
    const admin=await request('/api/query',{path:'users',limit:1},login.token);
    assert.ok(admin.ok,'Super Admin authorization verification failed.');
    const logout=await request('/auth/logout',{},login.token);
    assert.ok(logout.ok,'Verification logout failed.');
  } finally {
    // Also revoke on an authorization/network failure. Never retain a CLI session.
    if(login.session?.id)await DB.prepare('DELETE FROM cf_sessions WHERE id=? AND user_id=?').bind(login.session.id,uid).run();
    login.token='';
  }
  return {loginVerified:true,authorizationVerified:true,verificationSessionRevoked:true};
}
