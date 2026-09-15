import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mutable state — individual tests override before rendering.
const clerkState = vi.hoisted(() => ({
  user: { fullName: 'Ms Teacher', primaryEmailAddress: { emailAddress: 'teacher@school.com' } },
}));
const pathState = vi.hoisted(() => ({ pathname: '/educator' }));

const mockSignOut = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ signOut: mockSignOut }),
  useUser: () => ({ user: clerkState.user }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathState.pathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import EducatorSidebar from './EducatorSidebar';

describe('EducatorSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    clerkState.user = {
      fullName: 'Ms Teacher',
      primaryEmailAddress: { emailAddress: 'teacher@school.com' },
    };
    pathState.pathname = '/educator';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders links to rounds, the school dashboard and the paper archive', () => {
    render(<EducatorSidebar />);

    expect(screen.getByText('Rounds').closest('a')).toHaveAttribute('href', '/educator');
    expect(screen.getByText('School Dashboard').closest('a')).toHaveAttribute(
      'href',
      '/educator/school'
    );
    expect(screen.getByText('Paper Archive').closest('a')).toHaveAttribute('href', '/archive');
  });

  it('marks Rounds as the current page on the rounds board', () => {
    render(<EducatorSidebar />);

    expect(screen.getByText('Rounds').closest('a')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('School Dashboard').closest('a')).not.toHaveAttribute('aria-current');
  });

  it('keeps Rounds highlighted on round detail and submission pages', () => {
    pathState.pathname = '/educator/round_view?id=round-1';
    render(<EducatorSidebar />);

    expect(screen.getByText('Rounds').closest('a')).toHaveAttribute('aria-current', 'page');
  });

  it('marks School Dashboard as the current page on the school dashboard', () => {
    pathState.pathname = '/educator/school';
    render(<EducatorSidebar />);

    expect(screen.getByText('School Dashboard').closest('a')).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByText('Rounds').closest('a')).not.toHaveAttribute('aria-current');
  });

  it('marks Paper Archive as the current page on the archive', () => {
    pathState.pathname = '/archive';
    render(<EducatorSidebar />);

    expect(screen.getByText('Paper Archive').closest('a')).toHaveAttribute('aria-current', 'page');
  });

  it('falls back to the email address when the account has no name', () => {
    clerkState.user = {
      fullName: null,
      primaryEmailAddress: { emailAddress: 'teacher@school.com' },
    };
    render(<EducatorSidebar />);

    expect(screen.getByText('teacher@school.com')).toBeInTheDocument();
  });

  it('signs the educator out after confirming', async () => {
    render(<EducatorSidebar />);

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(confirm).toHaveBeenCalledWith('Are you sure you want to log out?');
    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ redirectUrl: '/login' });
    });
  });

  it('stays signed in when the logout confirmation is cancelled', () => {
    confirm.mockReturnValue(false);
    render(<EducatorSidebar />);

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('shows a placeholder while the Clerk user loads', () => {
    clerkState.user = null;
    render(<EducatorSidebar />);

    expect(screen.getByText(/loading account/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });
});
