import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Suppress expected console.error from the token-refresh failure test
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// Mock @/lib/studentSession
const mockGetSession = vi.fn();
const mockClearSession = vi.fn();
const mockIsTokenExpiringSoon = vi.fn().mockReturnValue(false);
vi.mock('@/lib/studentSession', () => ({
  getStudentSession: () => mockGetSession(),
  clearStudentSession: () => mockClearSession(),
  isTokenExpiringSoon: (...args) => mockIsTokenExpiringSoon(...args),
}));

// Mock @/lib/api
const mockRefreshSessionToken = vi.fn();
vi.mock('@/lib/api', () => ({
  refreshSessionToken: (...args) => mockRefreshSessionToken(...args),
}));

import { useStudentAuth } from './useStudentAuth';

describe('useStudentAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTokenExpiringSoon.mockReturnValue(false);
  });

  it('returns null user and checking=true initially', () => {
    mockGetSession.mockReturnValue(null);
    // Never resolve so we can inspect initial state
    mockGetSession.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useStudentAuth());
    expect(result.current.user).toBeNull();
    expect(result.current.checking).toBe(true);
  });

  it('redirects to /login when no session is stored', async () => {
    mockGetSession.mockResolvedValue(null);

    renderHook(() => useStudentAuth());

    await vi.waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('sets user and checking=false when a session exists', async () => {
    const mockUser = { id: 'u1', email: 'student@school.com', role: 'student', name: 'Alice' };
    mockGetSession.mockResolvedValue({ token: 'jwt-token', user: mockUser });

    const { result } = renderHook(() => useStudentAuth());

    await vi.waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.checking).toBe(false);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('getToken resolves with the session token', async () => {
    const mockUser = { id: 'u1', email: 's@s.com', role: 'student' };
    mockGetSession.mockResolvedValue({ token: 'my-jwt', user: mockUser });

    const { result } = renderHook(() => useStudentAuth());

    await vi.waitFor(() => {
      expect(result.current.checking).toBe(false);
    });

    const token = await result.current.getToken();
    expect(token).toBe('my-jwt');
  });

  it('getToken resolves with null when there is no session', async () => {
    mockGetSession.mockResolvedValue(null);

    const { result } = renderHook(() => useStudentAuth());

    await vi.waitFor(() => {
      expect(result.current.checking).toBe(false);
    });

    const token = await result.current.getToken();
    expect(token).toBeNull();
  });

  it('signOut clears the session and redirects to /login', async () => {
    const mockUser = { id: 'u1', email: 's@s.com', role: 'student' };
    mockGetSession.mockResolvedValue({ token: 'jwt', user: mockUser });

    const { result } = renderHook(() => useStudentAuth());

    await vi.waitFor(() => {
      expect(result.current.checking).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockClearSession).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('signOut redirects to a custom redirectUrl when provided', async () => {
    const mockUser = { id: 'u1', email: 's@s.com', role: 'student' };
    mockGetSession.mockResolvedValue({ token: 'jwt', user: mockUser });

    const { result } = renderHook(() => useStudentAuth());

    await vi.waitFor(() => {
      expect(result.current.checking).toBe(false);
    });

    await act(async () => {
      await result.current.signOut({ redirectUrl: '/goodbye' });
    });

    expect(mockReplace).toHaveBeenCalledWith('/goodbye');
  });

  it('does not redirect after unmount', async () => {
    let resolveSession;
    mockGetSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      })
    );

    const { unmount } = renderHook(() => useStudentAuth());
    unmount();

    resolveSession(null);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('refreshes the token when it is expiring soon', async () => {
    const mockUser = { id: 'u1', email: 's@s.com', role: 'student' };
    mockGetSession.mockResolvedValue({ token: 'old-jwt', user: mockUser });
    mockIsTokenExpiringSoon.mockReturnValue(true);
    mockRefreshSessionToken.mockResolvedValue({ token: 'new-jwt', user: mockUser });

    renderHook(() => useStudentAuth());

    await vi.waitFor(() => {
      expect(mockRefreshSessionToken).toHaveBeenCalledWith('old-jwt');
    });
  });

  it('clears session and redirects when token refresh fails', async () => {
    const mockUser = { id: 'u1', email: 's@s.com', role: 'student' };
    mockGetSession.mockResolvedValue({ token: 'old-jwt', user: mockUser });
    mockIsTokenExpiringSoon.mockReturnValue(true);
    mockRefreshSessionToken.mockRejectedValue(new Error('Token expired'));

    renderHook(() => useStudentAuth());

    await vi.waitFor(() => {
      expect(mockClearSession).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login?expired=1');
    });
  });
});
