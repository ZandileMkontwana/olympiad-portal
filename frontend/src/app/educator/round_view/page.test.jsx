import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockGetToken = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('id=round-1'),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api', () => ({
  listRoundSubmissions: vi.fn(),
  requestRemark: vi.fn(),
  releaseResults: vi.fn(),
  unreleaseResults: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

import RoundViewPage from './page';
import {
  ApiError,
  listRoundSubmissions,
  releaseResults,
  requestRemark,
  unreleaseResults,
} from '@/lib/api';

const closedRound = {
  id: 'round-1',
  name: 'Mathematics Round 1',
  state: 'closed',
  openTime: '2026-09-01T09:00:00.000Z',
  closeTime: '2026-12-01T09:00:00.000Z',
};

const scoredSubmission = {
  id: 'submission-1',
  entrant: { name: 'Ada Lovelace' },
  result: { score: 8 },
  remarkRequests: [],
};

function mockRoundLoad() {
  global.fetch.mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(closedRound),
  });
}

describe('Educator round view appeal submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    mockGetToken.mockResolvedValue('test-token');
    mockRoundLoad();
    listRoundSubmissions.mockResolvedValue([scoredSubmission]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('submits a trimmed appeal reason and refreshes the active appeal status', async () => {
    listRoundSubmissions.mockResolvedValueOnce([scoredSubmission]).mockResolvedValueOnce([
      {
        ...scoredSubmission,
        remarkRequests: [{ id: 'remark-1', status: 'pending' }],
      },
    ]);
    requestRemark.mockResolvedValue({ id: 'remark-1', status: 'pending' });

    render(<RoundViewPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Request Remark' }));
    fireEvent.change(screen.getByLabelText('Why are you requesting a remark?'), {
      target: { value: '  Question 3 should receive method marks.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Remark Request' }));

    await waitFor(() => {
      expect(requestRemark).toHaveBeenCalledWith(
        'submission-1',
        'Question 3 should receive method marks.',
        'test-token'
      );
    });
    expect(await screen.findByText(/Remark pending/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request Remark' })).toBeNull();
  });

  it('shows an assigned appeal as under review and prevents another request', async () => {
    listRoundSubmissions.mockResolvedValue([
      {
        ...scoredSubmission,
        remarkRequests: [{ id: 'remark-1', status: 'assigned' }],
      },
    ]);

    render(<RoundViewPage />);

    expect(await screen.findByText(/Remark under review/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request Remark' })).toBeNull();
  });

  it('keeps the form open and shows the API error when appeal submission fails', async () => {
    requestRemark.mockRejectedValue(new ApiError('Unable to submit appeal', 500));

    render(<RoundViewPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Request Remark' }));
    fireEvent.change(screen.getByLabelText('Why are you requesting a remark?'), {
      target: { value: 'Please review the marking.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Remark Request' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to submit appeal');
    expect(screen.getByLabelText('Why are you requesting a remark?')).toBeInTheDocument();
  });
});
