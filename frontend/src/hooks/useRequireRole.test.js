import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// Mock @clerk/nextjs
const mockUseAuth = vi.fn();
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock @/lib/api
vi.mock('@/lib/api', () => ({
  fetchCurrentUser: vi.fn(),
  dashboardPathForRole: (role) => {
    if (role === 'organiser') return '/organiser';
    if (role === 'educator') return '/educator';
    return '/login';
  },
}));

import { fetchCurrentUser } from '@/lib/api';
import { useRequireRole } from './useRequireRole';

describe('useRequireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue('mock-token'),
    });
  });

  it('redirects to /login when not authenticated', async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      getToken: vi.fn(),
    });

    renderHook(() => useRequireRole('educator'));

    await vi.waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
    expect(fetchCurrentUser).not.toHaveBeenCalled();
  });

  it('redirects to dashboard when role does not match', async () => {
    fetchCurrentUser.mockResolvedValue({ id: '1', role: 'organiser' });

    renderHook(() => useRequireRole('educator'));

    await vi.waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/organiser');
    });
  });

  it('sends signed-in accounts with no profile to the recovery check', async () => {
    fetchCurrentUser.mockResolvedValue(null);
    renderHook(() => useRequireRole('educator'));
    await vi.waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/auth/check'));
  });

  it('sets user and checking=false when role matches', async () => {
    const mockUser = { id: '1', role: 'educator', email: 'a@b.com' };
    fetchCurrentUser.mockResolvedValue(mockUser);

    const { result } = renderHook(() => useRequireRole('educator'));

    await vi.waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.checking).toBe(false);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('returns null user and checking=true initially', () => {
    fetchCurrentUser.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useRequireRole('educator'));
    expect(result.current.user).toBeNull();
    expect(result.current.checking).toBe(true);
  });

  it('does not redirect after unmount', async () => {
    let resolveFetch;
    fetchCurrentUser.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { unmount } = renderHook(() => useRequireRole('educator'));
    unmount();

    resolveFetch({ id: '1', role: 'educator' });

    // Give microtasks a chance to flush
    await new Promise((r) => setTimeout(r, 0));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('passes Clerk token to fetchCurrentUser', async () => {
    fetchCurrentUser.mockResolvedValue({ id: '1', role: 'educator' });

    renderHook(() => useRequireRole('educator'));

    await vi.waitFor(() => {
      expect(fetchCurrentUser).toHaveBeenCalledWith('mock-token');
    });
  });
});
