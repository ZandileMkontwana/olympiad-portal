import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock Next.js router for AuthRedirect component
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

// Mock Clerk for AuthRedirect component
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: false,
    getToken: vi.fn(),
  }),
  ClerkProvider: ({ children }) => children,
}));

// Mock the API module for AuthRedirect
vi.mock('@/lib/api', () => ({
  fetchCurrentUser: vi.fn().mockResolvedValue(null),
  dashboardPathForRole: (role) =>
    ({ organiser: '/organiser', educator: '/educator', student: '/student' })[role] || '/login',
}));

import LandingPage from './page';
import { expectNoAxeViolations } from '@/test/axe';

describe('Landing page', () => {
  it('has no axe accessibility violations', async () => {
    const { container } = render(<LandingPage />);
    await expectNoAxeViolations(container);
  });

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
