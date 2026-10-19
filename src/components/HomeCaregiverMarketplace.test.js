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
  expect(screen.getByRole('button', { name: /Sign in to book/ })).toBeEnabled();
});

test('homepage searches real caregivers by category, service, location and name', async () => {
  render(<HomeCaregiverMarketplace />);
  await screen.findByRole('heading', { name: 'Real Care Professional' });
  fireEvent.change(screen.getByRole('searchbox', { name: 'Caregiver or area' }), { target: { value: 'Real' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Service' }), { target: { value: 'care' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'City or locality' }), { target: { value: 'Lalitpur' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Support type' }), { target: { value: 'caregiver' } });
  fireEvent.submit(screen.getByRole('search', { name: 'Find caregivers on Sewak' }));
  await waitFor(() => expect(searchCaregivers).toHaveBeenLastCalledWith(
    { text: 'Real', serviceId: 'care', location: 'Lalitpur', category: 'caregiver' },
    { limit: 9 },
  ));
  expect(screen.getByRole('heading', { name: 'Real Care Professional' })).toBeVisible();
});

test('lower service cards search caregivers on the same homepage, not a separate find-care page', async () => {
  mockLocation = { search: '?service=care', hash: '#caregivers' };
  render(<HomePage />);
  const serviceLink = await screen.findByRole('link', { name: 'Find caregivers offering Elderly Care' });
  expect(serviceLink).toHaveAttribute('href', '/?service=care#caregivers');
  await waitFor(() => expect(searchCaregivers).toHaveBeenCalledWith({ serviceId: 'care' }, { limit: 9 }));
});

test('one caregiver is centered and visible, with a clear booking entry point', async () => {
  render(<HomeCaregiverMarketplace />);
  await screen.findByRole('heading', { name: 'Real Care Professional' });
  expect(screen.getByTestId('home-caregiver-results')).toHaveClass('home-marketplace__grid--single');
  expect(screen.getByRole('button', { name: /View profile/i })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: /View profile/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/caregivers/real-caregiver');
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
  expect(screen.queryByRole('button', { name: /Sign in to book/ })).toBeNull();
});

test('failed public lookup provides a retryable error', async () => {
  searchCaregivers.mockRejectedValueOnce(new Error('offline'));
  render(<HomeCaregiverMarketplace />);
  expect(await screen.findByText('Caregiver profiles could not be loaded. Please retry.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Real Care Professional' })).toBeVisible();
});
