import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from './page';

describe('Landing page', () => {
  it('renders the hero headline and supporting copy', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { level: 1, name: /without limits/i })).toBeInTheDocument();
    expect(screen.getByText(/learners who love a good challenge/i)).toBeInTheDocument();
  });

  it('links the main calls to action at real routes', () => {
    render(<LandingPage />);

    // Header and bottom CTA both say "Get started" — both must point at /register.
    for (const link of screen.getAllByRole('link', { name: /get started/i })) {
      expect(link).toHaveAttribute('href', '/register');
    }
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /start your journey/i })).toHaveAttribute(
      'href',
      '/register'
    );
  });

  it('renders the pathway cards with their actions', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { name: 'Explore subjects' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Find an olympiad' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Join the community' })).toBeInTheDocument();
  });

  it('anchors the nav and footer to the page sections', () => {
    render(<LandingPage />);

    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
    for (const id of ['top', 'about', 'subjects', 'events', 'resources']) {
      expect(document.getElementById(id)).toBeInTheDocument();
    }
  });
});
