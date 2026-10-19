import { readSavedCare, savedCareKey, toggleSavedCare } from './savedCareStore';
describe('saved caregivers on this device', () => {
  beforeEach(() => localStorage.clear());
  test('isolates profile IDs for each user and toggles cleanly', () => {
    expect(toggleSavedCare('customer-A', 'caregiver-1')).toBe(true);
    expect(readSavedCare('customer-A')).toEqual(['caregiver-1']);
    expect(readSavedCare('customer-B')).toEqual([]);
    expect(toggleSavedCare('customer-A', 'caregiver-1')).toBe(false);
    expect(readSavedCare('customer-A')).toEqual([]);
  });
  test('ignores corrupt data and invalid IDs', () => {
    localStorage.setItem(savedCareKey('customer'), '{bad');
    expect(readSavedCare('customer')).toEqual([]);
    expect(toggleSavedCare('customer', '../other')).toBe(false);
    expect(readSavedCare('customer')).toEqual([]);
  });
});
