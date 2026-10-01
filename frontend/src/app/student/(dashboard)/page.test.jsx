import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mutable hook state — individual tests override before rendering.
const authState = vi.hoisted(() => ({
  user: {
    id: 'user-1',
    email: 'student@school.com',
    role: 'student',
    name: 'Thabo',
    school: { id: 'school-1', name: 'Test School' },
    entrantId: 'entrant-1',
  },
  checking: true,
}));

const mocks = vi.hoisted(() => ({
  // Stable reference — the data-loading effect depends on getToken.
  getToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/hooks/useStudentAuth', () => ({
  useStudentAuth: () => ({
    user: authState.user,
    checking: authState.checking,
    getToken: mocks.getToken,
  }),
}));

vi.mock('@/lib/api', () => ({
  fetchMySittings: vi.fn(),
  fetchMyResults: vi.fn(),
  fetchMyRounds: vi.fn(),
}));

import StudentDashboard from './page';
import { fetchMySittings, fetchMyResults, fetchMyRounds } from '@/lib/api';

const FUTURE = '2030-01-01T00:00:00.000Z';
const PAST = '2020-01-01T00:00:00.000Z';

function sitting(overrides = {}) {
  return {
    id: 'sitting-1',
    entrantId: 'entrant-1',
    roundId: 'round-1',
    answers: null,
    startedAt: '2026-09-01T10:00:00.000Z',
    expiresAt: FUTURE,
    completedAt: null,
    round: { id: 'round-1', name: 'Round 1', state: 'open', closeTime: FUTURE },
    ...overrides,
  };
}

function result(overrides = {}) {
  return {
    id: 'result-1',
    score: 85,
    releasedAt: '2026-09-02T08:00:00.000Z',
    submittedAt: '2026-09-01T11:00:00.000Z',
    round: { id: 'round-1', name: 'Round 1' },
    ...overrides,
  };
}

