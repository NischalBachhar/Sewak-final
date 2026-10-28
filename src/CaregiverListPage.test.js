import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CaregiverListPage from './CaregiverListPage';
import { loadPublicCareServices, searchCaregivers } from './caregiverDiscovery';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));
jest.mock('./caregiverDiscovery', () => ({
  ...jest.requireActual('./caregiverDiscovery'),
  loadPublicCareServices: jest.fn(), searchCaregivers: jest.fn(),
}));

beforeEach(() => {
  loadPublicCareServices.mockResolvedValue([{ id: 'care', label: 'Care support', category: 'caregiver' }]);
  searchCaregivers.mockReset();
});

test('a pending filtered search shows loading rather than incorrectly claiming there are no caregivers', async () => {
  searchCaregivers.mockReturnValue(new Promise(() => {}));
  render(<CaregiverListPage variant="browse" requireLogin preselectedService="care" preselectedLocation="Hetauda" />);
  expect(screen.getByLabelText('Loading caregiver profiles')).toBeVisible();
  expect(screen.getByText('Searching…')).toBeVisible();
  expect(screen.queryByText('No caregivers match this search')).toBeNull();
  await waitFor(() => expect(searchCaregivers).toHaveBeenCalled());
});

test('returning to browse restores all saved preferences in the next real query', async () => {
  searchCaregivers.mockResolvedValue({ items: [], total: 0, nextCursor: null });
  render(<CaregiverListPage variant="browse" requireLogin preselectedService="care" preselectedLocation="Hetauda"
    preselectedText="Maya" preselectedWorkType="parttime" preselectedShift="morning"
    preselectedExperience={2} preselectedRating={4} preselectedVerified />);
  await waitFor(() => expect(searchCaregivers).toHaveBeenLastCalledWith({
    text: 'Maya', category: '', serviceId: 'care', workType: 'parttime', shift: 'morning', location: 'Hetauda',
    minimumExperience: 2, minimumRating: 4, verifiedOnly: true,
  }, { limit: 12 }));
  expect(await screen.findByText('No caregivers match this search')).toBeVisible();
  expect(screen.getByRole('searchbox', { name: 'Search caregivers by name' })).toHaveValue('Maya');
});

test('clearing an empty search keeps the filter form and expanded preferences mounted during loading', async () => {
  searchCaregivers.mockResolvedValue({ items: [], total: 0, nextCursor: null });
  render(<CaregiverListPage variant="browse" requireLogin preselectedLocation="Hetauda" />);
  await screen.findByText('No caregivers match this search');
  fireEvent.click(screen.getByText('More filters'));
  const search = screen.getByRole('searchbox', { name: 'Search caregivers by name' });
  const rating = screen.getByRole('combobox', { name: 'Verified rating', exact: true });
  searchCaregivers.mockReturnValue(new Promise(() => {}));
  fireEvent.click(screen.getByRole('button', { name: 'Clear all', exact: true }));
  expect(screen.getByRole('searchbox', { name: 'Search caregivers by name' })).toBe(search);
  expect(screen.getByRole('combobox', { name: 'Verified rating', exact: true })).toBe(rating);
  expect(screen.getByText('Searching…')).toBeVisible();
  expect(screen.queryByText('No caregivers match this search')).toBeNull();
});
