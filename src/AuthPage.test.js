import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuthPage from './AuthPage';
import {register,signIn} from './authClient';
import {completeRegistration} from './registrationService';
let mockMode='register';const mockBegin=jest.fn(),mockFinish=jest.fn();
jest.mock('react-router-dom',()=>({useSearchParams:()=>[new URLSearchParams('mode='+mockMode)]}),{virtual:true});
jest.mock('./authClient',()=>({auth:{currentUser:null},register:jest.fn(),signIn:jest.fn()}));
jest.mock('./AuthContext',()=>({useAuth:()=>({beginRegistration:mockBegin,finishRegistration:mockFinish,registrationPending:false})}));
jest.mock('./registrationService',()=>({completeRegistration:jest.fn()}));
beforeEach(()=>{jest.clearAllMocks();sessionStorage.clear();mockMode='register';});
test('registration requires a strong password and uses correct form autocomplete',()=>{render(<AuthPage/>);expect(screen.getByLabelText('Full name')).toHaveAttribute('autocomplete','name');expect(screen.getByLabelText('Password')).toHaveAttribute('minlength','12');expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete','new-password');});
test('partial registration retries only after password authentication and logs no personal payload',async()=>{
 const log=jest.spyOn(console,'error').mockImplementation(()=>{}),account={uid:'new-id',email:'test@example.test'};
 register.mockRejectedValue({code:'account-exists'});signIn.mockResolvedValue(account);completeRegistration.mockRejectedValueOnce({code:'unavailable',message:'PRIVATE_PAYLOAD'}).mockResolvedValueOnce();
 render(<AuthPage/>);fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Synthetic Name'}});fireEvent.change(screen.getByLabelText('Email'),{target:{value:account.email}});fireEvent.change(screen.getByLabelText('Password'),{target:{value:'Synthetic-password-123!'}});
 fireEvent.click(screen.getByRole('button',{name:'Sign up'}));await screen.findByRole('alert');expect(mockFinish).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Sign up'}));await waitFor(()=>expect(mockFinish).toHaveBeenCalledTimes(1));expect(signIn).toHaveBeenCalledTimes(2);expect(JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE|test@example/);log.mockRestore();
});
test('recovery guidance does not pretend to send mail or expose account existence',()=>{mockMode='login';render(<AuthPage/>);fireEvent.click(screen.getByRole('button',{name:'Forgot password?'}));expect(screen.getByText(/Contact your Sewak administrator/)).toBeVisible();});

test('login preserves loading feedback, credential errors, and retry values', async () => {
  mockMode = 'login';
  let rejectLogin;
  signIn.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectLogin = reject; }));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Test-password-123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeDisabled();
    expect(signIn).toHaveBeenCalledWith('test@example.test', 'Test-password-123!');
    rejectLogin({ code: 'invalid-credentials' });
    expect(await screen.findByRole('alert')).toHaveTextContent('The email or password is incorrect. Please try again.');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(screen.getByLabelText('Email')).toHaveValue('test@example.test');
    expect(screen.getByLabelText('Password')).toHaveValue('Test-password-123!');
  } finally {
    log.mockRestore();
  }
});
