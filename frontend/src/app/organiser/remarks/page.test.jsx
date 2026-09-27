import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUseRequireRole = vi.fn();
const mockGetToken = vi.fn();

vi.mock('@/hooks/useRequireRole', () => ({
  useRequireRole: () => mockUseRequireRole(),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock('@/lib/api', () => ({
  listRemarkQueue: vi.fn(),
  reviewRemarkRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

import RemarksPage from './page';
import { ApiError, listRemarkQueue, reviewRemarkRequest } from '@/lib/api';

const reviewer = {
  id: 'organiser-2',
  email: 'reviewer@school.com',
  role: 'organiser',
};

const assignedAppeal = {
  id: 'remark-1',
  status: 'assigned',
  reason: 'Question 2 deserves method marks.',
  requestedBy: { id: 'educator-1', name: 'Ms Teacher' },
  assignedTo: reviewer,
  submission: {
    entrant: { name: 'Ada Lovelace' },
    round: { name: 'Mathematics Round 1' },
    result: { score: 7.5 },
    answers: { 1: 'First answer', 2: 'Second answer' },
    markingTask: { breakdown: { 1: 4, 2: 3.5 } },
  },
};

describe('/organiser/remarks reviewer queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRequireRole.mockReturnValue({ user: reviewer, checking: false });
    mockGetToken.mockResolvedValue('reviewer-token');
  });

  it('shows a loading state while the organiser role is checked', () => {
    mockUseRequireRole.mockReturnValue({ user: null, checking: true });

    render(<RemarksPage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(listRemarkQueue).not.toHaveBeenCalled();
  });

  it('loads only appeals assigned to the signed-in reviewer', async () => {
    listRemarkQueue.mockResolvedValue([assignedAppeal]);

    render(<RemarksPage />);

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText(/Mathematics Round 1.*current score: 7.5/)).toBeInTheDocument();
    expect(listRemarkQueue).toHaveBeenCalledWith('reviewer-token', { assignedTo: 'me' });
  });

  it('approves an assigned appeal with the updated score and trimmed notes', async () => {
    const user = userEvent.setup();
    listRemarkQueue.mockResolvedValueOnce([assignedAppeal]).mockResolvedValueOnce([]);
    reviewRemarkRequest.mockResolvedValue({ id: 'remark-1', status: 'approved' });

    render(<RemarksPage />);

    await user.click(await screen.findByRole('button', { name: 'Review' }));
    await user.clear(screen.getByLabelText('New score'));
    await user.type(screen.getByLabelText('New score'), '9');
    await user.type(screen.getByLabelText('Notes (optional)'), '  Method marks awarded.  ');
    await user.click(screen.getByRole('button', { name: 'Submit Review' }));

    await waitFor(() => {
      expect(reviewRemarkRequest).toHaveBeenCalledWith(
        'remark-1',
        {
          status: 'approved',
          newScore: 9,
          reviewNotes: 'Method marks awarded.',
        },
        'reviewer-token'
      );
    });
    expect(await screen.findByText('No appeals are assigned to you.')).toBeInTheDocument();
  });

  it('records a rejection without changing the score', async () => {
    const user = userEvent.setup();
    listRemarkQueue.mockResolvedValue([assignedAppeal]);
    reviewRemarkRequest.mockResolvedValue({ id: 'remark-1', status: 'rejected' });

    render(<RemarksPage />);

    await user.click(await screen.findByRole('button', { name: 'Review' }));
    await user.click(screen.getByRole('radio', { name: 'Reject' }));
    await user.type(screen.getByLabelText('Notes (optional)'), 'The original marking is correct.');
    await user.click(screen.getByRole('button', { name: 'Submit Review' }));

    await waitFor(() => {
      expect(reviewRemarkRequest).toHaveBeenCalledWith(
        'remark-1',
        {
          status: 'rejected',
          newScore: undefined,
          reviewNotes: 'The original marking is correct.',
        },
        'reviewer-token'
      );
    });
  });

  it('keeps the decision form open and announces an API failure', async () => {
    const user = userEvent.setup();
    listRemarkQueue.mockResolvedValue([assignedAppeal]);
    reviewRemarkRequest.mockRejectedValue(new ApiError('Appeal was already decided', 409));

    render(<RemarksPage />);

    await user.click(await screen.findByRole('button', { name: 'Review' }));
    await user.click(screen.getByRole('button', { name: 'Submit Review' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Appeal was already decided');
    expect(screen.getByRole('heading', { name: /Reviewing: Ada Lovelace/ })).toBeInTheDocument();
  });
});
