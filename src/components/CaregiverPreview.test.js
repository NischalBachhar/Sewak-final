import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CustomerHomePage from '../CustomerHomePage';
import CaregiverPreview from './CaregiverPreview';
import CaregiverPreviewCard from './CaregiverPreviewCard';
import { loadPublicCareServices, searchCaregivers, requestAvailability, caregiverBookingReason } from '../caregiverDiscovery';
import { apiRequest } from '../apiClient';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useLocation: () => ({ hash: '' }), Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }));
jest.mock('../AuthContext', () => ({ useAuth: () => ({ user: { uid: 'customer' }, userRole: 'user', userDoc: { name: 'Customer' } }), useOptionalAuth: () => ({ user: { uid: 'customer' }, userRole: 'user', userDoc: { name: 'Customer' } }) }));
jest.mock('../useCustomerBookings', () => () => ({ bookings: [], loading: false }));
jest.mock('../apiClient', () => ({ apiRequest: jest.fn() }));
jest.mock('./PublicHeader', () => () => null);
jest.mock('./ServiceSelector', () => ({ loadServiceOptions: () => Promise.resolve([]) }));

jest.mock('../caregiverDiscovery', () => ({
  ...jest.requireActual('../caregiverDiscovery'),
  loadPublicCareServices: jest.fn(), searchCaregivers: jest.fn(),
}));
jest.mock('./ProfileImage', () => ({ __esModule: true, default: ({ alt }) => <span>{alt}</span> }));
const caregiver = { id: 'real', name: 'Care Professional', location: 'Hetauda', isApproved: true, isSuspended: false, isBlacklisted: false, isOrganizationActive: true, isAvailable: true, hourlyRate: 500, servicesOffered: ['care'], workType: 'fulltime' };
const services = [{ id: 'care', label: 'Elderly care' }];
beforeEach(() => { jest.clearAllMocks(); loadPublicCareServices.mockResolvedValue(services); searchCaregivers.mockResolvedValue({ items: [{ id: caregiver.id, data: caregiver }] }); });
const preview = signedIn => render(<CaregiverPreview signedIn={signedIn} />);

test.each([[false, 'Meet Sewak Care Professionals', '/browse'], [true, 'Explore Caregivers', '/user']])('preview uses the bounded public search and existing navigation (signed in: %s)', async (signedIn, title, route) => {
  preview(signedIn);
  expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Loading caregiver profiles');
  expect(await screen.findByRole('heading', { name: caregiver.name })).toBeInTheDocument();
  expect(searchCaregivers).toHaveBeenCalledWith({}, { limit: 3 });
  expect(screen.getByRole('link', { name: /View All/ })).toHaveAttribute('href', route);
  expect(screen.getByText('Elderly care')).toBeInTheDocument();
  expect(screen.getByText('Accepting requests')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: signedIn ? /Request availability/ : /Request availability/ })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: /View profile/i }));
  expect(mockNavigate).toHaveBeenCalledWith(`${signedIn ? '/user' : ''}/caregivers/real`);
  if (signedIn) {
    fireEvent.click(screen.getByRole('button', { name: /Request availability/ }));
  }
  expect(mockNavigate).toHaveBeenLastCalledWith(signedIn ? '/user/book/real' : '/caregivers/real');
});

test('customer homepage offers the shared request action without empty booking panels', async () => {
  apiRequest.mockImplementation((_path, { json }) => Promise.resolve({ items: json.path === 'publicCaregivers' ? [{ id: caregiver.id, data: caregiver }] : services.map(service => ({ id: service.id, data: service })), total: 1 }));
  render(<CustomerHomePage />);
  expect(await screen.findByRole('heading', { name: caregiver.name })).toBeVisible();
  expect(screen.queryByRole('region', { name: 'Your upcoming care' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Quick actions' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Request availability/ }));
  expect(mockNavigate).toHaveBeenCalledWith('/user/book/real');
});

test('preview handles empty and retryable network errors', async () => {
  searchCaregivers.mockRejectedValueOnce(new Error('Network failure'));
  preview(false);
  expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load caregiver profiles');
  searchCaregivers.mockResolvedValueOnce({ items: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(/No care professionals are accepting requests/)).toBeInTheDocument();
  expect(searchCaregivers).toHaveBeenCalledTimes(2);
});

test.each([
  [true, 'Accepting requests'], [false, 'Not accepting requests'], [null, 'Availability not confirmed'], [undefined, 'Availability not confirmed'],
])('availability %s is independent of full-time work', (isAvailable, label) => {
  const data = { ...caregiver, isAvailable };
  expect(requestAvailability(data).label).toBe(label);
  expect(Boolean(caregiverBookingReason(data))).toBe(isAvailable !== true);
});

test.each(['isSuspended', 'isBlacklisted'])('restricted status %s never claims accepting requests', field => {
  expect(requestAvailability({ ...caregiver, [field]: true }).state).toBe('unknown');
});

test('a server projection with unconfirmed availability keeps the existing false boolean and shows unknown', () => {
  expect(requestAvailability({ ...caregiver, isAvailable: false, availabilityConfirmed: false }).label).toBe('Availability not confirmed');
  expect(caregiverBookingReason({ ...caregiver, isAvailable: false, availabilityConfirmed: false })).toMatch(/must be confirmed/);
});

test('disabled booking explains availability; ratings require eligible review count; legacy verification is not trusted', () => {
  const onSelect = jest.fn();
  const { rerender } = render(<CaregiverPreviewCard caregiver={{ ...caregiver, isAvailable: false, rating: 5, reviewCount: 0, verified: true }} services={services} onSelect={onSelect} />);
  const book = screen.getByRole('button', { name: /Request availability/ });
  expect(book).toBeDisabled();
  expect(book).toHaveAccessibleDescription('This professional is not accepting booking requests.');
  fireEvent.click(book); expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByText('No verified reviews yet')).toBeInTheDocument();
  expect(screen.queryByText('Verified', { exact: true })).not.toBeInTheDocument();
  expect(screen.getByText('Verification not complete')).toBeInTheDocument();
  rerender(<CaregiverPreviewCard caregiver={{ ...caregiver, rating: 4, reviewCount: 2, verificationSource: 'audited_v1', verified: true }} services={services} onSelect={onSelect} />);
  expect(screen.getByText('(2 verified reviews)')).toBeInTheDocument();
  expect(screen.getByText('Verified', { exact: true })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Request availability/ }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: caregiver.id }));
});

test('missing services or an unconfigured rate prevent booking', () => {
  expect(caregiverBookingReason({ ...caregiver, servicesOffered: [] })).toMatch(/services/);
  expect(caregiverBookingReason({ ...caregiver, hourlyRate: null })).toMatch(/rate/);
  expect(caregiverBookingReason({ ...caregiver, hourlyRate: 0 })).toMatch(/rate/);
  expect(caregiverBookingReason({ ...caregiver, hourlyRate: 0, allowZeroRate: true })).toBe('');
});

test('unmount ignores a late response', async () => {
  let resolve;
  searchCaregivers.mockImplementation(() => new Promise(done => { resolve = done; }));
  const { unmount } = preview(false); unmount();
  resolve({ items: [] });
  await waitFor(() => expect(searchCaregivers).toHaveBeenCalledTimes(1));
});
