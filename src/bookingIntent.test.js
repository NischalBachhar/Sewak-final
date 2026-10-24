import { readCareIntent, saveCareIntent } from './bookingIntent';
import { kathmanduDate } from './bookingValidation';
beforeEach(() => sessionStorage.clear());
test('schedule preferences survive account navigation only for the selected caregiver', () => {
  const date = kathmanduDate(new Date(Date.now() + 86400000));
  saveCareIntent('care-one',date,'09:30');
  expect(readCareIntent('care-one')).toEqual({date,time:'09:30'});
  expect(readCareIntent('care-two')).toEqual({});
  sessionStorage.setItem('sewak.careIntent','broken');
  expect(readCareIntent('care-one')).toEqual({});
});
