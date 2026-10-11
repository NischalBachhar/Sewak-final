import { auth, onSessionChanged, refreshSession, revokeSessions, signIn, signOut } from './authClient';
const response=value=>({ok:true,json:async()=>value});
afterEach(()=>{delete global.fetch;});
test('a delayed session read cannot resurrect an old account after sign-in or logout',async()=>{
 let resolve;global.fetch=jest.fn().mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValueOnce(response({user:{uid:'new'},csrfToken:'new-csrf'})).mockResolvedValueOnce(response({signedOut:true}));
 const old=refreshSession();await signIn('test@example.test','not-persisted-password');resolve(response({user:{uid:'old'}}));await old;expect(auth.currentUser.uid).toBe('new');await signOut();expect(auth.currentUser).toBeNull();expect(localStorage.length).toBe(0);
});
test('logout network failure does not claim server-side revocation',async()=>{global.fetch=jest.fn().mockRejectedValue(new Error('offline'));auth.currentUser={uid:'still-signed-in'};await expect(signOut()).rejects.toThrow('offline');expect(auth.currentUser.uid).toBe('still-signed-in');});
test('a delayed unauthorized session read cannot clear a newer login',async()=>{
 let resolve;global.fetch=jest.fn().mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValueOnce(response({user:{uid:'newer'},csrfToken:'csrf'}));
 const old=refreshSession();await signIn('new@example.test','not-persisted-password');resolve({ok:false,status:401,json:async()=>({error:{code:'unauthenticated'}})});await old;expect(auth.currentUser.uid).toBe('newer');
});

test('a failing startup session read cannot replace a successful login with an error',async()=>{
 let reject;global.fetch=jest.fn().mockImplementationOnce(()=>new Promise((_,r)=>{reject=r;})).mockResolvedValueOnce(response({user:{uid:'current'},csrfToken:'csrf'}));
 const listener=jest.fn(),unsubscribe=onSessionChanged(listener);
 await signIn('current@example.test','not-persisted-password');reject(new Error('old request offline'));await Promise.resolve();await Promise.resolve();
 expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({uid:'current'}));expect(auth.currentUser.uid).toBe('current');unsubscribe();
});

test('a session read started during logout cannot resurrect the revoked account',async()=>{
 let logoutDone,readDone;global.fetch=jest.fn().mockImplementationOnce(()=>new Promise(r=>{logoutDone=r;})).mockImplementationOnce(()=>new Promise(r=>{readDone=r;}));
 const logout=signOut(),read=refreshSession();logoutDone(response({signedOut:true}));await logout;readDone(response({user:{uid:'revoked'},csrfToken:'old'}));await read;
 expect(auth.currentUser).toBeNull();expect(auth.csrfToken).toBeNull();
});

test('revoking the current session invalidates in-flight session refreshes',async()=>{
 let resolve;global.fetch=jest.fn().mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValueOnce(response({signedOut:true}));
 const pending=refreshSession();await revokeSessions();resolve(response({user:{uid:'revoked'}}));await pending;expect(auth.currentUser).toBeNull();
});
