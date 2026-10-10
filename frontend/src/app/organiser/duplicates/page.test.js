import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/organiser/duplicates',
}));

// Mock @clerk/nextjs
const mockGetToken = vi.fn().mockResolvedValue('mock-clerk-token');
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

// Mock useRequireRole
const mockUser = {
  id: 'organiser-1',
  email: 'organiser@school.com',
  role: 'organiser',
  name: 'Test Organiser',
};
vi.mock('@/hooks/useRequireRole', () => ({
  useRequireRole: () => ({
    user: mockUser,
    checking: false,
  }),
}));

// Mock @/lib/api
vi.mock('@/lib/api', () => ({
  fetchAllDuplicates: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

// Mock OrganiserShell
vi.mock('@/components/OrganiserShell', () => ({
  default: ({ children }) => <div data-testid="organiser-shell">{children}</div>,
}));

import DuplicatesReviewPage from './page';
import { fetchAllDuplicates } from '@/lib/api';

describe('DuplicatesReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', async () => {
    fetchAllDuplicates.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<DuplicatesReviewPage />);

    expect(screen.getByText(/loading duplicates/i)).toBeTruthy();
  });

  it('shows empty state when no duplicates are found', async () => {
    fetchAllDuplicates.mockResolvedValue({ duplicates: [] });
    render(<DuplicatesReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/no duplicate accounts detected/i)).toBeTruthy();
    });
  });

  it('shows error state when fetch fails', async () => {
    const { ApiError } = await import('@/lib/api');
    fetchAllDuplicates.mockRejectedValue(new ApiError('Failed to fetch duplicates', 500));
    render(<DuplicatesReviewPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to fetch duplicates/i);
    });
  });

  it('renders duplicate groups when duplicates are found', async () => {
    const mockDuplicates = [
      [
        {
          id: 'entrant-1',
          name: 'Alice Smith',
          email: 'alice@school1.com',
          grade: '10',
          schoolName: 'School One',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'entrant-2',
          name: 'Alice Smith',
          email: 'alice@school2.com',
          grade: '10',
          schoolName: 'School Two',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    ];
    fetchAllDuplicates.mockResolvedValue({ duplicates: mockDuplicates });
    render(<DuplicatesReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/found 1 group of potential duplicates/i)).toBeTruthy();
    });

    // Check that both entrants are shown
    expect(screen.getByText(/alice smith — grade 10/i)).toBeTruthy();
    expect(screen.getByText(/alice@school1\.com/i)).toBeTruthy();
    expect(screen.getByText(/alice@school2\.com/i)).toBeTruthy();
    expect(screen.getByText(/school one/i)).toBeTruthy();
    expect(screen.getByText(/school two/i)).toBeTruthy();
  });

  it('shows the correct count for multiple groups', async () => {
    const mockDuplicates = [
      [
        {
          id: 'entrant-1',
          name: 'Alice Smith',
          email: 'alice@school1.com',
          grade: '10',
          schoolName: 'School One',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'entrant-2',
          name: 'Alice Smith',
          email: 'alice@school2.com',
          grade: '10',
          schoolName: 'School Two',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      [
        {
          id: 'entrant-3',
          name: 'Bob Jones',
          email: 'bob@school1.com',
          grade: '11',
          schoolName: 'School One',
          createdAt: '2026-01-03T00:00:00.000Z',
        },
        {
          id: 'entrant-4',
          name: 'Bob Jones',
          email: 'bob@school3.com',
          grade: '11',
          schoolName: 'School Three',
          createdAt: '2026-01-04T00:00:00.000Z',
        },
      ],
    ];
    fetchAllDuplicates.mockResolvedValue({ duplicates: mockDuplicates });
    render(<DuplicatesReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/found 2 groups of potential duplicates/i)).toBeTruthy();
    });
  });

  it('shows account count badge for each group', async () => {
    const mockDuplicates = [
      [
        {
          id: 'entrant-1',
          name: 'Alice Smith',
          email: 'alice@school1.com',
          grade: '10',
          schoolName: 'School One',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'entrant-2',
          name: 'Alice Smith',
          email: 'alice@school2.com',
          grade: '10',
          schoolName: 'School Two',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 'entrant-3',
          name: 'Alice Smith',
          email: 'alice@school3.com',
          grade: '10',
          schoolName: 'School Three',
          createdAt: '2026-01-03T00:00:00.000Z',
        },
      ],
    ];
    fetchAllDuplicates.mockResolvedValue({ duplicates: mockDuplicates });
    render(<DuplicatesReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/3 accounts/i)).toBeTruthy();
    });
  });

  it('shows entrant ID prefix for each account', async () => {
    const mockDuplicates = [
      [
        {
          id: 'entrant-12345678',
          name: 'Alice Smith',
          email: 'alice@school1.com',
          grade: '10',
          schoolName: 'School One',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    ];
    fetchAllDuplicates.mockResolvedValue({ duplicates: mockDuplicates });
    render(<DuplicatesReviewPage />);

    await waitFor(() => {
      // The code shows the first 8 characters of the ID
      expect(screen.getByText(/entrant-/i)).toBeTruthy();
    });
  });

  it('handles entrants without email', async () => {
    const mockDuplicates = [
      [
        {
          id: 'entrant-1',
          name: 'Alice Smith',
          email: null,
          grade: '10',
          schoolName: 'School One',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    ];
    fetchAllDuplicates.mockResolvedValue({ duplicates: mockDuplicates });
    render(<DuplicatesReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/no email/i)).toBeTruthy();
    });
  });
});
