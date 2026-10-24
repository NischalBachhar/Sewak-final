import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Sewak2Stories from './Sewak2Stories';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

describe('Sewak photographic care discovery', () => {
  test('provides service category links without claiming providers or rates', () => {
    render(<Sewak2Stories />);
    expect(screen.getByRole('heading', { name: /your kind of care/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /support that feels human/i })).toHaveAttribute('href', '/browse?service=catalog_elderly_care');
    expect(screen.getByRole('link', { name: /life works better together/i })).toHaveAttribute('href', '/browse?category=household');
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByText(/Find support that fits your family/i)).toBeInTheDocument();
  });
});
