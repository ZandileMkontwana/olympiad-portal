import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'round-1' }),
}));

// The page attaches the Clerk token to both standings fetches. getToken
// must keep a stable identity across renders, like the real Clerk hook —
// otherwise the effects re-run and cancel their in-flight fetches.
vi.mock('@clerk/nextjs', () => {
  const getToken = async () => 'test-token';
  return { useAuth: () => ({ getToken }) };
});

vi.mock('@/lib/api', () => ({
  fetchStandings: vi.fn(),
  getSchoolStandings: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

import { fetchStandings, getSchoolStandings } from '@/lib/api';
import StandingsPage from './page';

describe('StandingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('By Entrant tab (default)', () => {
    it('shows a loading state initially', () => {
      fetchStandings.mockReturnValue(new Promise(() => {}));

      render(<StandingsPage />);

      expect(screen.getByText(/loading standings/i)).toBeInTheDocument();
    });

    it('shows an empty state when there are no scored standings yet', async () => {
      fetchStandings.mockResolvedValue([]);

      render(<StandingsPage />);

      expect(await screen.findByText(/no scored submissions yet/i)).toBeInTheDocument();
    });

    it('renders the ranked table when standings are returned', async () => {
      fetchStandings.mockResolvedValue([
        {
          rank: 1,
          entrantId: 'entrant-1',
          entrantName: 'Thabo',
          schoolName: 'Wits High School',
          score: 20,
          submittedAt: '2026-09-12T20:56:55.855Z',
        },
      ]);

      render(<StandingsPage />);

      expect(await screen.findByText('Thabo')).toBeInTheDocument();
      expect(screen.getByText('Wits High School')).toBeInTheDocument();
      expect(screen.getByText('20.00')).toBeInTheDocument();
    });

    it('shows an error message when the fetch fails', async () => {
      const { ApiError } = await import('@/lib/api');
      fetchStandings.mockRejectedValue(new ApiError('Round not found', 404));

      render(<StandingsPage />);

      expect(await screen.findByRole('alert')).toHaveTextContent('Round not found');
    });

    it('does not fetch school standings until the Per School tab is opened', async () => {
      fetchStandings.mockResolvedValue([]);

      render(<StandingsPage />);
      await screen.findByText(/no scored submissions yet/i);

      expect(getSchoolStandings).not.toHaveBeenCalled();
    });
  });

  describe('Per School tab', () => {
    it('fetches and renders school standings when the tab is clicked', async () => {
      fetchStandings.mockResolvedValue([]);
      getSchoolStandings.mockResolvedValue([
        {
          rank: 1,
          schoolId: 'school-1',
          schoolName: 'Wits High School',
          totalScore: 50,
          entrantCount: 2,
        },
      ]);

      render(<StandingsPage />);
      await screen.findByText(/no scored submissions yet/i); // wait for entrant tab to settle

      fireEvent.click(screen.getByRole('tab', { name: /per school/i }));

      expect(await screen.findByText('Wits High School')).toBeInTheDocument();
      expect(screen.getByText('50.00')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(getSchoolStandings).toHaveBeenCalledWith('round-1', 'test-token');
    });

    it('only fetches school standings once, even if the tab is clicked multiple times', async () => {
      fetchStandings.mockResolvedValue([]);
      getSchoolStandings.mockResolvedValue([]);

      render(<StandingsPage />);
      await screen.findByText(/no scored submissions yet/i);

      const schoolTab = screen.getByRole('tab', { name: /per school/i });
      fireEvent.click(schoolTab);
      await screen.findByText(/school standings will appear/i);

      fireEvent.click(screen.getByRole('tab', { name: /by entrant/i }));
      fireEvent.click(schoolTab);

      expect(getSchoolStandings).toHaveBeenCalledTimes(1);
    });

    it('shows an error message when the school standings fetch fails', async () => {
      const { ApiError } = await import('@/lib/api');
      fetchStandings.mockResolvedValue([]);
      getSchoolStandings.mockRejectedValue(new ApiError('Failed to fetch school standings', 500));

      render(<StandingsPage />);
      await screen.findByText(/no scored submissions yet/i);

      fireEvent.click(screen.getByRole('tab', { name: /per school/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Failed to fetch school standings'
      );
    });
  });
});
