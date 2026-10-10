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
const mockGetToken = vi.fn().mockResolvedValue('test-token');
const mockReplace = vi.fn();

vi.mock('@/hooks/useStudentAuth', () => ({
  useStudentAuth: () => ({
    user: authState.user,
    checking: authState.checking,
    signOut: mockSignOut,
    getToken: mockGetToken,
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathState.pathname,
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api', () => ({
  deleteAccount: vi.fn().mockResolvedValue({ message: 'Account deleted successfully' }),
}));

vi.mock('@/lib/studentSession', () => ({
  clearStudentSession: vi.fn(),
}));

import StudentSidebar from './StudentSidebar';
import { expectNoAxeViolations } from '@/test/axe';

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

  it('shows a delete account button', () => {
    render(<StudentSidebar />);

    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
  });

  it('opens the delete dialog when the delete button is clicked', () => {
    render(<StudentSidebar />);

    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByText(/delete your account\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete my account/i })).toBeInTheDocument();
  });

  it('closes the delete dialog when cancel is clicked', () => {
    render(<StudentSidebar />);

    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/delete your account\?/i)).not.toBeInTheDocument();
  });

  it('deletes the account and redirects to login', async () => {
    const { deleteAccount } = await import('@/lib/api');
    const { clearStudentSession } = await import('@/lib/studentSession');

    render(<StudentSidebar />);

    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    await vi.waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledWith('test-token');
    });
    expect(clearStudentSession).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/login?deleted=1');
  });

  it('shows an error when account deletion fails', async () => {
    const { deleteAccount } = await import('@/lib/api');
    deleteAccount.mockRejectedValueOnce(new Error('Server error'));

    render(<StudentSidebar />);

    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    await vi.waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });
});

describe('StudentSidebar mobile drawer', () => {
  beforeEach(() => {
    authState.user = {
      id: 'user-1',
      email: 'student@school.com',
      name: 'Thabo',
      school: { id: 'school-1', name: 'Test School' },
    };
    authState.checking = false;
    pathState.pathname = '/student';
  });

  it('has a stable id and is closed by default', () => {
    const { container } = render(<StudentSidebar />);
    const aside = container.querySelector('aside');
    expect(aside).toHaveAttribute('id', 'app-sidebar');
    expect(aside).not.toHaveClass('sidebar-open');
    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument();
  });

  it('shows the open state and calls onClose from the close button and nav links', () => {
    const onClose = vi.fn();
    const { container } = render(<StudentSidebar open onClose={onClose} />);
    expect(container.querySelector('aside')).toHaveClass('sidebar-open');

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Dashboard').closest('a'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('StudentSidebar accessibility', () => {
  it('has no axe accessibility violations (closed and open drawer)', async () => {
    const { container, rerender } = render(<StudentSidebar />);
    await expectNoAxeViolations(container);
    rerender(<StudentSidebar open onClose={() => {}} />);
    await expectNoAxeViolations(container);
  });
});
