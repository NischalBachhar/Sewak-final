import React from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import CareNotificationsPage from './CareNotificationsPage';
import {apiRequest} from './apiClient';
import {sendVerification} from './authClient';

jest.mock('./apiClient',()=>({apiRequest:jest.fn()}));
jest.mock('./authClient',()=>({sendVerification:jest.fn(),continueWithGoogle:jest.fn()}));
jest.mock('./AuthContext',()=>({useAuth:()=>({userRole:'user'})}));
jest.mock('react-router-dom',()=>({Link:({to,children})=><a href={to}>{children}</a>}));

afterEach(()=>jest.resetAllMocks());

test.each([false,true])('reminder selection stays responsive and recovers on save failure=%s',async(fail)=>{
 let resolveSave,rejectSave;
 apiRequest.mockResolvedValueOnce({items:[],unread:0,preferences:{bookingReminders:true}})
  .mockImplementationOnce(()=>new Promise((resolve,reject)=>{resolveSave=resolve;rejectSave=reject;}));
 render(<CareNotificationsPage/>);
 const checkbox=screen.getByRole('checkbox',{name:'Remind me about upcoming care appointments'});
 await waitFor(()=>expect(checkbox).toBeEnabled());
 fireEvent.click(checkbox);
 expect(checkbox).not.toBeChecked();
 expect(checkbox).toBeDisabled();
 expect(apiRequest).toHaveBeenLastCalledWith('/api/care-notifications',{method:'POST',json:{action:'preferences',bookingReminders:false}});
 await act(async()=>{if(fail)rejectSave(new Error('Please retry.'));else resolveSave({updated:true});});
 expect(checkbox).toBeEnabled();
 expect(checkbox).toHaveProperty('checked',fail);
 expect(screen.getByRole(fail?'alert':'status')).toHaveTextContent(fail?'Please retry.':'Reminder preference saved.');
});

test('email updates require verification and provide a verification action',async()=>{
 apiRequest.mockResolvedValue({items:[],preferences:{emailUpdates:false},delivery:{emailConfigured:true,emailVerified:false}});sendVerification.mockResolvedValue({message:'Check your inbox for a verification link.'});
 render(<CareNotificationsPage/>);const verify=await screen.findByRole('button',{name:'Send verification email'});
 expect(screen.getByRole('checkbox',{name:'Send care updates to my email'})).toBeDisabled();fireEvent.click(verify);
 expect(await screen.findByRole('status')).toHaveTextContent('Check your inbox');expect(sendVerification).toHaveBeenCalledTimes(1);
});
test('verified users can opt in without changing reminder preferences',async()=>{
 apiRequest.mockResolvedValueOnce({items:[],preferences:{emailUpdates:false,bookingReminders:false},delivery:{emailConfigured:true,emailVerified:true}}).mockResolvedValueOnce({updated:true});
 render(<CareNotificationsPage/>);const checkbox=screen.getByRole('checkbox',{name:'Send care updates to my email'});await waitFor(()=>expect(checkbox).toBeEnabled());fireEvent.click(checkbox);
 expect(await screen.findByRole('status')).toHaveTextContent('Email preference saved');expect(apiRequest).toHaveBeenLastCalledWith('/api/care-notifications',{method:'POST',json:{action:'preferences',emailUpdates:true}});expect(screen.getByRole('checkbox',{name:'Remind me about upcoming care appointments'})).not.toBeChecked();
});
