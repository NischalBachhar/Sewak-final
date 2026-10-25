import React from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import AccountEmailPage from './AccountEmailPage';
import {resetPassword,verifyEmail} from './authClient';
jest.mock('./authClient',()=>({resetPassword:jest.fn(),verifyEmail:jest.fn()}));
beforeEach(()=>jest.clearAllMocks());
test('reset removes the token from the URL and requires matching passwords',async()=>{
 window.history.replaceState(null,'','/account/email?mode=reset#token=secret-link');resetPassword.mockResolvedValue({changed:true});
 render(<AccountEmailPage/>);expect(window.location.hash).toBe('');
 fireEvent.change(screen.getByLabelText('New password'),{target:{value:'Strong-new-password-123!'}});fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:'Different-password-123!'}});
 fireEvent.click(screen.getByRole('button',{name:'Save new password'}));expect(screen.getByRole('alert')).toHaveTextContent('Passwords must match');expect(resetPassword).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:'Strong-new-password-123!'}});fireEvent.click(screen.getByRole('button',{name:'Save new password'}));
 expect(await screen.findByRole('status')).toHaveTextContent('previous sessions have been signed out');expect(resetPassword).toHaveBeenCalledWith('secret-link','Strong-new-password-123!');
});
test('verification requires an explicit confirmation so email scanners cannot consume links',async()=>{
 window.history.replaceState(null,'','/account/email?mode=verify#token=verification-link');verifyEmail.mockResolvedValue({verified:true});
 render(<AccountEmailPage/>);expect(verifyEmail).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Verify email'}));expect(await screen.findByRole('status')).toHaveTextContent('Your email is verified');
});
test('expired links show a usable error',async()=>{
 window.history.replaceState(null,'','/account/email?mode=verify#token=expired');verifyEmail.mockRejectedValue(new Error('This link is invalid or expired. Request a new one.'));
 render(<AccountEmailPage/>);fireEvent.click(screen.getByRole('button',{name:'Verify email'}));expect(await screen.findByRole('alert')).toHaveTextContent('Request a new one');
});
