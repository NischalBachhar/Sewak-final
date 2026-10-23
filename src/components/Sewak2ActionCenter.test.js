import React from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import Sewak2ActionCenter from './Sewak2ActionCenter';

const roleCases = [
  ['user','Discover care nearby','find'],
  ['caregiver','Discover open jobs','opportunities'],
  ['organization','Manage care professionals','caregivers'],
  ['admin','Review verification','verification'],
];

test.each(roleCases)('Sewak %s action routes to the owning dashboard', (role, label, action) => {
  const onAction=jest.fn();
  render(<Sewak2ActionCenter role={role} onAction={onAction} metrics={[{label:'Pending',value:2}]} />);
  expect(screen.getByRole('region',{name:'Quick actions'})).toBeInTheDocument();
  expect(screen.getByText('Pending')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:new RegExp(label,'i')}));
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(onAction).toHaveBeenCalledWith(action);
});

test('unknown roles cannot access another role action configuration',()=>{
  const onAction=jest.fn();
  const {container}=render(<Sewak2ActionCenter role="guest" onAction={onAction}/>);
  expect(container).toBeEmptyDOMElement();
});
