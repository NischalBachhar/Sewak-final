import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PublicCaregiverProfilePage from './PublicCaregiverProfilePage';
import { getDoc, getDocs } from './d1Client';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ caregiverId: 'real-caregiver' }),
  useLocation: () => ({ hash: '', state: { careSearchReturnTo: '/?service=elderly&location=Hetauda#home-caregiver-results-heading' } }),
}));
jest.mock('./d1Client', () => ({
  db: {}, getDoc: jest.fn(), getDocs: jest.fn(), doc: jest.fn(), collection: jest.fn(), query: jest.fn(), where: jest.fn(),
}));
jest.mock('./components/PublicHeader', () => () => <header>Public navigation</header>);
jest.mock('./components/PublicFooter', () => () => null);
jest.mock('./useSavedCare', () => () => ({ saved: [], toggle: jest.fn(), enabled: false }));

const caregiver = { name: 'Real Care Professional', location: 'Hetauda', hourlyRate: 300, servicesOffered: ['elderly'], isApproved: true, isOrganizationActive: true, isAvailable: true, isSuspended: false, isBlacklisted: false };

beforeEach(() => {
  mockNavigate.mockReset();
  getDoc.mockResolvedValue({ id: 'real-caregiver', exists: () => true, data: () => caregiver });
  getDocs.mockResolvedValue({ docs: [] });
});

test('the profile and request panel appear before optional reviews and services complete', async () => {
  let finishDetails;
  const pending = new Promise(resolve => { finishDetails = resolve; });
  getDocs.mockReturnValue(pending);
  render(<PublicCaregiverProfilePage />);
  expect(await screen.findByRole('heading', { name: 'Real Care Professional' })).toBeVisible();
  expect(screen.getByRole('button', { name: /Continue to request/ })).toBeEnabled();
  expect(screen.getAllByText('Loading verified reviews…')).toHaveLength(2);
  expect(screen.queryByText('No verified reviews yet')).toBeNull();
  await act(async () => finishDetails({ docs: [] }));
  await waitFor(() => expect(screen.queryByText('Loading verified reviews…')).toBeNull());
});

test('Back to results returns to the filtered search rather than an unfiltered browse page', async () => {
  render(<PublicCaregiverProfilePage />);
  await screen.findByRole('heading', { name: 'Real Care Professional' });
  fireEvent.click(screen.getByRole('button', { name: 'Back to results' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/?service=elderly&location=Hetauda#home-caregiver-results-heading', { replace: true });
});

test('the mobile request action reaches the date form before sign-in and invalid past dates are rejected', async () => {
  render(<PublicCaregiverProfilePage />);
  await screen.findByRole('heading', { name: 'Real Care Professional' });
  fireEvent.click(screen.getAllByRole('button', { name: 'Request availability' }).pop());
  expect(screen.getByRole('heading', { name: 'Request availability' })).toHaveFocus();
  expect(mockNavigate).not.toHaveBeenCalled();
  const date = screen.getByLabelText('Preferred date (optional)');
  fireEvent.change(date, { target: { value: '2000-01-01' } });
  expect(date.checkValidity()).toBe(false);
});
