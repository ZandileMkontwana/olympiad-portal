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
import { useRedirectIfAuthenticated } from './useAuthRedirect';

describe('useRedirectIfAuthenticated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue('mock-token'),
    });
  });

  it('redirects to dashboard when user is authenticated', async () => {
    fetchCurrentUser.mockResolvedValue({ id: '1', role: 'educator' });

    renderHook(() => useRedirectIfAuthenticated());

    await vi.waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/educator');
    });
  });

  it('redirects organiser to /organiser', async () => {
    fetchCurrentUser.mockResolvedValue({ id: '2', role: 'organiser' });

    renderHook(() => useRedirectIfAuthenticated());

    await vi.waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/organiser');
    });
  });

  it('recovers incomplete registration instead of leaving the account on the public page', async () => {
    fetchCurrentUser.mockResolvedValue(null);
    renderHook(() => useRedirectIfAuthenticated());
    await vi.waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/auth/check'));
  });

  it('sets checking to false when not authenticated', async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      getToken: vi.fn(),
    });

    const { result } = renderHook(() => useRedirectIfAuthenticated());

    await vi.waitFor(() => {
      expect(result.current).toBe(false);
    });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(fetchCurrentUser).not.toHaveBeenCalled();
  });

  it('returns true initially while Clerk is still loading', () => {
    mockUseAuth.mockReturnValue({
      isLoaded: false,
      isSignedIn: false,
      getToken: vi.fn(),
    });
    fetchCurrentUser.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useRedirectIfAuthenticated());
    expect(result.current).toBe(true);
  });

  it('passes Clerk token to fetchCurrentUser', async () => {
    fetchCurrentUser.mockResolvedValue({ id: '1', role: 'educator' });

    renderHook(() => useRedirectIfAuthenticated());

    await vi.waitFor(() => {
      expect(fetchCurrentUser).toHaveBeenCalledWith('mock-token');
    });
  });
});
