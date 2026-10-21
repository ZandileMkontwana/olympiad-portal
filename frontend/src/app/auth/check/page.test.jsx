import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const state = vi.hoisted(() => ({
  replace: vi.fn(),
  signOut: vi.fn(),
  getToken: vi.fn(),
  params: new URLSearchParams(),
  isLoaded: true,
  isSignedIn: true,
}));
vi.mock('next/navigation', () => {
  const router = { replace: state.replace };
  return { useRouter: () => router, useSearchParams: () => state.params };
});
vi.mock('@clerk/nextjs', () => ({ useAuth: () => state, useClerk: () => state }));
vi.mock('@/lib/api', () => ({
  fetchCurrentUser: vi.fn(),
  dashboardPathForRole: (role) => `/${role}`,
}));

import { fetchCurrentUser } from '@/lib/api';
import AuthCheckPage from './page';

describe('Account check after Clerk authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.isLoaded = true;
    state.isSignedIn = true;
    state.params = new URLSearchParams();
    state.getToken.mockResolvedValue('clerk-token');
    fetchCurrentUser.mockResolvedValue(null);
  });

  it('sends a verified account without a portal profile to profile completion', async () => {
    render(<AuthCheckPage />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/complete-profile'));
    expect(fetchCurrentUser).toHaveBeenCalledWith('clerk-token', { throwOnError: true });
  });

  it.each(['educator', 'organiser', 'student'])(
    'routes an existing %s account to its dashboard',
    async (role) => {
      fetchCurrentUser.mockResolvedValue({ id: 'user-1', role });
      render(<AuthCheckPage />);
      await waitFor(() => expect(state.replace).toHaveBeenCalledWith(`/${role}`));
    }
  );

  it('lets an educator signing in recover an incomplete registration', async () => {
    state.params = new URLSearchParams('expectedRole=educator');
    render(<AuthCheckPage />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/complete-profile'));
  });

  it('explains organiser provisioning without creating an educator profile automatically', async () => {
    state.params = new URLSearchParams('expectedRole=organiser');
    render(<AuthCheckPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /organiser access must be set up by an administrator/i
    );
    expect(state.replace).not.toHaveBeenCalled();
  });

  it('preserves role mismatch handling for provisioned accounts', async () => {
    state.params = new URLSearchParams('expectedRole=organiser');
    fetchCurrentUser.mockResolvedValue({ role: 'educator' });
    render(<AuthCheckPage />);
    await waitFor(() =>
      expect(state.replace).toHaveBeenCalledWith(
        '/login?error=role_mismatch&expected=organiser&actual=educator'
      )
    );
  });

  it('keeps server failures on the page and allows retry without losing the session', async () => {
    fetchCurrentUser
      .mockRejectedValueOnce(new Error('Server unavailable'))
      .mockResolvedValueOnce({ role: 'educator' });
    render(<AuthCheckPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
    expect(state.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/educator'));
  });

  it('waits for Clerk to load and redirects signed-out users to login', async () => {
    state.isLoaded = false;
    const { rerender } = render(<AuthCheckPage />);
    expect(fetchCurrentUser).not.toHaveBeenCalled();
    state.isLoaded = true;
    state.isSignedIn = false;
    rerender(<AuthCheckPage />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/login'));
  });
});
