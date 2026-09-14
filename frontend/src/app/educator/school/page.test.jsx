import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── mocks ────────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  email: 'teacher@school.com',
  role: 'educator',
  name: 'Ms Teacher',
  school: { id: 'school-1', name: 'Testville High' },
};

const mockDashboard = {
  school: { id: 'school-1', name: 'Testville High' },
  entrantCount: 3,
  totalSubmissions: 5,
  entrants: [
    { id: 'e1', name: 'Alice Alpha', grade: '10', submissionCount: 2, averageScore: 85 },
    { id: 'e2', name: 'Bob Beta', grade: '11', submissionCount: 2, averageScore: 60 },
    { id: 'e3', name: 'Carol Gamma', grade: '10', submissionCount: 1, averageScore: null },
  ],
};

const mockReplace = vi.fn();
const mockSignOut = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
  useClerk: () => ({ signOut: mockSignOut }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}));

vi.mock('@/hooks/useRequireRole', () => ({
  useRequireRole: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  fetchSchoolDashboard: vi.fn(),
  createEntrant: vi.fn(),
}));

import SchoolDashboardPage from './page';
import { useRequireRole } from '@/hooks/useRequireRole';
import { fetchSchoolDashboard, createEntrant } from '@/lib/api';

// ── helpers ──────────────────────────────────────────────────────────────────

function setupUser(user = mockUser) {
  useRequireRole.mockReturnValue({ user, checking: false });
}

