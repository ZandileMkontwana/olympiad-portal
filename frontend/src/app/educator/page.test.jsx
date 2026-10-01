import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── mocks ────────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  email: 'teacher@school.com',
  role: 'educator',
  name: 'Ms Teacher',
};

const memberOlympiad = {
  id: 'olympiad-1',
  name: 'Maths Olympiad',
  schoolAccess: 'approved',
  rounds: [
    {
      id: 'round-1',
      name: 'Round One',
      state: 'open',
      openTime: '2026-01-01T00:00:00.000Z',
      closeTime: '2099-01-01T00:00:00.000Z',
    },
  ],
};

const foreignOlympiad = {
  id: 'olympiad-2',
  name: 'Science Olympiad',
  schoolAccess: 'none',
  description: 'A general science olympiad.',
  grades: 'Grade 8–12',
  startDate: '2026-02-01T00:00:00.000Z',
  endDate: '2026-03-01T00:00:00.000Z',
  schoolEntrantCounts: [
    { schoolName: 'Testville High', entrantCount: 4 },
    { schoolName: 'Riverton High', entrantCount: 2 },
  ],
  rounds: [
    {
      id: 'round-2',
      name: 'Science Round One',
      state: 'open',
      openTime: '2026-01-01T00:00:00.000Z',
      closeTime: '2099-01-01T00:00:00.000Z',
    },
  ],
};

// Stable across renders so the olympiads effect doesn't re-run and wipe the
// optimistic access state mid-test.
const mockGetToken = vi.fn().mockResolvedValue('mock-token');

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/useRequireRole', () => ({
  useRequireRole: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  listOlympiads: vi.fn(),
  requestOlympiadAccess: vi.fn(),
}));

import EducatorDashboard from './page';
import { useRequireRole } from '@/hooks/useRequireRole';
import { listOlympiads, requestOlympiadAccess } from '@/lib/api';

// ── helpers ──────────────────────────────────────────────────────────────────

function setupUser(user = mockUser) {
  useRequireRole.mockReturnValue({ user, checking: false });
}

function setupChecking() {
  useRequireRole.mockReturnValue({ user: null, checking: true });
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('Educator Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('mock-token');
    listOlympiads.mockResolvedValue([memberOlympiad, foreignOlympiad]);
    setupUser();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── loading & error states ──────────────────────────────────────────────────

  it('shows a loading message while checking auth', () => {
    setupChecking();
    render(<EducatorDashboard />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows an error message when the olympiads fail to load', async () => {
    listOlympiads.mockRejectedValue(new Error('Network'));
    render(<EducatorDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Couldn.t load olympiads/)).toBeTruthy();
    });
  });

  it('shows an empty state when there are no olympiads', async () => {
    listOlympiads.mockResolvedValue([]);
    render(<EducatorDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/No olympiads available yet/)).toBeTruthy();
    });
  });

  it('loads olympiads with the Clerk token', async () => {
    render(<EducatorDashboard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Maths Olympiad/ })).toBeTruthy();
    });
    expect(listOlympiads).toHaveBeenCalledWith('mock-token');
  });

  // ── member olympiad ─────────────────────────────────────────────────────────

  it('expands an approved olympiad into its rounds list', async () => {
    render(<EducatorDashboard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Maths Olympiad/ })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Maths Olympiad/ }));

    expect(screen.getByRole('link', { name: /Round One/ })).toBeTruthy();
  });

  // ── non-member info card ────────────────────────────────────────────────────

  it('expands a non-member olympiad into the info card', async () => {
    render(<EducatorDashboard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Science Olympiad/ })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Science Olympiad/ }));

    // Organiser-set info is shown instead of the rounds
    expect(screen.getByText('A general science olympiad.')).toBeTruthy();
    // Dates show on both the card header and the info panel
    expect(screen.getAllByText(/Feb 2026/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Mar 2026/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Grade 8–12/)).toBeTruthy();
    expect(screen.getByText('Testville High')).toBeTruthy();
    expect(screen.getByText('4 learners')).toBeTruthy();
    expect(screen.getByText('Riverton High')).toBeTruthy();
    expect(screen.getByText('2 learners')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request access' })).toBeTruthy();
    // Its rounds stay hidden — the school can't act on them yet
    expect(screen.queryByRole('link', { name: /Science Round One/ })).toBeNull();
  });

  it('shows fallbacks when the organiser has not filled in the info yet', async () => {
    listOlympiads.mockResolvedValue([
      {
        ...foreignOlympiad,
        description: null,
        grades: null,
        startDate: null,
        endDate: null,
        schoolEntrantCounts: [],
      },
    ]);
    render(<EducatorDashboard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Science Olympiad/ })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Science Olympiad/ }));

    expect(screen.getByText('No description yet.')).toBeTruthy();
    // The card header, date chip, and grades chip all fall back to TBC
    expect(screen.getAllByText(/TBC/)).toHaveLength(3);
    expect(screen.getByText(/No learners registered yet/)).toBeTruthy();
  });

  // ── pending state ────────────────────────────────────────────────────────────

  it('shows the waiting state for a pending access request', async () => {
    listOlympiads.mockResolvedValue([{ ...foreignOlympiad, schoolAccess: 'pending' }]);
    render(<EducatorDashboard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Science Olympiad/ })).toBeTruthy();
    });

    // The pending badge shows on the collapsed card header
    expect(screen.getByText('Requested')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Science Olympiad/ }));

    expect(
      screen.getByText(/Access requested — waiting for the organiser to approve/)
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Request access/ })).toBeNull();
  });

  // ── declined state ───────────────────────────────────────────────────────────

  it('offers to request again after a decline', async () => {
    listOlympiads.mockResolvedValue([{ ...foreignOlympiad, schoolAccess: 'declined' }]);
    render(<EducatorDashboard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Science Olympiad/ })).toBeTruthy();
    });

    expect(screen.getByText('Declined')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Science Olympiad/ }));

    expect(screen.getByText(/Your previous request was declined/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request access again' })).toBeTruthy();
  });

  // ── requesting access ───────────────────────────────────────────────────────

  it('requests access and flips the card to its waiting state', async () => {
    requestOlympiadAccess.mockResolvedValue({ status: 'pending' });
    render(<EducatorDashboard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Science Olympiad/ })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Science Olympiad/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Request access' }));

    await waitFor(() => {
      expect(requestOlympiadAccess).toHaveBeenCalledWith('olympiad-2', 'mock-token');
    });
    expect(
      screen.getByText(/Access requested — waiting for the organiser to approve/)
    ).toBeTruthy();
  });

  it('rolls back and shows an error when the request fails', async () => {
    requestOlympiadAccess.mockRejectedValue(new Error('Request failed with status 500'));
    render(<EducatorDashboard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Science Olympiad/ })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Science Olympiad/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Request access' }));

    await waitFor(() => {
      expect(screen.getByText(/Request failed with status 500/)).toBeTruthy();
    });
    // The card rolls back to the request button
    expect(screen.getByRole('button', { name: 'Request access' })).toBeTruthy();
  });

  // ── stats ────────────────────────────────────────────────────────────────────

  it('excludes rounds of non-member olympiads from the stats', async () => {
    render(<EducatorDashboard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Maths Olympiad/ })).toBeTruthy();
    });

    // Only the approved olympiad's open round counts
    expect(screen.getByText('1')).toBeTruthy();
    // Scheduled and released stay at zero
    expect(screen.getAllByText('0')).toHaveLength(2);
  });
});
