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

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: clerkState.isLoaded,
    isSignedIn: clerkState.isSignedIn,
    getToken: vi.fn().mockResolvedValue('clerk-token'),
  }),
  SignIn: () => <div data-testid="clerk-signin">Clerk sign-in</div>,
}));

vi.mock('@/lib/api', () => ({
  studentLogin: vi.fn(),
  fetchCurrentUser: vi.fn().mockResolvedValue(null),
  dashboardPathForRole: (role) =>
    ({ organiser: '/organiser', educator: '/educator', student: '/student' })[role] || '/login',
}));

// Mutable stored-session state — the page redirects on a live session.
const sessionState = vi.hoisted(() => ({ session: null }));

vi.mock('@/lib/studentSession', () => ({
  getStudentSession: () => sessionState.session,
  setStudentSession: vi.fn(),
}));

// Mock CSS imports
vi.mock('../../auth.css', () => ({}));

import LoginPage from './[[...rest]]/page';
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

  describe('Role picker', () => {
    it('shows the Student role selected by default', () => {
      render(<LoginPage />);

      const studentButton = screen.getByRole('button', { name: /student/i });
      const educatorButton = screen.getByRole('button', { name: /educator/i });
      const organiserButton = screen.getByRole('button', { name: /organiser/i });

      expect(studentButton).toHaveAttribute('aria-pressed', 'true');
      expect(educatorButton).toHaveAttribute('aria-pressed', 'false');
      expect(organiserButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('switches to Educator role when clicked', () => {
      render(<LoginPage />);

      const educatorButton = screen.getByRole('button', { name: /educator/i });
      fireEvent.click(educatorButton);

      expect(educatorButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('switches to Organiser role when clicked', () => {
      render(<LoginPage />);

      const organiserButton = screen.getByRole('button', { name: /organiser/i });
      fireEvent.click(organiserButton);

      expect(organiserButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('switches back to Student role when clicked', () => {
      render(<LoginPage />);

      const educatorButton = screen.getByRole('button', { name: /educator/i });
      const studentButton = screen.getByRole('button', { name: /student/i });

      fireEvent.click(educatorButton);
      fireEvent.click(studentButton);

      expect(studentButton).toHaveAttribute('aria-pressed', 'true');
      expect(educatorButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Student flow', () => {
    it('shows the student email and password form by default', () => {
      render(<LoginPage />);

      expect(screen.getByLabelText(/student email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('signs a student in with email + password and redirects to /student', async () => {
      const session = {
        token: 'jwt-token',
        user: { id: 'user-1', email: 'student@school.com', role: 'student' },
      };
      studentLogin.mockResolvedValue(session);

      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/student email/i), {
        target: { value: 'student@school.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password/i), {
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
      fireEvent.change(screen.getByLabelText(/^password/i), {
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
      fireEvent.change(screen.getByLabelText(/^password/i), {
        target: { value: 'anything' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/ask your educator to resend the invitation/i);
    });

    it('tells students without a password to check their invitation email', () => {
      render(<LoginPage />);

      expect(
        screen.getByText(/educator registers you and emails an invitation link/i)
      ).toBeInTheDocument();
    });
  });

  describe('Educator/Organiser flow', () => {
    it('shows the Clerk sign-in form when Educator role is selected', () => {
      render(<LoginPage />);

      const educatorButton = screen.getByRole('button', { name: /educator/i });
      fireEvent.click(educatorButton);

      expect(screen.getByTestId('clerk-signin')).toBeInTheDocument();
      // The student form should be hidden
      expect(screen.queryByLabelText(/student email/i)).not.toBeInTheDocument();
    });

    it('shows the Clerk sign-in form when Organiser role is selected', () => {
      render(<LoginPage />);

      const organiserButton = screen.getByRole('button', { name: /organiser/i });
      fireEvent.click(organiserButton);

      expect(screen.getByTestId('clerk-signin')).toBeInTheDocument();
      // The student form should be hidden
      expect(screen.queryByLabelText(/student email/i)).not.toBeInTheDocument();
    });
  });

  describe('Stored session', () => {
    it('redirects a stored student session straight to /student', () => {
      sessionState.session = { token: 'jwt-token', user: { id: 'user-1', role: 'student' } };

      render(<LoginPage />);

      expect(mockReplace).toHaveBeenCalledWith('/student');
    });
  });

  describe('Story panel', () => {
    it('displays the branding and messaging', () => {
      render(<LoginPage />);

      expect(screen.getAllByText('Olympiad').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Portal').length).toBeGreaterThan(0);
      expect(screen.getByText(/Return to your/i)).toBeInTheDocument();
      expect(screen.getByText(/best thinking/i)).toBeInTheDocument();
      expect(screen.getByText(/A place to keep growing/i)).toBeInTheDocument();
    });
  });

  describe('Query-param banners', () => {
    const originalLocation = window.location;

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    });

    function setLocationSearch(search) {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...originalLocation, search },
      });
    }

    it('shows a "deleted" banner when ?deleted=1 is in the URL', () => {
      setLocationSearch('?deleted=1');
      render(<LoginPage />);

      expect(screen.getByRole('alert')).toHaveTextContent(/account deleted/i);
    });

    it('shows a "session expired" banner when ?expired=1 is in the URL', () => {
      setLocationSearch('?expired=1');
      render(<LoginPage />);

      expect(screen.getByRole('alert')).toHaveTextContent(/session expired/i);
    });

    it('hides the deleted banner when the user picks a role', () => {
      setLocationSearch('?deleted=1');
      render(<LoginPage />);

      expect(screen.getByRole('alert')).toHaveTextContent(/account deleted/i);
      fireEvent.click(screen.getByRole('button', { name: /educator/i }));
      expect(screen.queryByText(/account deleted/i)).not.toBeInTheDocument();
    });
  });
});
