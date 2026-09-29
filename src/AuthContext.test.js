import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
let mockListener;
jest.mock('./authClient', () => ({ onSessionChanged: listener => { mockListener = listener; return jest.fn(); }, refreshSession: jest.fn() }));
test('server session switches replace the complete account and logout clears private state', async () => {
  function Consumer() { const {user,userRole,userDoc} = useAuth(); return <p>{user?.uid || 'signed-out'}:{userRole || 'none'}:{userDoc?.name || 'none'}</p>; }
  render(<AuthProvider><Consumer /></AuthProvider>);
  await act(async () => mockListener({ uid: 'one', role: 'superadmin', profile: {name:'First'} }));
  expect(screen.getByText('one:superadmin:First')).toBeVisible();
  await act(async () => mockListener({ uid: 'two', role: 'user', profile: {name:'Second'} }));
  expect(screen.getByText('two:user:Second')).toBeVisible();
  await act(async () => mockListener(null));
  expect(screen.getByText('signed-out:none:none')).toBeVisible();
});
