import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import CareWeekPreview from './CareWeekPreview';

test('the care week uses Nepal today across the UTC year boundary and supports week navigation',()=>{
 jest.useFakeTimers('modern');
 jest.setSystemTime(new Date('2026-12-31T18:20:00Z'));
 try{
   render(<CareWeekPreview bookings={[{date:'2027-01-01'}]}/>);
   const today=screen.getByRole('group',{name:'Care schedule for 2027-01-01'});
   expect(today).toHaveTextContent('Fri');expect(today).toHaveTextContent('1 care visit');
   expect(today).toHaveAttribute('aria-current','date');
   fireEvent.click(screen.getByRole('button',{name:'Next week'}));
   expect(screen.queryByRole('group',{name:'Care schedule for 2027-01-01'})).toBeNull();
   fireEvent.click(screen.getByRole('button',{name:'This week'}));
   expect(screen.getByRole('group',{name:'Care schedule for 2027-01-01'})).toHaveTextContent('1 care visit');
 }finally{jest.useRealTimers();}
});
