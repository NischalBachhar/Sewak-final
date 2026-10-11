import React, { Suspense } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './AuthContext';
import { auth, signIn } from './authClient';

// CRA's Jest resolver predates package exports; use the real core router.
jest.mock('react-router-dom', () => {
  global.TextEncoder = require('util').TextEncoder;
  global.TextDecoder = require('util').TextDecoder;
  return jest.requireActual('react-router');
});

jest.mock('./components/MobileBottomNavigation', () => () => null);
jest.mock('./useCustomerBookings', () => () => ({ bookings: [], loading: false }));
jest.mock('./BrowsePage', () => () => <p>Public browse</p>);
jest.mock('./AuthPage', () => () => <p>Login page</p>);
jest.mock('./AccountSetupPage', () => () => null);
jest.mock('./CaregiverListPage', () => () => <p>Customer dashboard</p>);
jest.mock('./PublicCaregiverProfilePage', () => () => null);
jest.mock('./UserProfilePage', () => () => <p>Customer profile</p>);
jest.mock('./OrganizationProfilePage', () => () => <p>Organization profile</p>);
jest.mock('./CaregiverDashboardPage', () => () => <p>Caregiver dashboard</p>);
jest.mock('./OrganizationDashboard', () => () => <p>Organization dashboard</p>);
jest.mock('./AdminDashboardPage', () => () => <p>Admin dashboard</p>);

const response = value => ({ ok: true, json: async () => value });
const roles = [['user', '/user'], ['caregiver', '/caregiver'], ['orgadmin', '/organization/dashboard'], ['superadmin', '/superadmin']];
function LocationProbe() {
  const location = useLocation(), navigate = useNavigate();
  return <><output data-testid="path">{location.pathname}</output><button onClick={() => navigate(-1)}>Back</button></>;
}
function mount(path) {
  return render(<MemoryRouter initialEntries={['/caregivers/previous', path]}><AuthProvider><Suspense fallback={<p>Loading</p>}><App /></Suspense></AuthProvider><LocationProbe /></MemoryRouter>);
}
async function login(role) {
  const user = { uid: role, email: 'test@example.test', role, profile: { name: 'Test', profileComplete: true } };
  global.fetch = jest.fn().mockResolvedValue(response({ user, csrfToken: 'csrf-test' }));
  await signIn('test@example.test', 'test-password');
}
async function clickLogout() {
  fireEvent.click(await screen.findByRole('button', { name: /Account menu/ }));
  fireEvent.click(screen.getByRole('button', { name: /Logout/ }));
}
afterEach(() => { delete global.fetch; localStorage.clear(); sessionStorage.clear(); });

test.each(roles)('%s logout waits for server confirmation and replaces history', async (role, path) => {
  await login(role);
  mount(path);
  await screen.findByRole('button', { name: /Account menu/ });
  let resolve;
  global.fetch.mockImplementation(() => new Promise(done => { resolve = done; }));
  const before = global.fetch.mock.calls.length;
  await clickLogout();
  expect(screen.getByRole('button', { name: /Logout/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /Logout/ }));
  expect(global.fetch).toHaveBeenCalledTimes(before + 1);
  expect(global.fetch).toHaveBeenLastCalledWith('/api/auth/logout', expect.objectContaining({
    method: 'POST', credentials: 'same-origin',
    headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-test' }),
  }));
  expect(screen.getByTestId('path')).toHaveTextContent(path);
  expect(auth.currentUser.role).toBe(role);
  expect(screen.queryByText('Public browse')).not.toBeInTheDocument();
  const seen = [];
  const observer = new MutationObserver(() => seen.push(document.body.textContent));
  observer.observe(document.body, { childList: true, subtree: true });
  await act(async () => resolve(response({ signedOut: true })));
  expect(await screen.findByText('Public browse')).toBeVisible();
  expect(screen.getByTestId('path')).toHaveTextContent('/browse');
  expect(auth.currentUser).toBeNull();
  expect(seen.join(' ')).not.toMatch(/Page not found|Login page|Customer dashboard|Caregiver dashboard|Organization dashboard|Admin dashboard/);
  observer.disconnect();
  fireEvent.click(screen.getByText('Back'));
  await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/caregivers/previous'));
});

test('failed logout keeps authentication and permits a successful retry', async () => {
  await login('user'); mount('/user');
  await screen.findByRole('button', { name: /Account menu/ });
  global.fetch.mockRejectedValue(new Error('sensitive server details'));
  await clickLogout();
  expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't sign you out. Please try again.");
  expect(document.body).not.toHaveTextContent('sensitive server details');
  expect(auth.currentUser.role).toBe('user');
  expect(screen.getByTestId('path')).toHaveTextContent('/user');
  expect(screen.getByRole('button', { name: /Logout/ })).toBeEnabled();
  global.fetch.mockResolvedValue(response({ signedOut: true }));
  fireEvent.click(screen.getByRole('button', { name: /Logout/ }));
  expect(await screen.findByText('Public browse')).toBeVisible();
});

test.each(['/browse', '/user', '/caregiver', '/organization', '/superadmin'])('signed-out direct access to %s preserves public and protected routing', async path => {
  auth.currentUser = null;
  global.fetch = jest.fn().mockResolvedValue(response({ user: null }));
  mount(path);
  expect(await screen.findByText(path === '/browse' ? 'Public browse' : 'Login page')).toBeVisible();
  expect(screen.getByTestId('path')).toHaveTextContent(path === '/browse' ? '/browse' : '/auth');
});
