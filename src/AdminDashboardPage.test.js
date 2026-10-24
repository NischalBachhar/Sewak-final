import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminDashboardPage from './AdminDashboardPage';
import { getDoc, getDocs } from './d1Client';
import { onSessionChanged } from './authClient';
import { httpsCallable } from './apiClient';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), useLocation: () => ({ pathname: '/superadmin/organizations' }) }));
jest.mock('./authClient', () => ({ onSessionChanged: jest.fn() }));
jest.mock('./apiClient', () => ({ httpsCallable: jest.fn() }));
jest.mock('./d1Client', () => ({ db: {}, collection: (_db, path) => path, doc: (_db, path, id) => `${path}/${id}`, getDoc: jest.fn(), getDocs: jest.fn() }));
jest.mock('./components/CaregiverEditor', () => () => null);

let organization;
let execute;
beforeEach(() => {
  organization = { id: 'org', organizationName: 'Test Care', isApproved: false };
  onSessionChanged.mockImplementation(callback => { callback({ uid: 'admin' }); return () => {}; });
  getDoc.mockImplementation(async path => ({ exists: () => path === 'users/admin', data: () => ({ role: 'superadmin' }) }));
  getDocs.mockImplementation(async path => ({ docs: path === 'organizations' ? [{ id: 'org', data: () => ({ ...organization }) }] : [] }));
  execute = jest.fn(async payload => {
    organization = payload.disposition === 'rejected'
      ? { ...organization, reviewStatus: 'rejected', isSuspended: true, isBlacklisted: true }
      : payload.confirmation ? { ...organization, reviewStatus: 'deleted', deletedAt: '2026-10-18' }
      : { ...organization, isApproved: true };
    return { data: { authRevocationStatus: 'complete', caregiverCascadeStatus: 'complete' } };
  });
  httpsCallable.mockImplementation(() => execute);
});
afterEach(() => jest.restoreAllMocks());
const open = async () => { render(<AdminDashboardPage />); await screen.findByText('Test Care'); };

test('approval removes both review actions and persists after remount', async () => {
  const view = render(<AdminDashboardPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Approve', exact: true }));
  await screen.findByText('Approved', { selector: '.org-review-badge' });
  expect(screen.queryByRole('button', { name: 'Approve', exact: true })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reject', exact: true })).toBeNull();
  view.unmount();
  await open();
  expect(screen.getByText('Approved', { selector: '.org-review-badge' })).toBeTruthy();
});

test('rejection replaces review and blacklist buttons with a working delete confirmation', async () => {
  jest.spyOn(window, 'prompt').mockReturnValue('Incomplete documents');
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Reject', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: 'Delete organization', exact: true }));
  expect(screen.queryByRole('button', { name: 'Reject', exact: true })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Approve', exact: true })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Blacklist Org' })).toBeNull();
  const dialog = screen.getByRole('dialog');
  const confirm = within(dialog).getByRole('button', { name: 'Confirm deletion' });
  expect(confirm).toBeDisabled();
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Test Care' } });
  fireEvent.click(confirm);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(httpsCallable).toHaveBeenCalledWith(null, 'deleteOrganizationAccount');
  expect(execute).toHaveBeenLastCalledWith({ organizationId: 'org', confirmation: 'Test Care' });
  await waitFor(() => expect(screen.queryByText('Test Care')).toBeNull());
  fireEvent.change(screen.getByRole('combobox', { name: 'Organization status' }), { target: { value: 'deleted' } });
  expect(screen.getByText('Test Care')).toBeTruthy();
  expect(screen.getByText('Deleted', { selector: '.org-review-badge' })).toBeTruthy();
});

test('repeat clicks stay disabled until the approval request finishes', async () => {
  let finish;
  execute.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await open();
  const approve = screen.getByRole('button', { name: 'Approve', exact: true });
  fireEvent.click(approve);
  expect(approve).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reject', exact: true })).toBeDisabled();
  fireEvent.click(approve);
  expect(execute).toHaveBeenCalledTimes(1);
  organization.isApproved = true;
  finish({ data: { approved: true } });
  await screen.findByText('Approved', { selector: '.org-review-badge' });
});

test('failed approval shows the server error and keeps the pending organization', async () => {
  execute.mockRejectedValue(Object.assign(new Error('Review conflict'), { code: 'aborted' }));
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Approve', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('aborted');
  expect(screen.getByText('Pending review', { selector: '.org-review-badge' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
});

test('legacy restrictions appear as Restricted with deletion available', async () => {
  organization.isBlacklisted = true;
  organization.isSuspended = true;
  await open();
  expect(screen.getByText('Restricted', { selector: '.org-review-badge' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Delete organization', exact: true })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Approve', exact: true })).toBeNull();
});
