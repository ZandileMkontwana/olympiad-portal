import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const questionsRouter = require('./questions');

// Simulate Clerk's clerkMiddleware() having run: req.auth() returns the
// signed-in Clerk user. requireRole() (middleware/auth.js) then loads the
// matching database record to check the role and set req.user.
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
  app.use('/api', questionsRouter);
  return app;
}

describe('Questions routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.paper, 'findUnique');
    vi.spyOn(prisma.question, 'findMany');
    vi.spyOn(prisma.question, 'findUnique');
    vi.spyOn(prisma.question, 'create');
    vi.spyOn(prisma.question, 'update');
    vi.spyOn(prisma.question, 'delete');
    vi.spyOn(prisma.questionVariant, 'findMany');
    vi.spyOn(prisma.questionVariant, 'findUnique');
    vi.spyOn(prisma.questionVariant, 'create');
    vi.spyOn(prisma.questionVariant, 'update');
    vi.spyOn(prisma.questionVariant, 'delete');
    vi.spyOn(prisma.questionVariant, 'deleteMany');
    vi.spyOn(prisma.olympiadOrganiser, 'findUnique').mockResolvedValue({
      id: 'oo-1',
      olympiadId: 'oly-1',
      organiserId: 'user-1',
    });
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-1',
      email: 'organiser@olympiad.com',
      role: 'organiser',
      name: 'Organiser One',
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create a mock paper with round and olympiad
  function mockPaper(paperId = 'paper-1') {
    return {
      id: paperId,
      roundId: 'round-1',
      round: {
        id: 'round-1',
        olympiadId: 'oly-1',
        olympiad: { id: 'oly-1', name: 'Test Olympiad' },
      },
    };
  }

  // Helper to create a mock question
  function mockQuestion(questionId = 'q-1', paperId = 'paper-1') {
    return {
      id: questionId,
      paperId,
      number: 1,
      text: 'What is 2+2?',
      type: 'short_answer',
      marks: 5,
      memoAnswer: '4',
      options: null,
      rubric: null,
      variants: [],
      paper: mockPaper(paperId),
    };
  }

  // Helper to create a mock variant
  function mockVariant(variantId = 'v-1', questionId = 'q-1') {
    return {
      id: variantId,
      questionId,
      label: 'Variant A',
      text: 'What is 2+2 in base 3?',
      memoAnswer: '11',
      options: null,
      question: mockQuestion(questionId),
    };
  }

  describe('GET /papers/:paperId/questions', () => {
    it('should list questions for a paper', async () => {
      const paper = mockPaper();
      const questions = [mockQuestion('q-1'), mockQuestion('q-2')];

      prisma.paper.findUnique.mockResolvedValue(paper);
      prisma.question.findMany.mockResolvedValue(questions);

      const res = await request(app).get('/api/papers/paper-1/questions');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].id).toBe('q-1');
      expect(prisma.question.findMany).toHaveBeenCalledWith({
        where: { paperId: 'paper-1' },
        include: { variants: true },
        orderBy: { number: 'asc' },
      });
    });

    it('should return 404 if paper not found', async () => {
      prisma.paper.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/papers/nonexistent/questions');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Paper not found');
    });

    it('should return 403 if user is not an organiser', async () => {
      prisma.paper.findUnique.mockResolvedValue(mockPaper());
      prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/papers/paper-1/questions');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('You are not an organiser of this olympiad');
    });
  });

  describe('POST /papers/:paperId/questions', () => {
    it('should create a new question', async () => {
      const paper = mockPaper();
      const newQuestion = mockQuestion('q-new');

      prisma.paper.findUnique.mockResolvedValue(paper);
      prisma.question.findUnique.mockResolvedValue(null); // No conflict
      prisma.question.create.mockResolvedValue(newQuestion);

      const res = await request(app).post('/api/papers/paper-1/questions').send({
        number: 1,
        text: 'What is 2+2?',
        type: 'short_answer',
        marks: 5,
        memoAnswer: '4',
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('q-new');
      expect(prisma.question.create).toHaveBeenCalledWith({
        data: {
          paperId: 'paper-1',
          number: 1,
          text: 'What is 2+2?',
          type: 'short_answer',
          marks: 5,
          memoAnswer: '4',
          options: null,
          rubric: null,
        },
        include: { variants: true },
      });
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/papers/paper-1/questions')
        .send({ text: 'What is 2+2?' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should return 400 if type is invalid', async () => {
      prisma.paper.findUnique.mockResolvedValue(mockPaper());

      const res = await request(app).post('/api/papers/paper-1/questions').send({
        number: 1,
        text: 'What is 2+2?',
        type: 'invalid_type',
        marks: 5,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('type must be one of');
    });

    it('should return 400 if marks is negative', async () => {
      prisma.paper.findUnique.mockResolvedValue(mockPaper());

      const res = await request(app).post('/api/papers/paper-1/questions').send({
        number: 1,
        text: 'What is 2+2?',
        type: 'short_answer',
        marks: -5,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('marks must be a non-negative number');
    });

    it('should return 409 if question number already exists', async () => {
      prisma.paper.findUnique.mockResolvedValue(mockPaper());
      prisma.question.findUnique.mockResolvedValue(mockQuestion()); // Conflict

      const res = await request(app).post('/api/papers/paper-1/questions').send({
        number: 1,
        text: 'What is 2+2?',
        type: 'short_answer',
        marks: 5,
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('should return 404 if paper not found', async () => {
      prisma.paper.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/papers/nonexistent/questions').send({
        number: 1,
        text: 'What is 2+2?',
        type: 'short_answer',
        marks: 5,
      });

      expect(res.status).toBe(404);
    });

    it('should return 403 if user is not an organiser', async () => {
      prisma.paper.findUnique.mockResolvedValue(mockPaper());
      prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/papers/paper-1/questions').send({
        number: 1,
        text: 'What is 2+2?',
        type: 'short_answer',
        marks: 5,
      });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /questions/:id', () => {
    it('should get a single question with variants', async () => {
      const question = mockQuestion();
      prisma.question.findUnique.mockResolvedValue(question);

      const res = await request(app).get('/api/questions/q-1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('q-1');
      expect(prisma.question.findUnique).toHaveBeenCalledWith({
        where: { id: 'q-1' },
        include: {
          variants: true,
          paper: { include: { round: { include: { olympiad: true } } } },
        },
      });
    });

    it('should return 404 if question not found', async () => {
      prisma.question.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/questions/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Question not found');
    });

    it('should return 403 if user is not an organiser', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion());
      prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/questions/q-1');

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /questions/:id', () => {
    it('should update a question', async () => {
      const existing = mockQuestion();
      const updated = { ...existing, text: 'Updated question' };

      prisma.question.findUnique.mockResolvedValue(existing);
      prisma.question.update.mockResolvedValue(updated);

      const res = await request(app).put('/api/questions/q-1').send({ text: 'Updated question' });

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('Updated question');
    });

    it('should return 404 if question not found', async () => {
      prisma.question.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/questions/nonexistent')
        .send({ text: 'Updated question' });

      expect(res.status).toBe(404);
    });

    it('should return 400 if type is invalid', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion());

      const res = await request(app).put('/api/questions/q-1').send({ type: 'invalid_type' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('type must be one of');
    });

    it('should return 409 if new number conflicts', async () => {
      const existing = mockQuestion();
      prisma.question.findUnique
        .mockResolvedValueOnce(existing) // First call: check existence
        .mockResolvedValueOnce(mockQuestion('q-2')); // Second call: check conflict

      const res = await request(app).put('/api/questions/q-1').send({ number: 2 });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('should return 403 if user is not an organiser', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion());
      prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

      const res = await request(app).put('/api/questions/q-1').send({ text: 'Updated question' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /questions/:id', () => {
    it('should delete a question and its variants', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion());
      prisma.questionVariant.deleteMany.mockResolvedValue({ count: 2 });
      prisma.question.delete.mockResolvedValue({});

      const res = await request(app).delete('/api/questions/q-1');

      expect(res.status).toBe(204);
      expect(prisma.questionVariant.deleteMany).toHaveBeenCalledWith({
        where: { questionId: 'q-1' },
      });
      expect(prisma.question.delete).toHaveBeenCalledWith({
        where: { id: 'q-1' },
      });
    });

    it('should return 404 if question not found', async () => {
      prisma.question.findUnique.mockResolvedValue(null);

      const res = await request(app).delete('/api/questions/nonexistent');

      expect(res.status).toBe(404);
    });

    it('should return 403 if user is not an organiser', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion());
      prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

      const res = await request(app).delete('/api/questions/q-1');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /questions/:id/variants', () => {
    it('should list variants for a question', async () => {
      const question = mockQuestion();
      const variants = [mockVariant('v-1'), mockVariant('v-2')];

      prisma.question.findUnique.mockResolvedValue(question);
      prisma.questionVariant.findMany.mockResolvedValue(variants);

      const res = await request(app).get('/api/questions/q-1/variants');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].id).toBe('v-1');
    });

    it('should return 404 if question not found', async () => {
      prisma.question.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/questions/nonexistent/variants');

      expect(res.status).toBe(404);
    });

    it('should return 403 if user is not an organiser', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion());
      prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/questions/q-1/variants');

      expect(res.status).toBe(403);
    });
  });

  describe('POST /questions/:id/variants', () => {
    it('should create a new variant', async () => {
      const question = mockQuestion();
      const newVariant = mockVariant('v-new');

      prisma.question.findUnique.mockResolvedValue(question);
      prisma.questionVariant.findUnique.mockResolvedValue(null); // No conflict
      prisma.questionVariant.create.mockResolvedValue(newVariant);

      const res = await request(app).post('/api/questions/q-1/variants').send({
        label: 'Variant A',
        text: 'What is 2+2 in base 3?',
        memoAnswer: '11',
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('v-new');
      expect(prisma.questionVariant.create).toHaveBeenCalledWith({
        data: {
          questionId: 'q-1',
          label: 'Variant A',
          text: 'What is 2+2 in base 3?',
          memoAnswer: '11',
          options: null,
        },
      });
    });

    it('should return 400 if label is missing', async () => {
      const res = await request(app)
        .post('/api/questions/q-1/variants')
        .send({ text: 'Variant text' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('label is required');
    });

    it('should return 404 if question not found', async () => {
      prisma.question.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/questions/nonexistent/variants')
        .send({ label: 'Variant A' });

      expect(res.status).toBe(404);
    });

    it('should return 409 if variant label already exists', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion());
      prisma.questionVariant.findUnique.mockResolvedValue(mockVariant()); // Conflict

      const res = await request(app)
        .post('/api/questions/q-1/variants')
        .send({ label: 'Variant A' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('should return 403 if user is not an organiser', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion());
      prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/questions/q-1/variants')
        .send({ label: 'Variant A' });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /variants/:id', () => {
    it('should update a variant', async () => {
      const existing = mockVariant();
      const updated = { ...existing, text: 'Updated variant text' };

      prisma.questionVariant.findUnique.mockResolvedValue(existing);
      prisma.questionVariant.update.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/variants/v-1')
        .send({ text: 'Updated variant text' });

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('Updated variant text');
    });

    it('should return 404 if variant not found', async () => {
      prisma.questionVariant.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/variants/nonexistent')
        .send({ text: 'Updated text' });

      expect(res.status).toBe(404);
    });

    it('should return 409 if new label conflicts', async () => {
      const existing = mockVariant();
      prisma.questionVariant.findUnique
        .mockResolvedValueOnce(existing) // First call: check existence
        .mockResolvedValueOnce(mockVariant('v-2')); // Second call: check conflict

      const res = await request(app).put('/api/variants/v-1').send({ label: 'Variant B' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('should return 403 if user is not an organiser', async () => {
      prisma.questionVariant.findUnique.mockResolvedValue(mockVariant());
      prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

      const res = await request(app).put('/api/variants/v-1').send({ text: 'Updated text' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /variants/:id', () => {
    it('should delete a variant', async () => {
      prisma.questionVariant.findUnique.mockResolvedValue(mockVariant());
      prisma.questionVariant.delete.mockResolvedValue({});

      const res = await request(app).delete('/api/variants/v-1');

      expect(res.status).toBe(204);
      expect(prisma.questionVariant.delete).toHaveBeenCalledWith({
        where: { id: 'v-1' },
      });
    });

    it('should return 404 if variant not found', async () => {
      prisma.questionVariant.findUnique.mockResolvedValue(null);

      const res = await request(app).delete('/api/variants/nonexistent');

      expect(res.status).toBe(404);
    });

    it('should return 403 if user is not an organiser', async () => {
      prisma.questionVariant.findUnique.mockResolvedValue(mockVariant());
      prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

      const res = await request(app).delete('/api/variants/v-1');

      expect(res.status).toBe(403);
    });
  });
});
