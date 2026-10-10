import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUseRequireRole = vi.fn();
const mockGetToken = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/organiser/test',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/hooks/useRequireRole', () => ({
  useRequireRole: () => mockUseRequireRole(),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock('@/lib/api', () => ({
  listRemarkQueue: vi.fn(),
  listAllOrganisers: vi.fn(),
  assignRemarkRequest: vi.fn(),
  reviewRemarkRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

import RemarksPage from './page';
import {
  ApiError,
  listRemarkQueue,
  listAllOrganisers,
  assignRemarkRequest,
  reviewRemarkRequest,
} from '@/lib/api';

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

const pendingAppeal = {
  id: 'remark-2',
  status: 'pending',
  reason: 'The total looks wrong.',
  requestedBy: { id: 'educator-1', name: 'Ms Teacher' },
  assignedTo: null,
  submission: {
    entrant: { name: 'Grace Hopper' },
    round: { name: 'Mathematics Round 2' },
    result: { score: 6 },
    answers: { 1: 'First answer' },
    markingTask: { breakdown: { 1: 6 } },
  },
};

describe('/organiser/remarks reviewer queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRequireRole.mockReturnValue({ user: reviewer, checking: false });
    mockGetToken.mockResolvedValue('reviewer-token');
    listAllOrganisers.mockResolvedValue([]);
  });

  it('shows a loading state while the organiser role is checked', () => {
    mockUseRequireRole.mockReturnValue({ user: null, checking: true });

    render(<RemarksPage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(listRemarkQueue).not.toHaveBeenCalled();
  });

  it('loads the pending queue and the appeals assigned to the signed-in reviewer', async () => {
    listRemarkQueue.mockImplementation((_token, options = {}) =>
      options.assignedTo === 'me' ? Promise.resolve([assignedAppeal]) : Promise.resolve([])
    );

    render(<RemarksPage />);

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText(/Mathematics Round 1.*current score: 7.5/)).toBeInTheDocument();
    expect(screen.getByText('No pending appeals are waiting to be routed.')).toBeInTheDocument();
    expect(listRemarkQueue).toHaveBeenCalledWith('reviewer-token', { assignedTo: 'me' });
    expect(listRemarkQueue).toHaveBeenCalledWith('reviewer-token', { status: 'pending' });
  });

  it('approves an assigned appeal with the updated score and trimmed notes', async () => {
    const user = userEvent.setup();
    listRemarkQueue
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([assignedAppeal])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
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
    listRemarkQueue.mockImplementation((_token, options = {}) =>
      options.assignedTo === 'me' ? Promise.resolve([assignedAppeal]) : Promise.resolve([])
    );
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
    listRemarkQueue.mockImplementation((_token, options = {}) =>
      options.assignedTo === 'me' ? Promise.resolve([assignedAppeal]) : Promise.resolve([])
    );
    reviewRemarkRequest.mockRejectedValue(new ApiError('Appeal was already decided', 409));

    render(<RemarksPage />);

    await user.click(await screen.findByRole('button', { name: 'Review' }));
    await user.click(screen.getByRole('button', { name: 'Submit Review' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Appeal was already decided');
    expect(screen.getByRole('heading', { name: /Reviewing: Ada Lovelace/ })).toBeInTheDocument();
  });
});

describe('/organiser/remarks pending queue routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRequireRole.mockReturnValue({ user: reviewer, checking: false });
    mockGetToken.mockResolvedValue('reviewer-token');
    listAllOrganisers.mockResolvedValue([]);
  });

  it('lets the organiser take a pending appeal themselves', async () => {
    const user = userEvent.setup();
    let taken = false;
    assignRemarkRequest.mockImplementation(async () => {
      taken = true;
      return { id: 'remark-2', status: 'assigned', assignedToId: reviewer.id };
    });
    listRemarkQueue.mockImplementation((_token, options = {}) => {
      if (options.assignedTo === 'me') {
        return Promise.resolve(
          taken ? [{ ...pendingAppeal, status: 'assigned', assignedTo: reviewer }] : []
        );
      }
      return Promise.resolve(taken ? [] : [pendingAppeal]);
    });

    render(<RemarksPage />);

    await user.click(await screen.findByRole('button', { name: 'Assign to me' }));

    await waitFor(() => {
      expect(assignRemarkRequest).toHaveBeenCalledWith('remark-2', {}, 'reviewer-token');
    });
    // The appeal left the pending queue and became reviewable by its new owner.
    expect(
      await screen.findByText('No pending appeals are waiting to be routed.')
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Review' })).toBeInTheDocument();
  });

  it('routes a pending appeal to a different reviewer from the dropdown', async () => {
    const user = userEvent.setup();
    listAllOrganisers.mockResolvedValue([
      reviewer,
      { id: 'organiser-3', name: 'Reviewer Three', email: 'three@school.com' },
    ]);
    let routed = false;
    assignRemarkRequest.mockImplementation(async () => {
      routed = true;
      return { id: 'remark-2', status: 'assigned', assignedToId: 'organiser-3' };
    });
    listRemarkQueue.mockImplementation((_token, options = {}) =>
      Promise.resolve(routed || options.assignedTo === 'me' ? [] : [pendingAppeal])
    );

    render(<RemarksPage />);

    const select = await screen.findByLabelText('Reviewer for Grace Hopper');
    // The signed-in reviewer self-assigns with the button, so only other
    // organisers are offered as routing targets.
    expect(within(select).getByRole('option', { name: 'Reviewer Three' })).toBeInTheDocument();
    expect(
      within(select).queryByRole('option', { name: 'reviewer@school.com' })
    ).not.toBeInTheDocument();

    await user.selectOptions(select, 'organiser-3');
    await user.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(assignRemarkRequest).toHaveBeenCalledWith(
        'remark-2',
        { assignedToId: 'organiser-3' },
        'reviewer-token'
      );
    });
    // The appeal left the pending queue entirely — it is another reviewer's now.
    expect(
      await screen.findByText('No pending appeals are waiting to be routed.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review' })).not.toBeInTheDocument();
  });

  it('announces an assignment failure and keeps the appeal pending', async () => {
    const user = userEvent.setup();
    listRemarkQueue.mockImplementation((_token, options = {}) =>
      Promise.resolve(options.assignedTo === 'me' ? [] : [pendingAppeal])
    );
    assignRemarkRequest.mockRejectedValue(
      new ApiError("Remark request cannot be assigned - current status is 'assigned'", 409)
    );

    render(<RemarksPage />);

    await user.click(await screen.findByRole('button', { name: 'Assign to me' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Remark request cannot be assigned');
    expect(screen.getByRole('button', { name: 'Assign to me' })).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
  });
});
