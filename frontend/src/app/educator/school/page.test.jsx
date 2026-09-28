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
    {
      id: 'e1',
      name: 'Alice Alpha',
      grade: '10',
      submissionCount: 2,
      averageScore: 85,
      email: 'alice@school.com',
      accountStatus: 'active',
      olympiads: [
        { id: 'oly-1', name: 'Maths Olympiad' },
        { id: 'oly-2', name: 'Science Olympiad' },
      ],
    },
    {
      id: 'e2',
      name: 'Bob Beta',
      grade: '11',
      submissionCount: 2,
      averageScore: 60,
      email: 'bob@school.com',
      accountStatus: 'invite_pending',
      olympiads: [],
    },
    {
      id: 'e3',
      name: 'Carol Gamma',
      grade: '10',
      submissionCount: 1,
      averageScore: null,
      email: null,
      accountStatus: null,
      olympiads: [{ id: 'oly-1', name: 'Maths Olympiad' }],
    },
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
  fetchSchoolDashboard: vi.fn(),
  createEntrant: vi.fn(),
  resendEntrantInvite: vi.fn(),
  deleteEntrant: vi.fn(),
  listOlympiads: vi.fn(),
}));

import SchoolDashboardPage from './page';
import { useRequireRole } from '@/hooks/useRequireRole';
import { fetchSchoolDashboard, createEntrant, resendEntrantInvite, deleteEntrant, listOlympiads } from '@/lib/api';

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
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    vi.clearAllMocks();
    fetchSchoolDashboard.mockResolvedValue(mockDashboard);
    listOlympiads.mockResolvedValue([]);
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
      expect(screen.getByText('Testville High')).toBeTruthy();
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
        {
          id: 'e1',
          name: 'Alice Alpha',
          grade: '10',
          submissionCount: 0,
          averageScore: null,
          email: 'alice@school.com',
          accountStatus: 'active',
        },
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
      expect(screen.getByText('Students by Olympiad (3)')).toBeTruthy();
    });
  });

  // ── navigation: the shared sidebar lives in app/educator/layout.js and is
  // covered by components/EducatorSidebar.test.jsx ────────────────────────

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
    expect(screen.getByPlaceholderText('Student email')).toBeTruthy();
    expect(screen.getByDisplayValue('Grade')).toBeTruthy();
  });

  it('only offers real grades 1 to 12 in the grade dropdown', async () => {
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

    const gradeSelect = screen.getByDisplayValue('Grade');
    const options = Array.from(gradeSelect.options).map((o) => o.value);
    expect(options).toEqual(['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  });

  it('calls createEntrant when adding a student (after confirm)', async () => {
    createEntrant.mockResolvedValue({
      id: 'e4',
      name: 'New Kid',
      grade: '10',
      schoolId: 'school-1',
      invitationSent: true,
      registeredRounds: [
        { id: 'round-1', name: 'Round One', olympiadName: 'Maths Olympiad' },
      ],
    });
    listOlympiads.mockResolvedValue([
      { id: 'oly-1', name: 'Maths Olympiad', schoolAccess: 'approved', rounds: [] },
    ]);
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
    fireEvent.change(screen.getByPlaceholderText('Student email'), {
      target: { value: 'newkid@school.com' },
    });
    fireEvent.change(screen.getByDisplayValue('Grade'), { target: { value: '10' } });
    fireEvent.change(screen.getByDisplayValue('Select Olympiad'), { target: { value: 'oly-1' } });
    fireEvent.click(screen.getByText('Add Student'));

    expect(global.confirm).toHaveBeenCalledWith(
      'Add "New Kid" (newkid@school.com, Grade 10) under the selected Olympiad? They\'ll be emailed a link to set their password.'
    );
    await waitFor(() => {
      expect(createEntrant).toHaveBeenCalledWith(
        { name: 'New Kid', email: 'newkid@school.com', grade: '10', olympiadId: 'oly-1' },
        'mock-token'
      );
    });
    await waitFor(() => {
      expect(screen.getByText(/has been added and emailed a link/i)).toBeTruthy();
    });
    // The confirmation says which rounds the student was registered into
    await waitFor(() => {
      expect(screen.getByText(/Registered into: Maths Olympiad — Round One/)).toBeTruthy();
    });
  });

  it('notes when a new student has no open rounds to register into', async () => {
    createEntrant.mockResolvedValue({
      id: 'e4',
      name: 'New Kid',
      grade: '10',
      schoolId: 'school-1',
      invitationSent: true,
      registeredRounds: [],
    });
    listOlympiads.mockResolvedValue([
      { id: 'oly-1', name: 'Maths Olympiad', schoolAccess: 'approved', rounds: [] },
    ]);
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
    fireEvent.change(screen.getByPlaceholderText('Student email'), {
      target: { value: 'newkid@school.com' },
    });
    fireEvent.change(screen.getByDisplayValue('Grade'), { target: { value: '10' } });
    fireEvent.change(screen.getByDisplayValue('Select Olympiad'), { target: { value: 'oly-1' } });
    fireEvent.click(screen.getByText('Add Student'));

    await waitFor(() => {
      expect(screen.getByText(/No open rounds to register them into yet/)).toBeTruthy();
    });
  });

  it('blocks adding a student when the email is missing', async () => {
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
    fireEvent.change(screen.getByDisplayValue('Grade'), { target: { value: '10' } });
    fireEvent.click(screen.getByText('Add Student'));

    expect(screen.getByText('Name, email and grade are required.')).toBeTruthy();
    expect(createEntrant).not.toHaveBeenCalled();
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

  // ── account status + resend invite ────────────────────────────────────

  it("shows each entrant's email on their card", async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('alice@school.com')).toBeTruthy();
      expect(screen.getByText('bob@school.com')).toBeTruthy();
    });
    // Legacy entrant with no account yet
    expect(screen.getByText('No account yet')).toBeTruthy();
  });

  it('shows account status chips on entrant cards', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeTruthy();
      expect(screen.getByText('Invite pending')).toBeTruthy();
      expect(screen.getByText('No account')).toBeTruthy();
    });
  });

  it('shows which olympiads each student is grouped under', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Alpha')).toBeTruthy();
    });

    // Group headers show the olympiad names
    expect(screen.getByText(/Maths Olympiad/)).toBeTruthy();
    expect(screen.getByText(/No Olympiad/)).toBeTruthy();
    // Bob has no olympiad, so he is under the "No Olympiad" group
    expect(screen.getByText('Bob Beta')).toBeTruthy();
  });

  it('shows resend invite only for pending or account-less entrants', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Bob Beta')).toBeTruthy();
    });

    // Bob is invite-pending and Carol has no account — both offer invite
    // buttons; Alice (active) has none.
    expect(screen.getByRole('button', { name: 'Resend invite' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send invite' })).toBeTruthy();
    const inviteButtons = screen
      .getAllByRole('button')
      .filter((btn) => /invite/i.test(btn.textContent));
    expect(inviteButtons).toHaveLength(2);
  });

  it('resends an invitation for an invite-pending student (after confirm)', async () => {
    resendEntrantInvite.mockResolvedValue({ message: 'Invitation sent', invitationSent: true });
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Bob Beta')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Resend invite'));

    expect(global.confirm).toHaveBeenCalledWith(
      'Email Bob Beta a link to set their password (bob@school.com)?'
    );
    await waitFor(() => {
      expect(resendEntrantInvite).toHaveBeenCalledWith('e2', 'mock-token', {});
    });
    await waitFor(() => {
      expect(screen.getByText('Invitation emailed to bob@school.com.')).toBeTruthy();
    });
  });

  it('prompts for an email when inviting a legacy entrant without an account', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'carol@school.com')
    );
    resendEntrantInvite.mockResolvedValue({ message: 'Invitation sent', invitationSent: true });
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Carol Gamma')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Send invite'));

    expect(global.prompt).toHaveBeenCalledWith(
      'Carol Gamma has no account yet. Enter their student email to send the invitation:'
    );
    expect(global.confirm).toHaveBeenCalledWith(
      'Email Carol Gamma a link to set their password (carol@school.com)?'
    );
    await waitFor(() => {
      expect(resendEntrantInvite).toHaveBeenCalledWith('e3', 'mock-token', {
        email: 'carol@school.com',
      });
    });
  });

  it('shows an error message when the resend fails', async () => {
    resendEntrantInvite.mockRejectedValue(new Error('Could not resend the invitation'));
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Bob Beta')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Resend invite'));

    await waitFor(() => {
      expect(screen.getByText(/could not resend the invitation/i)).toBeTruthy();
    });
  });

  // ── remove entrant ────────────────────────────────────────────────────────

  it('shows a Remove button on every entrant card', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Alpha')).toBeTruthy();
    });

    expect(screen.getAllByText('Remove')).toHaveLength(3);
  });

  it('removes an entrant after confirmation and refreshes the list', async () => {
    deleteEntrant.mockResolvedValue({ message: 'Entrant removed' });
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Alpha')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByText('Remove')[0]);

    // Alice has 2 submissions, so the warning mentions them
    expect(global.confirm).toHaveBeenCalledWith(
      "Remove Alice Alpha from your school? Their account and records will be deleted — this can't be undone. This permanently deletes their 2 submissions and results."
    );
    await waitFor(() => {
      expect(deleteEntrant).toHaveBeenCalledWith('e1', 'mock-token');
    });
    await waitFor(() => {
      expect(screen.getByText('Alice Alpha has been removed from your school.')).toBeTruthy();
    });
    // The dashboard re-fetches after a removal
    expect(fetchSchoolDashboard).toHaveBeenCalledWith('school-1', 'mock-token');
  });

  it('keeps the entrant when the removal confirmation is cancelled', async () => {
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Alpha')).toBeTruthy();
    });

    confirm.mockReturnValue(false);
    fireEvent.click(screen.getAllByText('Remove')[0]);

    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/Remove Alice Alpha/));
    expect(deleteEntrant).not.toHaveBeenCalled();
    expect(screen.getByText('Alice Alpha')).toBeTruthy();
  });

  it('shows an error message when the removal fails', async () => {
    deleteEntrant.mockRejectedValue(new Error('Could not remove the entrant'));
    render(<SchoolDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Alpha')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByText('Remove')[0]);

    await waitFor(() => {
      expect(screen.getByText(/could not remove the entrant/i)).toBeTruthy();
    });
  });
});
