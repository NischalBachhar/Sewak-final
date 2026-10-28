import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HomePage from '../HomePage';
import HomeCaregiverMarketplace from './HomeCaregiverMarketplace';
import { loadPublicCareServices, searchCaregivers } from '../caregiverDiscovery';

const mockNavigate = jest.fn();
let mockLocation = { search: '', hash: '' };
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));
jest.mock('./PublicHeader', () => () => null);
jest.mock('./ServiceSelector', () => ({
  loadServiceOptions: () => Promise.resolve([
    { id: 'care', label: 'Elderly Care', category: 'caregiver' },
  ]),
}));
jest.mock('../caregiverDiscovery', () => ({
  ...jest.requireActual('../caregiverDiscovery'),
  searchCaregivers: jest.fn(), loadPublicCareServices: jest.fn(),
}));
jest.mock('./ProfileImage', () => ({ __esModule: true, default: ({ alt }) => <span>{alt}</span> }));

const caregiver = {
  id: 'real-caregiver', name: 'Real Care Professional', isAvailable: true,
  isApproved: true, isOrganizationActive: true, isSuspended: false, isBlacklisted: false,
  hourlyRate: 300, location: 'Lalitpur', servicesOffered: ['care'], workType: 'fulltime',
};
const response = (items, total = items.length, nextCursor = null) => ({
  items: items.map(item => ({ id: item.id, data: item })),
  total, nextCursor,
});

beforeEach(() => {
  mockLocation = { search: '', hash: '' };
  mockNavigate.mockReset();
  searchCaregivers.mockReset();
  loadPublicCareServices.mockReset();
  loadPublicCareServices.mockResolvedValue([{ id: 'care', label: 'Elderly Care', category: 'caregiver' }]);
  searchCaregivers.mockResolvedValue(response([caregiver]));
});

test('public homepage begins with caregiver hiring before promotional hero or services', async () => {
  render(<HomePage />);
  expect(screen.getAllByRole('region')[0]).toHaveAttribute('id', 'caregivers');
  expect(screen.getByRole('heading', { level: 1, name: 'The right care. Right here.' })).toBeVisible();
  expect(screen.getByRole('heading', { level: 2, name: /Your people\. Your routine/i })).toBeVisible();
  expect(await screen.findByRole('heading', { name: 'Real Care Professional' })).toBeVisible();
  expect(searchCaregivers).toHaveBeenCalledWith({}, { limit: 9 });
  expect(screen.getByText('Accepting requests')).toBeVisible();
  expect(screen.getByText('NPR 300/hour')).toBeVisible();
  expect(screen.getByRole('button', { name: /Request availability/ })).toBeEnabled();
});

test('homepage searches by service and city with advanced filters on browse', async () => {
  render(<HomeCaregiverMarketplace />);
  await screen.findByRole('heading', { name: 'Real Care Professional' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Service' }), { target: { value: 'catalog_elderly_care' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'City or locality' }), { target: { value: 'Lalitpur' } });
  fireEvent.submit(screen.getByRole('search', { name: 'Find caregivers on Sewak' }));
  await waitFor(() => expect(searchCaregivers).toHaveBeenLastCalledWith(
    { serviceId: 'catalog_elderly_care', location: 'Lalitpur' },
    { limit: 9 },
  ));
  expect(screen.getByRole('heading', { name: 'Real Care Professional' })).toBeVisible();
  expect(screen.getByRole('link', { name: /All filters/ })).toHaveAttribute('href', '/browse?service=catalog_elderly_care&location=Lalitpur');
  expect(mockNavigate).toHaveBeenCalledWith('/?service=catalog_elderly_care&location=Lalitpur#home-caregiver-results-heading', { replace: true });
});

test('lower service cards search caregivers on the same homepage, not a separate find-care page', async () => {
  mockLocation = { search: '?service=care', hash: '#caregivers' };
  render(<HomePage />);
  const serviceLink = await screen.findByRole('link', { name: 'Find caregivers offering Elderly care' });
  expect(serviceLink).toHaveAttribute('href', '/?service=catalog_elderly_care#caregivers');
  await waitFor(() => expect(searchCaregivers).toHaveBeenCalledWith({ serviceId: 'care' }, { limit: 9 }));
});

test('one caregiver uses the full results width, with a clear booking entry point', async () => {
  render(<HomeCaregiverMarketplace />);
  await screen.findByRole('heading', { name: 'Real Care Professional' });
  expect(screen.getByTestId('home-caregiver-results')).toHaveClass('marketplace-caregiver-results--single');
  expect(screen.getByRole('button', { name: /View profile/i })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: /View profile/i }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/caregivers/real-caregiver', { state: { careSearchReturnTo: '/#home-caregiver-results-heading' } });
});

test('a restored search keeps service and city in results and advanced filters', async () => {
  mockLocation = { search: '?service=care&location=Lalitpur', hash: '#home-caregiver-results-heading' };
  render(<HomeCaregiverMarketplace />);
  await screen.findByRole('heading', { name: 'Real Care Professional' });
  expect(screen.getByRole('combobox', { name: 'Service' })).toHaveValue('care');
  expect(screen.getByRole('textbox', { name: 'City or locality' })).toHaveValue('Lalitpur');
  expect(searchCaregivers).toHaveBeenLastCalledWith({ serviceId: 'care', location: 'Lalitpur' }, { limit: 9 });
  expect(screen.getByRole('link', { name: /All filters/ })).toHaveAttribute('href', '/browse?service=care&location=Lalitpur');
  fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Lalitpur' }));
  await waitFor(() => expect(searchCaregivers).toHaveBeenLastCalledWith({ serviceId: 'care' }, { limit: 9 }));
  expect(screen.getByRole('combobox', { name: 'Service' })).toHaveValue('care');
  expect(screen.getByRole('textbox', { name: 'City or locality' })).toHaveValue('');
});

test('loads additional caregiver pages inline instead of forcing a new route', async () => {
  const second = { ...caregiver, id: 'second', name: 'Second Care Professional' };
  searchCaregivers.mockResolvedValueOnce(response([caregiver], 2, 'next-token')).mockResolvedValueOnce(response([second], 2));
  render(<HomeCaregiverMarketplace />);
  fireEvent.click(await screen.findByRole('button', { name: 'Show more caregivers' }));
  expect(await screen.findByRole('heading', { name: 'Second Care Professional' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Real Care Professional' })).toBeVisible();
  expect(searchCaregivers).toHaveBeenLastCalledWith({}, { limit: 9, cursor: 'next-token' });
});

test('honest empty and retry states never invent caregiver profiles', async () => {
  searchCaregivers.mockResolvedValueOnce(response([]));
  render(<HomeCaregiverMarketplace />);
  expect(await screen.findByText(/No caregivers are accepting requests right now/)).toBeVisible();
  expect(screen.queryByRole('button', { name: /Request availability/ })).toBeNull();
});

test('failed public lookup provides a retryable error', async () => {
  searchCaregivers.mockRejectedValueOnce(new Error('offline'));
  render(<HomeCaregiverMarketplace />);
  expect(await screen.findByText('Caregiver profiles could not be loaded. Please retry.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Real Care Professional' })).toBeVisible();
});
