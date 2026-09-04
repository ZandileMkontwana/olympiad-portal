import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams('id=round-1'),
}));

// Mock @clerk/nextjs
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

// Mock @/lib/api
vi.mock('@/lib/api', () => ({
  createSitting: vi.fn(),
  saveSittingAnswers: vi.fn(),
  submitSitting: vi.fn(),
  fetchRoundEntrants: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

import SitPage from './page';
import { createSitting, saveSittingAnswers, submitSitting, fetchRoundEntrants, ApiError } from '@/lib/api';

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

async function startSitting(answers) {
  createSitting.mockResolvedValue(sittingResponse(answers));
  const view = render(<SitPage />);

  const select = await screen.findByLabelText(/who are you/i);
  fireEvent.change(select, { target: { value: 'entrant-1' } });
  fireEvent.click(screen.getByRole('button', { name: /start sitting/i }));
  await screen.findByLabelText(/answer for question q1/i);
  return view;
}

describe('SitPage auto-save (Story A3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchRoundEntrants.mockResolvedValue([{ id: 'entrant-1', name: 'Alice', grade: '11' }]);
    saveSittingAnswers.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves answers after typing and restores them after a refresh', async () => {
    // First visit: no saved answers yet
    const { unmount } = await startSitting(null);

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
    await startSitting({ q1: 'A', q2: 'B' });

    expect(screen.getByLabelText(/answer for question q1/i).value).toBe('A');
    expect(screen.getByLabelText(/answer for question q2/i).value).toBe('B');

    // Restored answers are not dirty - no save fires until something changes.
    expect(saveSittingAnswers).toHaveBeenCalledTimes(1);
  });
});

describe('SitPage submit (Story A5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchRoundEntrants.mockResolvedValue([{ id: 'entrant-1', name: 'Alice', grade: '11' }]);
    saveSittingAnswers.mockResolvedValue({});
    submitSitting.mockResolvedValue({ submission: { id: 'sub-1' }, result: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits the sitting and shows a confirmation', async () => {
    await startSitting({ q1: 'A', q2: 'B' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit sitting/i }));
    });

    expect(submitSitting).toHaveBeenCalledWith('sitting-1', 'mock-token');
    expect(screen.getByText(/submission received/i)).toBeTruthy();
    // The answer form is gone once submitted
    expect(screen.queryByLabelText(/answer for question q1/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /submit sitting/i })).toBeNull();
  });

  it('flushes unsaved answers before submitting', async () => {
    await startSitting(null);

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/answer for question q1/i), {
        target: { value: 'a' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit sitting/i }));
    });

    expect(submitSitting).toHaveBeenCalledWith('sitting-1', 'mock-token');
    // The typed answer was flushed to the server before the submit
    expect(saveSittingAnswers).toHaveBeenCalledWith('sitting-1', { q1: 'A' }, 'mock-token');
    expect(saveSittingAnswers).toHaveBeenCalledTimes(1);
  });

  it('shows the backend error and keeps the form when submission fails', async () => {
    submitSitting.mockRejectedValue(new ApiError('Sitting already completed', 403));

    await startSitting({ q1: 'A' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit sitting/i }));
    });

    expect(screen.getByText(/sitting already completed/i)).toBeTruthy();
    expect(screen.queryByText(/submission received/i)).toBeNull();
    // The form is still there so the student can retry
    expect(screen.getByLabelText(/answer for question q1/i)).toBeTruthy();
  });
});