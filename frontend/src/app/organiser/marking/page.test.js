import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock @/hooks/useRequireRole so we control the logged-in user directly,
// without going through Clerk or a real role check.
const mockUseRequireRole = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/organiser/test',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/hooks/useRequireRole', () => ({
  useRequireRole: () => mockUseRequireRole(),
}));

// Mock @clerk/nextjs's useAuth for getToken()
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('mock-token') }),
}));

// Mock the API layer
vi.mock('@/lib/api', () => ({
  listMarkingQueue: vi.fn(),
  assignMarkingTask: vi.fn(),
  submitMarking: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

import { listMarkingQueue, assignMarkingTask, submitMarking } from '@/lib/api';
import MarkingPage from './page';
import { expectNoAxeViolations } from '@/test/axe';

const organiserUser = { id: 'organiser-1', email: 'marker@school.com', role: 'organiser' };

const sampleTask = {
  id: 'task-1',
  status: 'unassigned',
  submission: {
    answers: { q1: 'A short written answer' },
    entrant: { name: 'Jane Entrant' },
    round: { name: 'Round 1' },
  },
};

describe('/organiser/marking page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRequireRole.mockReturnValue({ user: organiserUser, checking: false });
  });

  it('shows a loading state while checking role', () => {
    mockUseRequireRole.mockReturnValue({ user: null, checking: true });
    render(<MarkingPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an empty state when the queue has no tasks', async () => {
    listMarkingQueue.mockResolvedValue([]);
    render(<MarkingPage />);

    expect(await screen.findByText(/no submissions waiting/i)).toBeInTheDocument();
  });

  it('has no axe accessibility violations', async () => {
    listMarkingQueue.mockResolvedValue([sampleTask]);
    const { container } = render(<MarkingPage />);
    await screen.findByText('Jane Entrant');
    await expectNoAxeViolations(container);
  });

  it('lists queued tasks with entrant and round info', async () => {
    listMarkingQueue.mockResolvedValue([sampleTask]);
    render(<MarkingPage />);

    expect(await screen.findByText('Jane Entrant')).toBeInTheDocument();
    expect(screen.getByText(/Round 1/)).toBeInTheDocument();
  });

  it('claims an unassigned task and opens the marking form when "Mark" is clicked', async () => {
    const user = userEvent.setup();
    listMarkingQueue.mockResolvedValue([sampleTask]);
    assignMarkingTask.mockResolvedValue({
      ...sampleTask,
      status: 'assigned',
      assignedToId: 'organiser-1',
    });

    render(<MarkingPage />);
    const markButton = await screen.findByRole('button', { name: /mark/i });
    await user.click(markButton);

    expect(assignMarkingTask).toHaveBeenCalledWith('task-1', 'mock-token');
    expect(await screen.findByText(/Marking: Jane Entrant/i)).toBeInTheDocument();
    expect(screen.getByText('Question q1')).toBeInTheDocument();
  });

  it('does not re-assign a task that is already assigned', async () => {
    const assignedTask = { ...sampleTask, status: 'assigned' };
    listMarkingQueue.mockResolvedValue([assignedTask]);

    const user = userEvent.setup();
    render(<MarkingPage />);
    const markButton = await screen.findByRole('button', { name: /mark/i });
    await user.click(markButton);

    expect(assignMarkingTask).not.toHaveBeenCalled();
    expect(await screen.findByText(/Marking: Jane Entrant/i)).toBeInTheDocument();
  });

  it('submits partial credit marks and totals them correctly', async () => {
    const user = userEvent.setup();
    const twoQuestionTask = {
      ...sampleTask,
      status: 'assigned',
      submission: {
        ...sampleTask.submission,
        answers: { q1: 'first answer', q2: 'second answer' },
      },
    };
    listMarkingQueue.mockResolvedValueOnce([twoQuestionTask]).mockResolvedValueOnce([]);
    submitMarking.mockResolvedValue({ id: 'task-1', status: 'marked', score: 8 });

    render(<MarkingPage />);
    await user.click(await screen.findByRole('button', { name: /mark/i }));

    const q1Input = screen.getByLabelText('Question q1');
    const q2Input = screen.getByLabelText('Question q2');
    await user.type(q1Input, '3');
    await user.type(q2Input, '5');

    expect(screen.getByText('Total: 8')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /submit marking/i }));

    expect(submitMarking).toHaveBeenCalledWith(
      'task-1',
      { score: 8, breakdown: { q1: 3, q2: 5 } },
      'mock-token'
    );

    // Form closes and queue reloads (now empty, per the second mock resolution)
    expect(await screen.findByText(/no submissions waiting/i)).toBeInTheDocument();
  });

  it('shows an error message if submitting the mark fails', async () => {
    const user = userEvent.setup();
    listMarkingQueue.mockResolvedValue([{ ...sampleTask, status: 'assigned' }]);
    submitMarking.mockRejectedValue(new Error('Server exploded'));

    render(<MarkingPage />);
    await user.click(await screen.findByRole('button', { name: /mark/i }));
    await user.click(screen.getByRole('button', { name: /submit marking/i }));

    expect(await screen.findByText(/could not save this marking/i)).toBeInTheDocument();
  });

  it('lets the marker cancel out of the marking form back to the queue', async () => {
    const user = userEvent.setup();
    listMarkingQueue.mockResolvedValue([{ ...sampleTask, status: 'assigned' }]);

    render(<MarkingPage />);
    await user.click(await screen.findByRole('button', { name: /mark/i }));
    expect(await screen.findByText(/Marking: Jane Entrant/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText(/Marking: Jane Entrant/i)).not.toBeInTheDocument();
    expect(screen.getByText('Jane Entrant')).toBeInTheDocument();
  });
});
