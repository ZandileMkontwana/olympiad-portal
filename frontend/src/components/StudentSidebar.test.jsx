import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mutable state — individual tests override before rendering.
const authState = vi.hoisted(() => ({
  user: {
    id: 'user-1',
    email: 'student@school.com',
    name: 'Thabo',
    school: { id: 'school-1', name: 'Test School' },
  },
  checking: false,
}));
const pathState = vi.hoisted(() => ({ pathname: '/student' }));

const mockSignOut = vi.fn();

vi.mock('@/hooks/useStudentAuth', () => ({
  useStudentAuth: () => ({
    user: authState.user,
    checking: authState.checking,
    signOut: mockSignOut,
  }),
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

import StudentSidebar from './StudentSidebar';

describe('StudentSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    authState.user = {
      id: 'user-1',
      email: 'student@school.com',
      name: 'Thabo',
      school: { id: 'school-1', name: 'Test School' },
    };
    authState.checking = false;
    pathState.pathname = '/student';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a Dashboard link to the student dashboard', () => {
    render(<StudentSidebar />);

    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('href', '/student');
  });

  it('marks Dashboard as the current page on the dashboard', () => {
    render(<StudentSidebar />);

    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('aria-current', 'page');
  });

  it('keeps Dashboard highlighted on result pages', () => {
    pathState.pathname = '/student/result?id=result-1';
    render(<StudentSidebar />);

    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('aria-current', 'page');
  });

  it('shows the student name with a logout button', () => {
    render(<StudentSidebar />);

    expect(screen.getByText('Thabo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('falls back to the email address when the account has no name', () => {
    authState.user = { id: 'user-1', email: 'student@school.com', name: null };
    render(<StudentSidebar />);

    expect(screen.getByText('student@school.com')).toBeInTheDocument();
  });

  it('signs the student out after confirming', async () => {
    render(<StudentSidebar />);

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(confirm).toHaveBeenCalledWith('Log out of the Olympiad Portal?');
    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ redirectUrl: '/login' });
    });
  });

  it('stays signed in when the logout confirmation is cancelled', () => {
    confirm.mockReturnValue(false);
    render(<StudentSidebar />);

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('shows a loading placeholder while the session check runs', () => {
    authState.user = null;
    authState.checking = true;
    render(<StudentSidebar />);

    expect(screen.getByText(/loading account/i)).toBeInTheDocument();
  });

  it('shows a signed-out placeholder when there is no session', () => {
    authState.user = null;
    authState.checking = false;
    render(<StudentSidebar />);

    expect(screen.getByText(/not signed in/i)).toBeInTheDocument();
  });
});
