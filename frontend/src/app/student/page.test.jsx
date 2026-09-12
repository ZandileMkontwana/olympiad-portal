import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mutable hook state — individual tests override before rendering.
const roleState = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'student@school.com', role: 'student', name: 'Thabo', school: 'Test School' },
  checking: true,
}));

const mocks = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/useRequireRole', () => ({
  useRequireRole: () => roleState,
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('mock-token') }),
  useClerk: () => ({ signOut: mocks.signOut }),
}));

vi.mock('@/lib/api', () => ({
  fetchMySittings: vi.fn(),
  fetchMyResults: vi.fn(),
}));

import StudentDashboard from './page';
import { fetchMySittings, fetchMyResults } from '@/lib/api';

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
    vi.stubGlobal('confirm', vi.fn(() => true));
    roleState.checking = false;
    roleState.user = {
      id: 'user-1',
      email: 'student@school.com',
      role: 'student',
      name: 'Thabo',
      school: 'Test School',
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows a loading state while the role check runs', () => {
    roleState.checking = true;
    render(<StudentDashboard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(fetchMySittings).not.toHaveBeenCalled();
  });

  it('shows a loading state while tests and results load', () => {
    fetchMySittings.mockReturnValue(new Promise(() => {}));
    fetchMyResults.mockReturnValue(new Promise(() => {}));
    render(<StudentDashboard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('greets the student by name with their school', async () => {
    fetchMySittings.mockResolvedValue([]);
    fetchMyResults.mockResolvedValue([]);
    render(<StudentDashboard />);

    expect(await screen.findByRole('heading', { name: /welcome back, thabo/i })).toBeInTheDocument();
    expect(screen.getByText('Test School')).toBeInTheDocument();
  });

  it('shows empty states when there are no tests or results', async () => {
    fetchMySittings.mockResolvedValue([]);
    fetchMyResults.mockResolvedValue([]);
    render(<StudentDashboard />);

    expect(await screen.findByText(/no tests yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no results released yet/i)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // best score placeholder
  });

  it('shows stat cards with counts and best score', async () => {
    fetchMySittings.mockResolvedValue([sitting(), sitting({ id: 'sitting-2', completedAt: PAST })]);
    fetchMyResults.mockResolvedValue([result({ score: 85 }), result({ id: 'result-2', score: 60 })]);
    render(<StudentDashboard />);

    await screen.findByText('Best score');
    expect(screen.getByText('Tests')).toBeInTheDocument();
    // 'Completed' matches the stat label and the finished test's chip.
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    // The best score appears in the stat card and the results list.
    expect(screen.getAllByText('85%').length).toBeGreaterThanOrEqual(2);
  });

  it('shows an in-progress test with a resume link to the sit page', async () => {
    fetchMySittings.mockResolvedValue([sitting()]);
    fetchMyResults.mockResolvedValue([]);
    render(<StudentDashboard />);

    expect(await screen.findByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    const resume = screen.getAllByRole('link', { name: /resume/i })[0];
    expect(resume).toHaveAttribute('href', '/student/sit?id=round-1');
  });

  it('prompts about tests to finish in the hero when one is in progress', async () => {
    fetchMySittings.mockResolvedValue([sitting()]);
    fetchMyResults.mockResolvedValue([]);
    render(<StudentDashboard />);

    expect(await screen.findByText(/1 test to finish/i)).toBeInTheDocument();
  });

  it('shows a completed test without a resume link', async () => {
    fetchMySittings.mockResolvedValue([sitting({ completedAt: PAST })]);
    fetchMyResults.mockResolvedValue([]);
    render(<StudentDashboard />);

    // 'Completed' appears in both the test's status chip and the stat label.
    await waitFor(() => {
      expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByRole('link', { name: /resume/i })).not.toBeInTheDocument();
  });

  it('shows an expired test with an Expired chip and no resume link', async () => {
    fetchMySittings.mockResolvedValue([sitting({ expiresAt: PAST })]);
    fetchMyResults.mockResolvedValue([]);
    render(<StudentDashboard />);

    expect(await screen.findByText('Expired')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /resume/i })).not.toBeInTheDocument();
  });

  it('shows released results with their score percentage and a view-test link', async () => {
    fetchMySittings.mockResolvedValue([]);
    fetchMyResults.mockResolvedValue([result()]);
    render(<StudentDashboard />);

    // 85% shows in the results list and the best-score stat.
    expect((await screen.findAllByText('85%')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/best:/i)).toBeInTheDocument();

    const viewTest = screen.getByRole('link', { name: /view test/i });
    expect(viewTest).toHaveAttribute('href', '/student/result?id=result-1');
  });

  it('shows an error alert when the API call fails', async () => {
    fetchMySittings.mockRejectedValue(new Error('backend down'));
    fetchMyResults.mockResolvedValue([]);
    render(<StudentDashboard />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load your tests/i);
  });

  it('signs the student out when clicking log out and confirming', async () => {
    fetchMySittings.mockResolvedValue([]);
    fetchMyResults.mockResolvedValue([]);
    render(<StudentDashboard />);

    fireEvent.click(await screen.findByRole('button', { name: /log out/i }));
    await vi.waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledWith({ redirectUrl: '/login' });
    });
  });

  it('asks for confirmation before logging out and stays when cancelled', async () => {
    confirm.mockReturnValue(false);
    fetchMySittings.mockResolvedValue([]);
    fetchMyResults.mockResolvedValue([]);
    render(<StudentDashboard />);

    fireEvent.click(await screen.findByRole('button', { name: /log out/i }));
    expect(confirm).toHaveBeenCalledWith('Log out of the Olympiad Portal?');
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
