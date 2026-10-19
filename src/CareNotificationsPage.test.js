import React from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import CareNotificationsPage from './CareNotificationsPage';
import {apiRequest} from './apiClient';

jest.mock('./apiClient',()=>({apiRequest:jest.fn()}));
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
