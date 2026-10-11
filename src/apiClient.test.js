import { apiRequest } from './apiClient';
import { auth } from './authClient';

const ok = (items=[]) => ({ok:true,json:async()=>({items,total:items.length})});
afterEach(()=>{delete global.fetch;auth.currentUser=null;auth.csrfToken=null;});

test('public caregiver discovery never sends a stale secure-session cookie or CSRF token',async()=>{
  auth.currentUser={uid:'expired-profile'};
  auth.csrfToken='stale-csrf';
  global.fetch=jest.fn().mockResolvedValue(ok([{id:'public-1'}]));
  const result=await apiRequest('/api/query',{method:'POST',json:{path:'publicCaregivers',search:{},limit:12}});
  expect(result.items).toHaveLength(1);
  const init=global.fetch.mock.calls[0][1];
  expect(init.credentials).toBe('omit');
  expect(init.headers.has('X-CSRF-Token')).toBe(false);
});
test('public service and review projections are anonymous while private paths remain authenticated',async()=>{
  auth.currentUser={uid:'customer'};
  auth.csrfToken='real-csrf';
  global.fetch=jest.fn().mockResolvedValue(ok());
  await apiRequest('/api/query',{method:'POST',json:{path:'publicServices',limit:12}});
  await apiRequest('/api/query',{method:'POST',json:{path:'publicReviews',limit:12}});
  await apiRequest('/api/query',{method:'POST',json:{path:'bookings',limit:12}});
  await apiRequest('/api/records/publicCaregivers/test-id');
  await apiRequest('/api/records/users/customer');
  expect(global.fetch.mock.calls.map(call=>call[1].credentials))
    .toEqual(['omit','omit','same-origin','omit','same-origin']);
  expect(global.fetch.mock.calls[2][1].headers.get('X-CSRF-Token')).toBe('real-csrf');
  expect(global.fetch.mock.calls[4][1].headers.get('X-CSRF-Token')).toBe('real-csrf');
});
test('public status cannot be faked by a private path or requested credential option',async()=>{
  auth.currentUser={uid:'admin'};
  global.fetch=jest.fn().mockResolvedValue(ok());
  await apiRequest('/api/query',{method:'POST',json:{path:'organizationApplications',limit:1},credentials:'omit'});
  expect(global.fetch.mock.calls[0][1].credentials).toBe('same-origin');
});
