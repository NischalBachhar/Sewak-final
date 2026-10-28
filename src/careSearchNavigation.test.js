import { careSearchPath, careSearchReturnPath, readCareSearch } from './careSearchNavigation';

test('public filter URLs round-trip the selected service, city and advanced choices', () => {
  const filters = { serviceId: 'elderly', category: 'caregiver', location: 'Jeetpur Simara', text: 'Maya', workType: 'parttime', shift: 'morning', minimumExperience: 2, minimumRating: 4.5, verifiedOnly: true };
  const url = careSearchPath('/browse', filters, 'browse-caregiver-results');
  expect(readCareSearch(url.split('?')[1].split('#')[0])).toEqual(filters);
  expect(url).toContain('location=Jeetpur+Simara');
  expect(url.endsWith('#browse-caregiver-results')).toBe(true);
});

test('invalid filters and unknown query parameters never enter a saved search', () => {
  expect(readCareSearch('?category=admin&workType=fulltime&shift=night&minimumRating=6&minimumExperience=-1&verifiedOnly=false&redirect=https://example.com')).toEqual({ workType: 'fulltime' });
  expect(careSearchPath('/browse', { serviceId: 'care', verifiedOnly: false, minimumExperience: 0, redirect: '/superadmin' })).toBe('/browse?service=care');
});

test('return navigation only accepts local care result pages', () => {
  for (const value of ['https://example.com', '//example.com', '/auth', '/superadmin', '/browse/../../auth', null]) {
    expect(careSearchReturnPath(value)).toBe('/browse');
  }
  expect(careSearchReturnPath('/user?service=care')).toBe('/browse');
  expect(careSearchReturnPath('/user?service=care', true)).toBe('/user?service=care');
  expect(careSearchReturnPath('/?service=care&location=Hetauda#home-caregiver-results-heading')).toBe('/?service=care&location=Hetauda#home-caregiver-results-heading');
});