function setupChecking() {
  useRequireRole.mockReturnValue({ user: null, checking: true });
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('School Dashboard Page', () => {
  beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.clearAllMocks();
    fetchSchoolDashboard.mockResolvedValue(mockDashboard);
    setupUser();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ── loading ──────────────────────────────────────────────────────────────

  it('shows a loading spinner while checking auth', () => {
    setupChecking();
    const { container } = render(<SchoolDashboardPage />);
    // Loading state renders a spinning div
    expect(container.querySelector('[style*="spin"]')).toBeTruthy();
  });

  it('shows a loading spinner while fetching dashboard data', () => {
    fetchSchoolDashboard.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<SchoolDashboardPage />);
    expect(container.querySelector('[style*="spin"]')).toBeTruthy();
  });

  // ── no-school state ──────────────────────────────────────────────────────

  it('shows a no-school message when user has no school linked', () => {
    setupUser({ ...mockUser, school: null });
    render(<SchoolDashboardPage />);
    expect(screen.getByText(/No School Linked/)).toBeTruthy();
  });

  // ── error state ──────────────────────────────────────────────────────────

  it('shows an error message when the API call fails', async () => {
    fetchSchoolDashboard.mockRejectedValue(new Error('Network'));
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/)).toBeTruthy();
    });
  });

  // ── ready state ──────────────────────────────────────────────────────────

  it('renders the school name in the hero', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      // 'Testville High' appears in both sidebar and hero h1
      expect(screen.getAllByText('Testville High').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows welcome message with user name', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/Welcome back/)).toBeTruthy();
    });
  });

  it('renders stat cards with correct values', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      // '3' appears in both the stat card and 'All Entrants (3)'
      expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('5')).toBeTruthy();
    });
  });

  it('shows the top performer when there are scored entrants', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      // 'Alice' appears in both the Top Performer card and the entrant card
      expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('does not show top performer when no entrants have scores', async () => {
    const noScores = {
      ...mockDashboard,
      entrants: [
        { id: 'e1', name: 'Alice Alpha', grade: '10', submissionCount: 0, averageScore: null },
      ],
    };
    fetchSchoolDashboard.mockResolvedValue(noScores);
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Alpha')).toBeTruthy();
    });
    expect(screen.queryByText('Top Performer')).toBeNull();
  });

  // ── empty entrants ───────────────────────────────────────────────────────

  it('shows empty state when no entrants are registered', async () => {
    fetchSchoolDashboard.mockResolvedValue({
      school: { id: 'school-1', name: 'Testville High' },
      entrantCount: 0,
      totalSubmissions: 0,
      entrants: [],
    });
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/No Students Yet/)).toBeTruthy();
    });
  });

  // ── entrant cards ────────────────────────────────────────────────────────

  it('renders entrant cards with names and grades', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Alpha')).toBeTruthy();
      expect(screen.getByText('Bob Beta')).toBeTruthy();
      expect(screen.getByText('Carol Gamma')).toBeTruthy();
    });
  });

  it('shows score labels for entrants with scores', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      // 'Excellent' may appear in both the entrant badge and the Distribution panel
      expect(screen.getAllByText('Excellent').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Good').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── search filter ────────────────────────────────────────────────────────

  it('filters entrants by search term', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Alpha')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText(/Search by name/);
    fireEvent.change(searchInput, { target: { value: 'bob' } });

    expect(screen.getByText('Bob Beta')).toBeTruthy();
    expect(screen.queryByText('Alice Alpha')).toBeNull();
  });

  // ── grade filter ─────────────────────────────────────────────────────────

  it('filters entrants by grade', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Alpha')).toBeTruthy();
    });

    const gradeSelect = screen.getByDisplayValue('All grades');
    fireEvent.change(gradeSelect, { target: { value: '11' } });

    expect(screen.getByText('Bob Beta')).toBeTruthy();
    expect(screen.queryByText('Alice Alpha')).toBeNull();
  });

  // ── "All Entrants" heading ───────────────────────────────────────────────

  it('shows the entrant count in the All Entrants heading', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('All Entrants (3)')).toBeTruthy();
    });
  });

  // ── navigation links ────────────────────────────────────────────────────

  it('has a sidebar link to rounds', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      const link = screen.getByText('Rounds');
      expect(link.closest('a').getAttribute('href')).toBe('/educator');
    });
  });

  it('has a sidebar link to paper archive', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      const link = screen.getByText('Paper Archive');
      expect(link.closest('a').getAttribute('href')).toBe('/archive');
    });
  });

  // ── logout ───────────────────────────────────────────────────────────────

  it('calls signOut when log out is clicked (after confirm)', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/Welcome back/)).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Log out'));
    expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to log out?');
    expect(mockSignOut).toHaveBeenCalledWith({ redirectUrl: '/login' });
  });

  // ── fetchSchoolDashboard called with correct args ────────────────────────

  it('calls fetchSchoolDashboard with school id and token', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(fetchSchoolDashboard).toHaveBeenCalledWith('school-1', 'mock-token');
    });
  });

  // ── refresh ─────────────────────────────────────────────────────────────

  it('has a refresh button that reloads data', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/Welcome back/)).toBeTruthy();
    });
    fetchSchoolDashboard.mockClear();
    fireEvent.click(screen.getByTitle('Refresh data'));
    await waitFor(() => {
      expect(fetchSchoolDashboard).toHaveBeenCalledWith('school-1', 'mock-token');
    });
  });

  // ── sort controls ──────────────────────────────────────────────────────

  it('has sort options (score, name, submissions)', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Sort: Score')).toBeTruthy();
    });
    const sortSelect = screen.getByDisplayValue('Sort: Score');
    fireEvent.change(sortSelect, { target: { value: 'name' } });
    expect(screen.getByDisplayValue('Sort: Name')).toBeTruthy();
  });

  // ── clear filters ──────────────────────────────────────────────────────

  it('clears filters when clear button is clicked (after confirm)', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Alpha')).toBeTruthy();
    });

    // Set a filter first
    const searchInput = screen.getByPlaceholderText(/Search by name/);
    fireEvent.change(searchInput, { target: { value: 'bob' } });
    expect(screen.queryByText('Alice Alpha')).toBeNull();

    // Clear filters
    fireEvent.click(screen.getByText('Clear'));
    expect(global.confirm).toHaveBeenCalledWith('Clear all filters?');
    await waitFor(() => {
      expect(screen.getByText('Alice Alpha')).toBeTruthy();
    });
  });

  // ── no results ───────────────────────────────────────────────────────

  it('shows no-results state when filters match nothing', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Alpha')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText(/Search by name/);
    fireEvent.change(searchInput, { target: { value: 'zzzzz' } });
    await waitFor(() => {
      expect(screen.getByText(/No students match your filters/)).toBeTruthy();
    });
  });

  // ── add student ─────────────────────────────────────────────────────

  it('shows add student form in empty state', async () => {
    fetchSchoolDashboard.mockResolvedValue({
      school: { id: 'school-1', name: 'Testville High' },
      entrantCount: 0,
      totalSubmissions: 0,
      entrants: [],
    });
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/No Students Yet/)).toBeTruthy();
    });
    expect(screen.getByPlaceholderText('Student name')).toBeTruthy();
    expect(screen.getByPlaceholderText(/Grade/)).toBeTruthy();
  });

  it('calls createEntrant when adding a student (after confirm)', async () => {
    createEntrant.mockResolvedValue({ id: 'e4', name: 'New Kid', grade: '10', schoolId: 'school-1' });
    fetchSchoolDashboard.mockResolvedValue({
      school: { id: 'school-1', name: 'Testville High' },
      entrantCount: 0,
      totalSubmissions: 0,
      entrants: [],
    });
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Student name')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('Student name'), { target: { value: 'New Kid' } });
    fireEvent.change(screen.getByPlaceholderText(/Grade/), { target: { value: '10' } });
    fireEvent.click(screen.getByText('Add Student'));

    expect(global.confirm).toHaveBeenCalledWith('Add "New Kid" (Grade 10) to your school?');
    await waitFor(() => {
      expect(createEntrant).toHaveBeenCalledWith({ name: 'New Kid', grade: '10' }, 'mock-token');
    });
  });

  it('toggles add student form when button is clicked', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/Welcome back/)).toBeTruthy();
    });

    // Click the + Add Student button
    fireEvent.click(screen.getByText('+ Add Student'));
    expect(screen.getByText('Add a New Student')).toBeTruthy();

    // Click Cancel to hide
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Add a New Student')).toBeNull();
  });
});
