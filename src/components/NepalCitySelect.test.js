import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import NepalCitySelect from './NepalCitySelect';

function Editor({ initial = 'Kathmandu' }) {
  const [value, setValue] = useState(initial);
  return <><NepalCitySelect value={value} onChange={setValue} /><output data-testid="saved-value">{value}</output></>;
}
test('Other requires an actual city, normalizes whitespace and can switch back to predefined cities', () => {
  render(<Editor />);
  fireEvent.change(screen.getByLabelText('City *'), { target:{value:'Other'} });
  const custom = screen.getByLabelText('Enter your city *');
  expect(custom).toBeRequired(); expect(custom.checkValidity()).toBe(false);
  fireEvent.change(custom,{target:{value:'  Tansen   Town  '}}); fireEvent.blur(custom);
  expect(screen.getByTestId('saved-value')).toHaveTextContent('Tansen Town');
  fireEvent.change(screen.getByLabelText('City *'),{target:{value:'Hetauda'}});
  expect(screen.queryByLabelText('Enter your city *')).not.toBeInTheDocument();
  expect(screen.getByTestId('saved-value')).toHaveTextContent('Hetauda');
});
test('custom and legacy Other values reopen for correction without replacing the saved city', () => {
  const view=render(<Editor initial="Tansen Town" />);
  expect(screen.getByLabelText('City *')).toHaveValue('Other');
  expect(screen.getByLabelText('Enter your city *')).toHaveValue('Tansen Town');
  view.unmount(); render(<Editor initial="Other" />);
  expect(screen.getByLabelText('Enter your city *')).toHaveValue('');
});
