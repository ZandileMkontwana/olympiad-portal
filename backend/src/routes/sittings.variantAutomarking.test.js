import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const sittingsRouter = require('./sittings');

// Simulate Clerk's clerkMiddleware() having run
function createApp(authenticated = true) {
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use(async (req, _res, next) => {
      req.auth = () => ({ userId: 'clerk-user-1' });
      const user = await prisma.user.findUnique({ where: { id: 'user-1' } });
      if (user) {
        req.user = user;
      }
      next();
    });
  }
  app.use('/api', sittingsRouter);
  return app;
}

describe('Variant-specific automarking', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.sitting, 'findUnique');
    vi.spyOn(prisma.sitting, 'update');
    vi.spyOn(prisma.submission, 'create');
    vi.spyOn(prisma.submission, 'findUnique');
    vi.spyOn(prisma.result, 'create');
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-1',
      email: 'student@test.com',
      role: 'entrant',
      name: 'Test Student',
    });
    vi.spyOn(prisma.entrant, 'findUnique').mockResolvedValue({
      id: 'entrant-1',
      name: 'Test Student',
      schoolId: 'school-1',
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockSittingWithVariants(variantChoices = {}) {
    return {
      id: 'sitting-1',
      entrantId: 'entrant-1',
      roundId: 'round-1',
      answers: {
        'q-1': '4',
        'q-2': 'photosynthesis process',
      },
      variantChoices,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      completedAt: null,
      round: {
        id: 'round-1',
        paper: {
          id: 'paper-1',
          questions: [
            {
              id: 'q-1',
              number: 1,
              text: 'What is 2+2?',
              type: 'short_answer',
              marks: 5,
              memoAnswer: '4',
              variants: [
                {
                  id: 'v-1',
                  label: 'Variant A',
                  text: 'What is 2+2 in base 3?',
                  memoAnswer: '11',
                },
                {
                  id: 'v-2',
                  label: 'Variant B',
                  text: 'What is 2+2 in base 4?',
                  memoAnswer: '10',
                },
              ],
            },
            {
              id: 'q-2',
              number: 2,
              text: 'Explain photosynthesis',
              type: 'essay',
              marks: 10,
              memoAnswer: 'photosynthesis process',
              variants: [],
            },
          ],
        },
      },
      entrant: {
        name: 'Test Student',
        schoolId: 'school-1',
      },
    };
  }

  describe('POST /sittings/:id/submit with variants', () => {
    it('marks against variant-specific memo when variant is assigned', async () => {
      const sitting = mockSittingWithVariants({ 'q-1': 'v-1' });
      // Student answered '4' but variant v-1 expects '11'
      sitting.answers = { 'q-1': '4', 'q-2': 'photosynthesis process' };

      prisma.sitting.findUnique.mockResolvedValue(sitting);
      prisma.submission.create.mockResolvedValue({
        id: 'sub-1',
        roundId: 'round-1',
        entrantId: 'entrant-1',
        answers: sitting.answers,
        idempotencyKey: 'sitting:sitting-1',
        submittedAt: new Date(),
      });
      prisma.result.create.mockResolvedValue({
        id: 'result-1',
        submissionId: 'sub-1',
        score: 50, // q-2 correct (10 marks), q-1 wrong (0 marks) = 10/15 = 66.67%
      });
      prisma.sitting.update.mockResolvedValue({
        ...sitting,
        completedAt: new Date(),
      });

      const res = await request(app).post('/api/sittings/sitting-1/submit');

      expect(res.status).toBe(201);
      expect(prisma.result.create).toHaveBeenCalled();

      // Check the score calculation
      const createCall = prisma.result.create.mock.calls[0][0];
      // q-1: answered '4', variant v-1 expects '11' -> wrong (0 marks)
      // q-2: answered 'photosynthesis process', expects 'photosynthesis process' -> correct (10 marks)
      // Total: 10/15 = 66.67%
      expect(createCall.data.score).toBeCloseTo(66.67, 1);
    });

    it('marks correctly when different variant is assigned', async () => {
      const sitting = mockSittingWithVariants({ 'q-1': 'v-2' });
      // Student answered '4' but variant v-2 expects '10'
      sitting.answers = { 'q-1': '4', 'q-2': 'photosynthesis process' };

      prisma.sitting.findUnique.mockResolvedValue(sitting);
      prisma.submission.create.mockResolvedValue({
        id: 'sub-1',
        roundId: 'round-1',
        entrantId: 'entrant-1',
        answers: sitting.answers,
        idempotencyKey: 'sitting:sitting-1',
        submittedAt: new Date(),
      });
      prisma.result.create.mockResolvedValue({
        id: 'result-1',
        submissionId: 'sub-1',
        score: 66.67,
      });
      prisma.sitting.update.mockResolvedValue({
        ...sitting,
        completedAt: new Date(),
      });

      const res = await request(app).post('/api/sittings/sitting-1/submit');

      expect(res.status).toBe(201);

      // Check the score calculation
      const createCall = prisma.result.create.mock.calls[0][0];
      // q-1: answered '4', variant v-2 expects '10' -> wrong (0 marks)
      // q-2: answered 'photosynthesis process', expects 'photosynthesis process' -> correct (10 marks)
      // Total: 10/15 = 66.67%
      expect(createCall.data.score).toBeCloseTo(66.67, 1);
    });

    it('marks against base question memo when no variant is assigned', async () => {
      const sitting = mockSittingWithVariants({}); // No variant choices
      sitting.answers = { 'q-1': '4', 'q-2': 'photosynthesis process' };

      prisma.sitting.findUnique.mockResolvedValue(sitting);
      prisma.submission.create.mockResolvedValue({
        id: 'sub-1',
        roundId: 'round-1',
        entrantId: 'entrant-1',
        answers: sitting.answers,
        idempotencyKey: 'sitting:sitting-1',
        submittedAt: new Date(),
      });
      prisma.result.create.mockResolvedValue({
        id: 'result-1',
        submissionId: 'sub-1',
        score: 100,
      });
      prisma.sitting.update.mockResolvedValue({
        ...sitting,
        completedAt: new Date(),
      });

      const res = await request(app).post('/api/sittings/sitting-1/submit');

      expect(res.status).toBe(201);

      // Check the score calculation
      const createCall = prisma.result.create.mock.calls[0][0];
      // q-1: answered '4', base question expects '4' -> correct (5 marks)
      // q-2: answered 'photosynthesis process', expects 'photosynthesis process' -> correct (10 marks)
      // Total: 15/15 = 100%
      expect(createCall.data.score).toBe(100);
    });

    it('gives full marks when variant answer matches', async () => {
      const sitting = mockSittingWithVariants({ 'q-1': 'v-1' });
      // Student answered '11' which matches variant v-1
      sitting.answers = { 'q-1': '11', 'q-2': 'photosynthesis process' };

      prisma.sitting.findUnique.mockResolvedValue(sitting);
      prisma.submission.create.mockResolvedValue({
        id: 'sub-1',
        roundId: 'round-1',
        entrantId: 'entrant-1',
        answers: sitting.answers,
        idempotencyKey: 'sitting:sitting-1',
        submittedAt: new Date(),
      });
      prisma.result.create.mockResolvedValue({
        id: 'result-1',
        submissionId: 'sub-1',
        score: 100,
      });
      prisma.sitting.update.mockResolvedValue({
        ...sitting,
        completedAt: new Date(),
      });

      const res = await request(app).post('/api/sittings/sitting-1/submit');

      expect(res.status).toBe(201);

      const createCall = prisma.result.create.mock.calls[0][0];
      // q-1: answered '11', variant v-1 expects '11' -> correct (5 marks)
      // q-2: answered 'photosynthesis process', expects 'photosynthesis process' -> correct (10 marks)
      // Total: 15/15 = 100%
      expect(createCall.data.score).toBe(100);
    });

    it('handles mixed scenarios with some variants and some base questions', async () => {
      const sitting = mockSittingWithVariants({ 'q-1': 'v-2' });
      sitting.answers = { 'q-1': '10', 'q-2': 'wrong answer' };

      prisma.sitting.findUnique.mockResolvedValue(sitting);
      prisma.submission.create.mockResolvedValue({
        id: 'sub-1',
        roundId: 'round-1',
        entrantId: 'entrant-1',
        answers: sitting.answers,
        idempotencyKey: 'sitting:sitting-1',
        submittedAt: new Date(),
      });
      prisma.result.create.mockResolvedValue({
        id: 'result-1',
        submissionId: 'sub-1',
        score: 33.33,
      });
      prisma.sitting.update.mockResolvedValue({
        ...sitting,
        completedAt: new Date(),
      });

      const res = await request(app).post('/api/sittings/sitting-1/submit');

      expect(res.status).toBe(201);

      const createCall = prisma.result.create.mock.calls[0][0];
      // q-1: answered '10', variant v-2 expects '10' -> correct (5 marks)
      // q-2: answered 'wrong answer', expects 'photosynthesis process' -> wrong (0 marks)
      // Total: 5/15 = 33.33%
      expect(createCall.data.score).toBeCloseTo(33.33, 1);
    });

    it('handles questions without memo answers gracefully', async () => {
      const sitting = mockSittingWithVariants({ 'q-1': 'v-1' });
      // Remove memo answer from q-2
      sitting.round.paper.questions[1].memoAnswer = null;
      sitting.answers = { 'q-1': '11', 'q-2': 'some answer' };

      prisma.sitting.findUnique.mockResolvedValue(sitting);
      prisma.submission.create.mockResolvedValue({
        id: 'sub-1',
        roundId: 'round-1',
        entrantId: 'entrant-1',
        answers: sitting.answers,
        idempotencyKey: 'sitting:sitting-1',
        submittedAt: new Date(),
      });
      prisma.result.create.mockResolvedValue({
        id: 'result-1',
        submissionId: 'sub-1',
        score: 33.33,
      });
      prisma.sitting.update.mockResolvedValue({
        ...sitting,
        completedAt: new Date(),
      });

      const res = await request(app).post('/api/sittings/sitting-1/submit');

      expect(res.status).toBe(201);

      const createCall = prisma.result.create.mock.calls[0][0];
      // q-1: answered '11', variant v-1 expects '11' -> correct (5 marks)
      // q-2: no memo answer -> cannot be marked (0 marks out of 10)
      // Total: 5/15 = 33.33%
      expect(createCall.data.score).toBeCloseTo(33.33, 1);
    });
  });
});
