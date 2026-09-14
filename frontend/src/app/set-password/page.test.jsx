import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();

// Mutable URL token — individual tests override before rendering.
const tokenState = vi.hoisted(() => ({ token: 'invite-token' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () =>
    new URLSearchParams(tokenState.token ? `token=${tokenState.token}` : ''),
}));

vi.mock('@/lib/api', () => ({
  setStudentPassword: vi.fn(),
}));

vi.mock('@/lib/studentSession', () => ({
  setStudentSession: vi.fn(),
}));

import SetPasswordPage from './page';
import { setStudentPassword } from '@/lib/api';
import { setStudentSession } from '@/lib/studentSession';

// ── tests ────────────────────────────────────────────────────────────────────

describe('Set password page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenState.token = 'invite-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the activation form with a valid token', () => {
    render(<SetPasswordPage />);

    expect(screen.getByRole('heading', { name: /set your password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set password and sign in/i })).toBeInTheDocument();
  });

  it('shows an up-front error when the link has no token', () => {
    tokenState.token = null;

    render(<SetPasswordPage />);

    expect(screen.getByRole('alert')).toHaveTextContent(/missing its token/i);
    expect(screen.getByRole('button', { name: /set password and sign in/i })).toBeDisabled();
    expect(setStudentPassword).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than 8 characters', async () => {
    render(<SetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /set password and sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    expect(setStudentPassword).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    render(<SetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'longenough1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different1' } });
    fireEvent.click(screen.getByRole('button', { name: /set password and sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/passwords do not match/i);
    expect(setStudentPassword).not.toHaveBeenCalled();
  });

  it('sets the password, stores the session and redirects to /student', async () => {
    const session = {
      token: 'jwt-token',
      user: { id: 'user-1', email: 'student@school.com', role: 'student' },
    };
    setStudentPassword.mockResolvedValue(session);

    render(<SetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'longenough1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /set password and sign in/i }));

    await waitFor(() => {
      expect(setStudentPassword).toHaveBeenCalledWith({
        token: 'invite-token',
        password: 'longenough1',
      });
    });
    expect(setStudentSession).toHaveBeenCalledWith(session);
    expect(mockPush).toHaveBeenCalledWith('/student');
  });

  it('shows the backend error for an invalid or expired invitation token', async () => {
    setStudentPassword.mockRejectedValue(
      new Error('This invitation link is invalid or has expired')
    );

    render(<SetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'longenough1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /set password and sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/invalid or has expired/i);
    expect(setStudentSession).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    // The form stays so the educator can resend a fresh link
    expect(screen.getByRole('button', { name: /set password and sign in/i })).toBeEnabled();
  });
});
