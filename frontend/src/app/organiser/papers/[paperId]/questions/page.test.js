import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useParams } from 'next/navigation';
import QuestionsPage from './page';
import * as api from '@/lib/api';
import { expectNoAxeViolations } from '@/test/axe';

// Mock Next.js hooks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

// Mock Clerk auth
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }),
}));

// Mock the useRequireRole hook
vi.mock('@/hooks/useRequireRole', () => ({
  useRequireRole: (role) => ({
    user: { id: 'user-1', role, name: 'Test User' },
    checking: false,
  }),
}));

// Mock OrganiserShell
vi.mock('@/components/OrganiserShell', () => ({
  default: ({ children }) => <div data-testid="organiser-shell">{children}</div>,
}));

// Mock API calls
vi.mock('@/lib/api', () => ({
  listQuestions: vi.fn(),
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  createVariant: vi.fn(),
  updateVariant: vi.fn(),
  deleteVariant: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  },
}));

const mockQuestions = [
  {
    id: 'q-1',
    paperId: 'paper-1',
    number: 1,
    text: 'What is 2+2?',
    type: 'short_answer',
    marks: 5,
    memoAnswer: '4',
    options: null,
    rubric: null,
    variants: [
      {
        id: 'v-1',
        questionId: 'q-1',
        label: 'Variant A',
        text: 'What is 2+2 in base 3?',
        memoAnswer: '11',
      },
    ],
  },
  {
    id: 'q-2',
    paperId: 'paper-1',
    number: 2,
    text: 'Explain photosynthesis',
    type: 'essay',
    marks: 10,
    memoAnswer: null,
    options: null,
    rubric: null,
    variants: [],
  },
];

function setup() {
  const router = { back: vi.fn() };
  useRouter.mockReturnValue(router);
  useParams.mockReturnValue({ paperId: 'paper-1' });

  const utils = render(<QuestionsPage />);
  return { router, ...utils };
}

