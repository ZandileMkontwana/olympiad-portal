import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

// Mutable Clerk state — individual tests override before rendering.
const clerkState = vi.hoisted(() => ({ isLoaded: true, isSignedIn: false }));

const mockSignOut = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: clerkState.isLoaded,
    isSignedIn: clerkState.isSignedIn,
    getToken: vi.fn().mockResolvedValue('clerk-token'),
  }),
  useClerk: () => ({ signOut: mockSignOut }),
  SignIn: () => <div data-testid="clerk-signin">Clerk sign-in</div>,
}));

vi.mock('@/lib/api', () => ({
  studentLogin: vi.fn(),
  dashboardPathForRole: (role) =>
    ({ organiser: '/organiser', educator: '/educator', student: '/student' })[role] || '/login',
}));

// Mutable stored-session state — the page redirects on a live session.
const sessionState = vi.hoisted(() => ({ session: null }));

vi.mock('@/lib/studentSession', () => ({
  getStudentSession: () => sessionState.session,
  setStudentSession: vi.fn(),
}));

import LoginPage from './page';
import { studentLogin } from '@/lib/api';
import { setStudentSession } from '@/lib/studentSession';

// ── tests ────────────────────────────────────────────────────────────────────

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clerkState.isLoaded = true;
    clerkState.isSignedIn = false;
    sessionState.session = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the Student tab by default with email and password fields', () => {
    render(<LoginPage />);

    // The tab labels carry emoji ("🎓 Student") — match on the word.
    expect(screen.getByRole('tab', { name: /student/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/student email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('switches to the Clerk panel on the Educator / Organiser tab', () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('tab', { name: /educator \/ organiser/i }));

    expect(screen.getByRole('tab', { name: /educator \/ organiser/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('clerk-signin')).toBeInTheDocument();
    // The student form is hidden on the staff tab
    expect(screen.queryByLabelText(/student email/i)).not.toBeInTheDocument();
  });

  it('signs a student in with email + password and redirects to /student', async () => {
    const session = {
      token: 'jwt-token',
      user: { id: 'user-1', email: 'student@school.com', role: 'student' },
    };
    studentLogin.mockResolvedValue(session);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/student email/i), {
      target: { value: 'student@school.com ' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(studentLogin).toHaveBeenCalledWith({
        email: 'student@school.com',
        password: 'secret123',
      });
    });
    expect(setStudentSession).toHaveBeenCalledWith(session);
    expect(mockPush).toHaveBeenCalledWith('/student');
  });

  it('shows the backend error when the credentials are wrong', async () => {
    studentLogin.mockRejectedValue(new Error('Invalid email or password'));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/student email/i), {
      target: { value: 'student@school.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/invalid email or password/i);
    expect(setStudentSession).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows the not-activated hint when the account has no password yet', async () => {
    studentLogin.mockRejectedValue(
      new Error('Your account is not activated yet — ask your educator to resend the invitation')
    );

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/student email/i), {
      target: { value: 'student@school.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'anything' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/ask your educator to resend the invitation/i);
  });

  it('redirects a stored student session straight to /student', () => {
    sessionState.session = { token: 'jwt-token', user: { id: 'user-1', role: 'student' } };

    render(<LoginPage />);

    expect(mockReplace).toHaveBeenCalledWith('/student');
  });

  it('tells students without a password to check their invitation email', () => {
    render(<LoginPage />);

    expect(
      screen.getByText(/educator registers you and emails an invitation link/i)
    ).toBeInTheDocument();
  });
});
