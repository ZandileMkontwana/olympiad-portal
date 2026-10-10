import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams('id=round-1'),
}));

// Mutable session state — individual tests override before rendering.
const authState = vi.hoisted(() => ({
  user: {
    id: 'user-1',
    email: 'student@school.com',
    role: 'student',
    name: 'Thabo',
    entrantId: 'entrant-1',
  },
  checking: false,
}));

const mockClearStudentSession = vi.hoisted(() => vi.fn());

// Stable references for the student session — getToken MUST be stable across
// renders, otherwise the auto-save useEffect (which depends on getToken) clears
// and restarts its debounce timer on every render, causing timeouts.
const mockGetToken = vi.fn().mockResolvedValue('mock-token');
vi.mock('@/hooks/useStudentAuth', () => ({
  useStudentAuth: () => ({
    user: authState.user,
    checking: authState.checking,
    getToken: mockGetToken,
    signOut: vi.fn(),
  }),
}));

// Mock @/lib/api
vi.mock('@/lib/api', () => ({
  createSitting: vi.fn(),
  saveSittingAnswers: vi.fn(),
  flushSittingAnswers: vi.fn(),
  submitSitting: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

// Mock @/lib/studentSession
vi.mock('@/lib/studentSession', () => ({
  clearStudentSession: mockClearStudentSession,
}));

import SitPage from './page';
import { createSitting, saveSittingAnswers, flushSittingAnswers, submitSitting, ApiError } from '@/lib/api';

const sittingResponse = (answers) => ({
  sitting: {
    id: 'sitting-1',
    entrantId: 'entrant-1',
    roundId: 'round-1',
    answers,
    startedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2030-01-01T00:00:00.000Z',
    completedAt: null,
  },
  round: { id: 'round-1', name: 'Round 1', closeTime: '2030-01-01T00:00:00.000Z' },
  paper: {
    fileUrl: 'https://test.supabase.co/paper.pdf',
    questions: ['q1', 'q2'],
  },
});

async function renderAndStart(answers) {
  createSitting.mockResolvedValue(sittingResponse(answers));
  const view = render(<SitPage />);
  await screen.findByLabelText(/answer for question q1/i);
  return view;
}

describe('SitPage auto-detect and start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveSittingAnswers.mockResolvedValue({});
    authState.checking = false;
    authState.user = {
      id: 'user-1',
      email: 'student@school.com',
      role: 'student',
      name: 'Thabo',
      entrantId: 'entrant-1',
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts the sitting for the signed-in student without a dropdown', async () => {
    await renderAndStart(null);

    expect(createSitting).toHaveBeenCalledWith('round-1', 'entrant-1', 'mock-token');
    // No dropdown should exist
    expect(screen.queryByLabelText(/who are you/i)).toBeNull();
  });

  it('redirects to the login page when there is no student session', async () => {
    authState.user = null;
    render(<SitPage />);

    await vi.waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
    expect(createSitting).not.toHaveBeenCalled();
  });

  it('shows an error when the account has no linked entrant record', async () => {
    authState.user = { id: 'user-2', email: 'orphan@school.com', role: 'student', entrantId: null };
    render(<SitPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /not linked to a student record/i
    );
    expect(createSitting).not.toHaveBeenCalled();
  });

  it('shows the backend error when createSitting fails', async () => {
    createSitting.mockRejectedValue(new ApiError('Not registered for this round', 403));
    render(<SitPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/not registered/i);
  });
});

describe('SitPage auto-save (Story A3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveSittingAnswers.mockResolvedValue({});
    authState.checking = false;
    authState.user = {
      id: 'user-1',
      email: 'student@school.com',
      role: 'student',
      name: 'Thabo',
      entrantId: 'entrant-1',
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it(
    'saves answers after typing and restores them after a refresh',
    async () => {
      // First visit: no saved answers yet
      const { unmount } = await renderAndStart(null);

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/answer for question q1/i), {
          target: { value: 'a' },
        });
      });
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/answer for question q2/i), {
          target: { value: 'b' },
        });
      });

      // The debounce (1s) sends the auto-save
      await vi.waitFor(
        () => {
          expect(saveSittingAnswers).toHaveBeenCalledWith(
            'sitting-1',
            { q1: 'A', q2: 'B' },
            'mock-token'
          );
        },
        { timeout: 4000 }
      );

      // Refresh = unmount + re-render. The server now returns the saved answers.
      unmount();
      await renderAndStart({ q1: 'A', q2: 'B' });

      expect(screen.getByLabelText(/answer for question q1/i).value).toBe('A');
      expect(screen.getByLabelText(/answer for question q2/i).value).toBe('B');

      // Restored answers are not dirty - no save fires until something changes.
      expect(saveSittingAnswers).toHaveBeenCalledTimes(1);
    },
    15000
  );
});