describe('QuestionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listQuestions.mockResolvedValue(mockQuestions);
  });

  describe('Initial load', () => {
    it('renders the page title and description', async () => {
      setup();
      expect(screen.getByRole('heading', { name: 'Questions' })).toBeInTheDocument();
      expect(screen.getByText('Manage questions and variants for this paper')).toBeInTheDocument();
    });

    it('loads and displays questions', async () => {
      setup();
      await waitFor(() => {
        expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
        expect(screen.getByText('Explain photosynthesis')).toBeInTheDocument();
      });
    });

    it('displays question numbers, types, and marks', async () => {
      setup();
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument(); // Question number
        // The type badge is visually uppercased via CSS; the DOM text is as written
        expect(screen.getByText('Short Answer')).toBeInTheDocument();
        expect(screen.getByText('5 marks')).toBeInTheDocument();
      });
    });

    it('shows the Add Question button', () => {
      setup();
      expect(screen.getByRole('button', { name: /add question/i })).toBeInTheDocument();
    });

    it('shows the Back button', () => {
      setup();
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });
  });

  describe('Create question', () => {
    it('shows the create form when Add Question is clicked', async () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: /add question/i }));
      expect(screen.getByText('New Question')).toBeInTheDocument();
      expect(screen.getByLabelText('Question Number')).toBeInTheDocument();
      expect(screen.getByLabelText('Question Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Question Text')).toBeInTheDocument();
      expect(screen.getByLabelText('Marks')).toBeInTheDocument();
    });

    it('creates a new question successfully', async () => {
      api.createQuestion.mockResolvedValue({ id: 'q-new', ...mockQuestions[0] });
      setup();

      fireEvent.click(screen.getByRole('button', { name: /add question/i }));

      fireEvent.change(screen.getByLabelText('Question Number'), {
        target: { value: '3' },
      });
      fireEvent.change(screen.getByLabelText('Marks'), {
        target: { value: '5' },
      });
      fireEvent.change(screen.getByLabelText('Question Text'), {
        target: { value: 'New question' },
      });

      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(api.createQuestion).toHaveBeenCalledWith(
          'paper-1',
          expect.objectContaining({
            number: 3,
            text: 'New question',
            marks: 5,
          }),
          'test-token'
        );
      });
    });

    it('cancels the form when Cancel is clicked', () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: /add question/i }));
      expect(screen.getByText('New Question')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByText('New Question')).not.toBeInTheDocument();
    });
  });

  describe('Edit question', () => {
    it('opens the edit form with question data', async () => {
      setup();
      await waitFor(() => {
        expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Question')).toBeInTheDocument();
        expect(screen.getByDisplayValue('What is 2+2?')).toBeInTheDocument();
        expect(screen.getByDisplayValue('5')).toBeInTheDocument();
      });
    });

    it('updates a question successfully', async () => {
      api.updateQuestion.mockResolvedValue({ ...mockQuestions[0], text: 'Updated' });
      setup();

      await waitFor(() => {
        expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);

      fireEvent.change(screen.getByLabelText('Question Text'), {
        target: { value: 'Updated question' },
      });

      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(api.updateQuestion).toHaveBeenCalledWith(
          'q-1',
          expect.objectContaining({ text: 'Updated question' }),
          'test-token'
        );
      });
    });
  });

  describe('Delete question', () => {
    it('deletes a question after confirmation', async () => {
      api.deleteQuestion.mockResolvedValue({});
      setup();

      await waitFor(() => {
        expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Delete');
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(api.deleteQuestion).toHaveBeenCalledWith('q-1', 'test-token');
      });

      window.confirm.mockRestore();
    });

    it('does not delete when cancelled', async () => {
      setup();

      await waitFor(() => {
        expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Delete');
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      fireEvent.click(deleteButtons[0]);

      expect(api.deleteQuestion).not.toHaveBeenCalled();
      window.confirm.mockRestore();
    });
  });

  describe('Variant management', () => {
    it('expands variants section when clicked', async () => {
      setup();

      await waitFor(() => {
        expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
      });

      const variantButtons = screen.getAllByText(/variants \(\d+\)/i);
      fireEvent.click(variantButtons[0]);

      expect(screen.getByText('Variant A')).toBeInTheDocument();
    });

    it('shows add variant button when expanded', async () => {
      setup();

      await waitFor(() => {
        expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
      });

      const variantButtons = screen.getAllByText(/variants \(\d+\)/i);
      fireEvent.click(variantButtons[0]);

      expect(screen.getByRole('button', { name: /add variant/i })).toBeInTheDocument();
    });

    it('creates a new variant', async () => {
      api.createVariant.mockResolvedValue({ id: 'v-new', label: 'Variant B' });
      setup();

      await waitFor(() => {
        expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
      });

      const variantButtons = screen.getAllByText(/variants \(\d+\)/i);
      fireEvent.click(variantButtons[0]);

      fireEvent.click(screen.getByRole('button', { name: /add variant/i }));

      fireEvent.change(screen.getByPlaceholderText(/variant a, version 1/i), {
        target: { value: 'Variant B' },
      });

      // Only the variant form is open, so its Save is the only one rendered
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(api.createVariant).toHaveBeenCalledWith(
          'q-1',
          expect.objectContaining({ label: 'Variant B' }),
          'test-token'
        );
      });
    });

    it('deletes a variant after confirmation', async () => {
      api.deleteVariant.mockResolvedValue({});
      setup();

      await waitFor(() => {
        expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
      });

      const variantButtons = screen.getAllByText(/variants \(\d+\)/i);
      fireEvent.click(variantButtons[0]);

      // Document order: q-1 delete, then the expanded variant's delete, then q-2's
      const deleteVariantButton = screen.getAllByTitle('Delete')[1];
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fireEvent.click(deleteVariantButton);

      await waitFor(() => {
        expect(api.deleteVariant).toHaveBeenCalledWith('v-1', 'test-token');
      });

      window.confirm.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('displays error when loading fails', async () => {
      api.listQuestions.mockRejectedValue(new api.ApiError('Failed to load', 500));
      setup();

      await waitFor(() => {
        expect(screen.getByText('Failed to load')).toBeInTheDocument();
      });
    });

    it('displays error when creation fails', async () => {
      api.createQuestion.mockRejectedValue(new api.ApiError('Creation failed', 400));
      setup();

      fireEvent.click(screen.getByRole('button', { name: /add question/i }));

      fireEvent.change(screen.getByLabelText('Question Number'), {
        target: { value: '3' },
      });
      fireEvent.change(screen.getByLabelText('Marks'), {
        target: { value: '5' },
      });
      fireEvent.change(screen.getByLabelText('Question Text'), {
        target: { value: 'New question' },
      });

      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(screen.getByText('Creation failed')).toBeInTheDocument();
      });
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no questions exist', async () => {
      api.listQuestions.mockResolvedValue([]);
      setup();

      await waitFor(() => {
        expect(
          // The component renders typographic quotes (react/no-unescaped-entities)
          screen.getByText(/no questions yet\. click “add question” to create one\./i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has no axe accessibility violations', async () => {
      const { container } = setup();
      await waitFor(() => {
        expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
      });
      await expectNoAxeViolations(container);
    });
  });
});
