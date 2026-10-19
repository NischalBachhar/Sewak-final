import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Sewak2Stories from './Sewak2Stories';

describe('Sewak 2.0 photographic care discovery', () => {
  test('provides service category links without claiming providers or rates', () => {
    render(<MemoryRouter><Sewak2Stories /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /your kind of care/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /support that feels human/i })).toHaveAttribute('href', '/browse?category=caregiver');
    expect(screen.getByRole('link', { name: /life works better together/i })).toHaveAttribute('href', '/browse?category=household');
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByText(/profiles, verification details and prices always come/i)).toBeInTheDocument();
  });
});