describe('SitPage submit (Story A5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Native confirm dialogs default to "OK" so guarded actions run.
    vi.stubGlobal('confirm', vi.fn(() => true));
    saveSittingAnswers.mockResolvedValue({});
    submitSitting.mockResolvedValue({ submission: { id: 'sub-1' }, result: null });
    authState.checking = false;
    authState.user = {
      id: 'user-1',
      email: 'student@school.com',
      role: 'student',
      name: 'Thabo',
      entrantId: 'entrant-1',
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('submits the test and shows a confirmation', async () => {
    await renderAndStart({ q1: 'A', q2: 'B' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit test/i }));
    });

    expect(submitSitting).toHaveBeenCalledWith('sitting-1', 'mock-token');
    expect(screen.getByText(/submission received/i)).toBeTruthy();
    // The answer form is gone once submitted
    expect(screen.queryByLabelText(/answer for question q1/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /submit test/i })).toBeNull();
  });

  it('asks for confirmation before submitting and stays when cancelled', async () => {
    await renderAndStart({ q1: 'A', q2: 'B' });
    confirm.mockReturnValue(false);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit test/i }));
    });

    expect(confirm).toHaveBeenCalledWith(
      expect.stringMatching(/you answered 2 of 2 questions/i)
    );
    expect(submitSitting).not.toHaveBeenCalled();
    // The form is still there so the student can keep going
    expect(screen.getByLabelText(/answer for question q1/i)).toBeTruthy();
  });

  it(
    'flushes unsaved answers before submitting',
    async () => {
      await renderAndStart(null);

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/answer for question q1/i), {
          target: { value: 'a' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /submit test/i }));
      });

      expect(submitSitting).toHaveBeenCalledWith('sitting-1', 'mock-token');
      // The typed answer was flushed to the server before the submit
      expect(saveSittingAnswers).toHaveBeenCalledWith('sitting-1', { q1: 'A' }, 'mock-token');
      expect(saveSittingAnswers).toHaveBeenCalledTimes(1);
    },
    15000
  );

  it('shows the backend error and keeps the form when submission fails', async () => {
    submitSitting.mockRejectedValue(new ApiError('Test already completed', 403));

    await renderAndStart({ q1: 'A' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit test/i }));
    });

    expect(screen.getByText(/test already completed/i)).toBeTruthy();
    expect(screen.queryByText(/submission received/i)).toBeNull();
    // The form is still there so the student can retry
    expect(screen.getByLabelText(/answer for question q1/i)).toBeTruthy();
  });
});

describe('SitPage JWT expiry handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveSittingAnswers.mockResolvedValue({});
    submitSitting.mockResolvedValue({ submission: { id: 'sub-1' }, result: null });
    authState.checking = false;
    authState.user = {
      id: 'user-1',
      email: 'student@school.com',
      role: 'student',
      name: 'Thabo',
      entrantId: 'entrant-1',
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('redirects to login and clears session when createSitting returns 401', async () => {
    createSitting.mockRejectedValue(new ApiError('Not authenticated', 401));
    render(<SitPage />);

    await vi.waitFor(() => {
      expect(mockClearStudentSession).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login?expired=1');
    });
  });

  it(
    'redirects to login and clears session when auto-save returns 401',
    async () => {
      await renderAndStart(null);

      // Type an answer to trigger auto-save
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/answer for question q1/i), {
          target: { value: 'a' },
        });
      });

      // Make the auto-save return 401
      saveSittingAnswers.mockRejectedValueOnce(new ApiError('Not authenticated', 401));

      // Wait for the debounce (1s) + auto-save to fire
      await vi.waitFor(
        () => {
          expect(mockClearStudentSession).toHaveBeenCalled();
          expect(mockReplace).toHaveBeenCalledWith('/login?expired=1');
        },
        { timeout: 4000 }
      );
    },
    15000
  );

  it('redirects to login and clears session when submit returns 401', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    submitSitting.mockRejectedValue(new ApiError('Not authenticated', 401));

    await renderAndStart({ q1: 'A' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit test/i }));
    });

    expect(mockClearStudentSession).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/login?expired=1');
  });
});

describe('SitPage beforeunload flush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveSittingAnswers.mockResolvedValue({});
    authState.checking = false;
    authState.user = {
      id: 'user-1',
      email: 'student@school.com',
      role: 'student',
      name: 'Thabo',
      entrantId: 'entrant-1',
    };
    // Mock localStorage for the beforeunload handler
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => {
        if (key === 'studentSession') return JSON.stringify({ token: 'mock-token', user: {} });
        return null;
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it(
    'flushes dirty answers on beforeunload',
    async () => {
      await renderAndStart(null);

      // Type an answer to make the sitting dirty
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/answer for question q1/i), {
          target: { value: 'a' },
        });
      });

      // Simulate beforeunload
      const event = new Event('beforeunload');
      fireEvent(window, event);

      expect(flushSittingAnswers).toHaveBeenCalledWith(
        'sitting-1',
        { q1: 'A' },
        'mock-token'
      );
    },
    15000
  );

  it('does not flush on beforeunload when there are no dirty answers', async () => {
    await renderAndStart({ q1: 'A' });

    // No answers changed — sitting is not dirty
    const event = new Event('beforeunload');
    fireEvent(window, event);

    expect(flushSittingAnswers).not.toHaveBeenCalled();
  });
});
