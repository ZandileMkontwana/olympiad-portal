import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const { calculateDifficultyForRound, updateQuestionDifficulty } = require('./difficulty');
const prisma = require('../lib/prisma');

describe('Difficulty calculation', () => {
  beforeEach(() => {
    vi.spyOn(prisma.submission, 'findMany');
    // Variant choices are resolved via a separate sitting lookup keyed by
    // entrantId (Submission has no Prisma relation to Sitting) — default to
    // "no sittings recorded" so questions fall back to their base memos.
    vi.spyOn(prisma.sitting, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.question, 'update');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockQuestions = [
    {
      id: 'q-1',
      number: 1,
      text: 'What is 2+2?',
      type: 'short_answer',
      marks: 5,
      memoAnswer: '4',
      variants: [],
    },
    {
      id: 'q-2',
      number: 2,
      text: 'What is 3+3?',
      type: 'short_answer',
      marks: 5,
      memoAnswer: '6',
      variants: [
        { id: 'v-1', label: 'Variant A', memoAnswer: '6' },
        { id: 'v-2', label: 'Variant B', memoAnswer: 'six' },
      ],
    },
  ];

  describe('calculateDifficultyForRound', () => {
    it('returns empty map when no submissions exist', async () => {
      prisma.submission.findMany.mockResolvedValue([]);

      const result = await calculateDifficultyForRound('round-1');

      expect(result.size).toBe(0);
    });

    it('returns empty map when round has no paper', async () => {
      prisma.submission.findMany.mockResolvedValue([
        { id: 'sub-1', entrantId: 'entrant-1', answers: {} },
      ]);
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1', paper: null });

      const result = await calculateDifficultyForRound('round-1');

      expect(result.size).toBe(0);
    });

    it('calculates difficulty correctly with no variants', async () => {
      const submissions = [
        {
          id: 'sub-1',
          entrantId: 'entrant-1',
          answers: { 'q-1': '4', 'q-2': '6' },
        },
        {
          id: 'sub-2',
          entrantId: 'entrant-2',
          answers: { 'q-1': '4', 'q-2': 'wrong' },
        },
      ];

      prisma.submission.findMany.mockResolvedValue(submissions);
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        paper: { questions: mockQuestions },
      });

      const result = await calculateDifficultyForRound('round-1');

      // q-1: 2/2 correct = 1.0 (10 marks earned / 10 marks possible)
      expect(result.get('q-1')).toBe(1.0);
      // q-2: 1/2 correct = 0.5 (5 marks earned / 10 marks possible)
      expect(result.get('q-2')).toBe(0.5);
    });

    it('calculates difficulty with variant-specific memos', async () => {
      const submissions = [
        {
          id: 'sub-1',
          entrantId: 'entrant-1',
          answers: { 'q-1': '4', 'q-2': '6' },
        },
        {
          id: 'sub-2',
          entrantId: 'entrant-2',
          answers: { 'q-1': '4', 'q-2': 'six' },
        },
        {
          id: 'sub-3',
          entrantId: 'entrant-3',
          answers: { 'q-1': 'wrong', 'q-2': '6' },
        },
      ];

      prisma.submission.findMany.mockResolvedValue(submissions);
      // Variant choices live on each entrant's sitting, fetched separately.
      prisma.sitting.findMany.mockResolvedValue([
        { entrantId: 'entrant-1', variantChoices: { 'q-2': 'v-1' } }, // Variant A expects '6'
        { entrantId: 'entrant-2', variantChoices: { 'q-2': 'v-2' } }, // Variant B expects 'six'
        { entrantId: 'entrant-3', variantChoices: { 'q-2': 'v-2' } }, // Variant B expects 'six', got '6'
      ]);
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        paper: { questions: mockQuestions },
      });

      const result = await calculateDifficultyForRound('round-1');

      // q-1: 2/3 correct = 0.667 (10 marks earned / 15 marks possible)
      expect(result.get('q-1')).toBeCloseTo(0.667, 2);
      // q-2: sub-1 correct (v-1 expects '6'), sub-2 correct (v-2 expects 'six'), sub-3 wrong (v-2 expects 'six', got '6')
      // = 2/3 correct = 0.667 (10 marks earned / 15 marks possible)
      expect(result.get('q-2')).toBeCloseTo(0.667, 2);
    });

    it('handles questions without memo answers', async () => {
      const questionsWithoutMemo = [
        ...mockQuestions,
        {
          id: 'q-3',
          number: 3,
          text: 'Explain photosynthesis',
          type: 'essay',
          marks: 10,
          memoAnswer: null,
          variants: [],
        },
      ];

      const submissions = [
        {
          id: 'sub-1',
          entrantId: 'entrant-1',
          answers: { 'q-1': '4', 'q-2': '6', 'q-3': 'some answer' },
        },
      ];

      prisma.submission.findMany.mockResolvedValue(submissions);
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        paper: { questions: questionsWithoutMemo },
      });

      const result = await calculateDifficultyForRound('round-1');

      // q-1 and q-2 have memo answers, so they're calculated
      expect(result.get('q-1')).toBe(1.0);
      expect(result.get('q-2')).toBe(1.0);
      // q-3 has no memo answer, so difficulty is null
      expect(result.get('q-3')).toBeNull();
    });

    it('handles legacy sittings without variantChoices', async () => {
      const submissions = [
        {
          id: 'sub-1',
          entrantId: 'entrant-1',
          answers: { 'q-1': '4', 'q-2': '6' },
        },
      ];

      prisma.submission.findMany.mockResolvedValue(submissions);
      // No sitting row recorded for this entrant (legacy data)
      prisma.sitting.findMany.mockResolvedValue([]);
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        paper: { questions: mockQuestions },
      });

      const result = await calculateDifficultyForRound('round-1');

      // Should fall back to base question memos
      expect(result.get('q-1')).toBe(1.0);
      expect(result.get('q-2')).toBe(1.0);
    });

    it('calculates zero difficulty when all answers are wrong', async () => {
      const submissions = [
        {
          id: 'sub-1',
          entrantId: 'entrant-1',
          answers: { 'q-1': 'wrong', 'q-2': 'wrong' },
        },
        {
          id: 'sub-2',
          entrantId: 'entrant-2',
          answers: { 'q-1': 'also wrong', 'q-2': 'also wrong' },
        },
      ];

      prisma.submission.findMany.mockResolvedValue(submissions);
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        paper: { questions: mockQuestions },
      });

      const result = await calculateDifficultyForRound('round-1');

      expect(result.get('q-1')).toBe(0.0);
      expect(result.get('q-2')).toBe(0.0);
    });
  });

  describe('updateQuestionDifficulty', () => {
    it('updates difficulty for all questions and returns count', async () => {
      const submissions = [
        {
          id: 'sub-1',
          entrantId: 'entrant-1',
          answers: { 'q-1': '4', 'q-2': '6' },
        },
      ];

      prisma.submission.findMany.mockResolvedValue(submissions);
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        paper: { questions: mockQuestions },
      });
      prisma.question.update.mockResolvedValue({});

      const count = await updateQuestionDifficulty('round-1');

      expect(count).toBe(2);
      expect(prisma.question.update).toHaveBeenCalledTimes(2);
      // Both questions should be marked correct (difficulty 1.0)
      expect(prisma.question.update).toHaveBeenCalledWith({
        where: { id: 'q-1' },
        data: { difficulty: 1.0 },
      });
      expect(prisma.question.update).toHaveBeenCalledWith({
        where: { id: 'q-2' },
        data: { difficulty: 1.0 },
      });
    });

    it('returns 0 when no questions to update', async () => {
      prisma.submission.findMany.mockResolvedValue([]);

      const count = await updateQuestionDifficulty('round-1');

      expect(count).toBe(0);
      expect(prisma.question.update).not.toHaveBeenCalled();
    });
  });
});
