import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mutable URL search params — individual tests override before rendering.
const paramsState = vi.hoisted(() => ({ id: 'result-1' }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(paramsState.id ? `id=${paramsState.id}` : ''),
}));

// Mutable session state — individual tests override before rendering.
const authState = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'student@school.com', role: 'student', name: 'Thabo', school: { id: 'school-1', name: 'Test School' }, entrantId: 'entrant-1' },
  checking: false,
}));

// Stable reference — the result-loading effect depends on getToken.
const mockGetToken = vi.fn().mockResolvedValue('mock-token');

vi.mock('@/hooks/useStudentAuth', () => ({
  useStudentAuth: () => ({
    user: authState.user,
    checking: authState.checking,
    getToken: mockGetToken,
    signOut: vi.fn(),
  }),
}));

vi.mock('@/lib/api', () => ({
  fetchMyResult: vi.fn(),
}));

import StudentResultPage from './page';
import { fetchMyResult } from '@/lib/api';
import { expectNoAxeViolations } from '@/test/axe';

function question(overrides = {}) {
  return {
    questionId: 'q1',
    correctAnswer: 'A',
    studentAnswer: 'A',
    isCorrect: true,
    ...overrides,
  };
}

function resultData(overrides = {}) {
  return {
    id: 'result-1',
    score: 67,
    submittedAt: '2026-09-01T11:00:00.000Z',
    releasedAt: '2026-09-02T08:00:00.000Z',
    round: { id: 'round-1', name: 'Round 1' },
    paperFileUrl: 'https://example.com/paper.pdf',
    questions: [question()],
    ...overrides,
  };
}

describe('StudentResultPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.checking = false;
    authState.user = { id: 'user-1', email: 'student@school.com', role: 'student', name: 'Thabo', entrantId: 'entrant-1' };
    paramsState.id = 'result-1';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state while the result loads', async () => {
    fetchMyResult.mockReturnValue(new Promise(() => {}));
    render(<StudentResultPage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMyResult).toHaveBeenCalledWith('result-1', 'mock-token')
    );
  });

  it('has no axe accessibility violations', async () => {
    fetchMyResult.mockResolvedValue(
      resultData({
        score: 80,
        questions: [
          question({ questionId: 'q1' }),
          question({ questionId: 'q2', correctAnswer: 'B', studentAnswer: 'C', isCorrect: false }),
        ],
      })
    );
    const { container } = render(<StudentResultPage />);
    await screen.findByText('80%');
    await expectNoAxeViolations(container);
  });

  it('renders the score, round name and question review', async () => {
    fetchMyResult.mockResolvedValue(
      resultData({
        score: 80,
        questions: [
          question({ questionId: 'q1' }),
          question({ questionId: 'q2', correctAnswer: 'B', studentAnswer: 'C', isCorrect: false }),
          question({ questionId: 'q3', correctAnswer: 'B', studentAnswer: null, isCorrect: false }),
        ],
      })
    );
    render(<StudentResultPage />);

    expect(await screen.findByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Round 1')).toBeInTheDocument();
    // 1 of 3 correct shows in the summary
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    // Per-question outcomes
    expect(screen.getByText('✓ Correct')).toBeInTheDocument();
    expect(screen.getAllByText('✗ Incorrect').length).toBe(2);

    // The correct answer is only revealed for questions the student got wrong
    expect(screen.getAllByText('Correct answer').length).toBe(2);
  });

  it('shows an unanswered question with a blank answer', async () => {
    fetchMyResult.mockResolvedValue(
      resultData({
        questions: [question({ questionId: 'q1', correctAnswer: 'B', studentAnswer: null, isCorrect: false })],
      })
    );
    render(<StudentResultPage />);

    await screen.findByText('✗ Incorrect');
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('links back to the student dashboard', async () => {
    fetchMyResult.mockResolvedValue(resultData());
    render(<StudentResultPage />);

    const back = await screen.findByRole('link', { name: /back to dashboard/i });
    expect(back).toHaveAttribute('href', '/student');
  });

  it('links to the original paper PDF when available', async () => {
    fetchMyResult.mockResolvedValue(resultData());
    render(<StudentResultPage />);

    const paper = await screen.findByRole('link', { name: /view the paper/i });
    expect(paper).toHaveAttribute('href', 'https://example.com/paper.pdf');
    expect(paper).toHaveAttribute('target', '_blank');
  });

  it('explains when no answer key review is available', async () => {
    fetchMyResult.mockResolvedValue(
      resultData({ paperFileUrl: null, questions: [] })
    );
    render(<StudentResultPage />);

    expect(
      await screen.findByText(/wasn't marked with an answer key/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view the paper/i })).not.toBeInTheDocument();
  });

  it('shows an error alert when the result cannot be loaded', async () => {
    fetchMyResult.mockRejectedValue(new Error('Result not found or not released yet'));
    render(<StudentResultPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/result not found or not released yet/i);
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeInTheDocument();
  });

  it('shows a message when no result id is in the URL', () => {
    paramsState.id = null;
    render(<StudentResultPage />);

    expect(screen.getByText(/no result was selected/i)).toBeInTheDocument();
    expect(fetchMyResult).not.toHaveBeenCalled();
  });
});