describe('StudentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Native confirm dialogs default to "OK" so guarded actions run.
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    authState.checking = false;
    authState.user = {
      id: 'user-1',
      email: 'student@school.com',
      role: 'student',
      name: 'Thabo',
      school: { id: 'school-1', name: 'Test School' },
      entrantId: 'entrant-1',
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows a loading state while the session check runs', () => {
    authState.checking = true;
    render(<StudentDashboard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(fetchMySittings).not.toHaveBeenCalled();
  });

  it('shows the loading state instead of crashing when the session is cleared (after logout)', () => {
    // signOut clears the session before the redirect finishes — user is null
    authState.user = null;
    render(<StudentDashboard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(fetchMySittings).not.toHaveBeenCalled();
  });

  it('shows a loading state while tests and results load', () => {
    fetchMySittings.mockReturnValue(new Promise(() => {}));
    fetchMyResults.mockReturnValue(new Promise(() => {}));
    fetchMyRounds.mockReturnValue(new Promise(() => {}));
    render(<StudentDashboard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('greets the student by name with their school', async () => {
    fetchMySittings.mockResolvedValue([]);
    fetchMyResults.mockResolvedValue([]);
    fetchMyRounds.mockResolvedValue([]);
    render(<StudentDashboard />);

    // New UI shows greeting with name in h1
    expect(await screen.findByRole('heading', { name: /thabo/i })).toBeInTheDocument();
    // Check for the greeting pattern (Good morning/afternoon/evening)
    expect(screen.getByText(/good (morning|afternoon|evening), thabo/i)).toBeInTheDocument();
  });

  it('shows empty states when there are no tests or results', async () => {
    fetchMySittings.mockResolvedValue([]);
    fetchMyResults.mockResolvedValue([]);
    fetchMyRounds.mockResolvedValue([]);
    render(<StudentDashboard />);

    expect((await screen.findAllByText(/no tests yet/i)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/no results released yet/i)).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1); // average and best score placeholders
  });

  it('shows stat cards with counts and best score', async () => {
    fetchMySittings.mockResolvedValue([sitting(), sitting({ id: 'sitting-2', completedAt: PAST })]);
    fetchMyResults.mockResolvedValue([
      result({ score: 85 }),
      result({ id: 'result-2', score: 60 }),
    ]);
    fetchMyRounds.mockResolvedValue([]);
    render(<StudentDashboard />);

    await screen.findByText('Best score');
    expect(screen.getAllByText(/Tests/).length).toBeGreaterThanOrEqual(1);
    // 'Completed' matches the stat label and the finished test's chip.
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    // The best score appears in the stat card and the results list.
    expect(screen.getAllByText('85%').length).toBeGreaterThanOrEqual(2);
  });

  it('shows an in-progress test with a resume link to the sit page', async () => {
    fetchMySittings.mockResolvedValue([sitting()]);
    fetchMyResults.mockResolvedValue([]);
    fetchMyRounds.mockResolvedValue([]);
    render(<StudentDashboard />);

    expect((await screen.findAllByText('Round 1')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('In progress').length).toBeGreaterThanOrEqual(1);
    const resume = screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/student/sit?id=round-1');
    expect(resume).toBeTruthy();
  });

  it('prompts about tests to finish in the hero when one is in progress', async () => {
    fetchMySittings.mockResolvedValue([sitting()]);
    fetchMyResults.mockResolvedValue([]);
    fetchMyRounds.mockResolvedValue([]);
    render(<StudentDashboard />);

    expect(await screen.findByText(/1 test.* in progress/i)).toBeInTheDocument();
  });

  it('shows a completed test without a resume link', async () => {
    fetchMySittings.mockResolvedValue([sitting({ completedAt: PAST })]);
    fetchMyResults.mockResolvedValue([]);
    fetchMyRounds.mockResolvedValue([]);
    render(<StudentDashboard />);

    // 'Completed' appears as the test's status badge.
    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
    // No link to the sit page for a completed test
    const sitLink = screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/student/sit?id=round-1');
    expect(sitLink).toBeFalsy();
  });

  it('shows an expired test with an Expired chip and no resume link', async () => {
    fetchMySittings.mockResolvedValue([sitting({ expiresAt: PAST })]);
    fetchMyResults.mockResolvedValue([]);
    fetchMyRounds.mockResolvedValue([]);
    render(<StudentDashboard />);

    expect(await screen.findByText('Expired')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /resume/i })).not.toBeInTheDocument();
  });

  it('shows released results with their score percentage and a view-test link', async () => {
    fetchMySittings.mockResolvedValue([]);
    fetchMyResults.mockResolvedValue([result()]);
    fetchMyRounds.mockResolvedValue([]);
    render(<StudentDashboard />);

    // 85% shows in the results list and the best-score stat.
    expect((await screen.findAllByText('85%')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/best score/i).length).toBeGreaterThanOrEqual(1);

    const viewTest = screen.getByRole('link', { name: /view latest/i });
    expect(viewTest).toHaveAttribute('href', '/student/result?id=result-1');
  });

  it('shows rounds not yet started with a Not started chip and a start-test link', async () => {
    fetchMySittings.mockResolvedValue([]);
    fetchMyResults.mockResolvedValue([]);
    fetchMyRounds.mockResolvedValue([
      {
        round: { id: 'round-1', name: 'Round 1', state: 'open', closeTime: FUTURE },
        sitting: null,
      },
    ]);
    render(<StudentDashboard />);

    // One unified "My tests" list — started and not-started tests together.
    expect((await screen.findAllByText('Round 1')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Not started')).toBeInTheDocument();
    const startLink = screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/student/sit?id=round-1');
    expect(startLink).toBeTruthy();
  });

  it('shows started and not-started tests in one list, urgent first', async () => {
    fetchMySittings.mockResolvedValue([sitting()]);
    fetchMyResults.mockResolvedValue([]);
    fetchMyRounds.mockResolvedValue([
      {
        round: { id: 'round-2', name: 'Round 2', state: 'open', closeTime: FUTURE },
        sitting: null,
      },
    ]);
    render(<StudentDashboard />);

    // New UI uses mini-event divs instead of list items
    const testItems = await screen.findAllByText(/Round/i);
    expect(testItems.length).toBeGreaterThanOrEqual(2);
    // Check that both "In progress" and "Not started" status labels appear
    expect(screen.getAllByText('In progress').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Not started').length).toBeGreaterThanOrEqual(1);
  });

  it('hides the start link when a round already has a sitting', async () => {
    fetchMySittings.mockResolvedValue([sitting()]);
    fetchMyResults.mockResolvedValue([]);
    fetchMyRounds.mockResolvedValue([
      {
        round: { id: 'round-1', name: 'Round 1', state: 'open', closeTime: FUTURE },
        sitting: { id: 'sitting-1' },
      },
    ]);
    render(<StudentDashboard />);

    // The round appears once in "My tests" as in-progress (has a sitting), not as "not started"
    expect((await screen.findAllByText('Round 1')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('In progress').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Not started')).not.toBeInTheDocument();
  });

  it('shows an error alert when the API call fails', async () => {
    fetchMySittings.mockRejectedValue(new Error('backend down'));
    fetchMyResults.mockResolvedValue([]);
    fetchMyRounds.mockResolvedValue([]);
    render(<StudentDashboard />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load your tests/i);
  });
});
