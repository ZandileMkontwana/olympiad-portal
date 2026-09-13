import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mutable Clerk auth state — individual tests override before rendering.
const authState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true,
  getToken: vi.fn(),
}));

// Mock @clerk/nextjs — the page uses useAuth and renders <SignUp> when signed out.
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => authState,
  SignUp: () => <div data-testid="clerk-signup">Clerk signup</div>,
}));

// Mock @/lib/api — the page only needs listSchools.
vi.mock('@/lib/api', () => ({
  listSchools: vi.fn(),
}));

import RegisterStudentPage from './page';
import { listSchools } from '@/lib/api';

function mockFetchOk(user) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: () => Promise.resolve({ user }),
  });
}

function mockFetchError(status, error) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  });
}

describe('RegisterStudentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:5000';
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.getToken.mockResolvedValue('mock-token');
    listSchools.mockResolvedValue([
      { id: 'school-1', name: 'Test School' },
      { id: 'school-2', name: 'Wits High School' },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state while Clerk loads', () => {
    authState.isLoaded = false;
    render(<RegisterStudentPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows the Clerk signup form when not signed in', () => {
    authState.isSignedIn = false;
    render(<RegisterStudentPage />);
    expect(screen.getByTestId('clerk-signup')).toBeInTheDocument();
  });

  it('shows the complete-profile form when signed in', async () => {
    render(<RegisterStudentPage />);
    expect(await screen.findByRole('heading', { name: /finish setting up your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it('loads schools into the dropdown', async () => {
    render(<RegisterStudentPage />);
    const select = await screen.findByLabelText(/school/i);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test School' })).toBeInTheDocument();
    });
    fireEvent.change(select, { target: { value: 'Wits High School' } });
    expect(select.value).toBe('Wits High School');
  });

  it('falls back to a text input when the schools list cannot load', async () => {
    listSchools.mockRejectedValue(new Error('backend down'));
    render(<RegisterStudentPage />);
    // The select renders first — the input swap happens once the rejection lands.
    await waitFor(() => {
      expect(screen.getByLabelText(/school/i).tagName).toBe('INPUT');
    });
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('shows field errors and does not submit when fields are empty', async () => {
    mockFetchOk({});
    render(<RegisterStudentPage />);
    await screen.findByLabelText(/school/i);
    fireEvent.click(screen.getByRole('button', { name: /finish setup/i }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('School name is required.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('submits trimmed name and school with the bearer token and shows success', async () => {
    mockFetchOk({ name: 'Thabo', role: 'student', school: 'Test School' });
    render(<RegisterStudentPage />);

    const select = await screen.findByLabelText(/school/i);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test School' })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: '  Thabo  ' } });
    fireEvent.change(select, { target: { value: 'Test School' } });
    fireEvent.click(screen.getByRole('button', { name: /finish setup/i }));

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/account created/i)).toBeInTheDocument();
    expect(screen.getByText(/registered as a student at test school/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/students/complete-profile',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
      })
    );
    const [, options] = global.fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ name: 'Thabo', schoolName: 'Test School' });
  });

  it('shows the backend error when no unclaimed entrant matches', async () => {
    mockFetchError(404, 'No unclaimed entrant record found matching that name and school');
    render(<RegisterStudentPage />);

    const select = await screen.findByLabelText(/school/i);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test School' })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Nobody' } });
    fireEvent.change(select, { target: { value: 'Test School' } });
    fireEvent.click(screen.getByRole('button', { name: /finish setup/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no unclaimed entrant/i);
  });
});
