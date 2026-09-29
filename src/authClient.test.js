import { auth, refreshSession, signIn, signOut } from './authClient';
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
