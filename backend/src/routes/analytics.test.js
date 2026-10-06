import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const analyticsRouter = require('./analytics');
const authorization = require('../lib/authorization');

const app = express();
app.use(express.json());
app.use('/api', analyticsRouter);

describe('Analytics Routes', () => {
  beforeEach(() => {
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.submission, 'findMany');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma, '$transaction').mockImplementation(async (fn) => fn(prisma));
    vi.spyOn(authorization, 'isOlympiadOrganiser');
  });

  const mockRound = {
    id: 'round-1',
    name: 'Round 1',
    olympiadId: 'olympiad-1',
    olympiad: { id: 'olympiad-1', name: 'Test Olympiad' },
    paper: {
      id: 'paper-1',
      questions: [
        { id: 'q-1', number: 1, text: 'Question 1', marks: 10, difficulty: 0.8, variants: [] },
        { id: 'q-2', number: 2, text: 'Question 2', marks: 10, difficulty: 0.6, variants: [] },
      ],
    },
  };

  const mockSubmissions = [
    {
      id: 'sub-1',
      roundId: 'round-1',
      result: { totalScore: 15 },
      entrant: { schoolId: 'school-1', school: { id: 'school-1', name: 'School A' } },
      sitting: { completedAt: new Date(), startedAt: new Date(Date.now() - 30 * 60 * 1000) },
    },
    {
      id: 'sub-2',
      roundId: 'round-1',
      result: { totalScore: 18 },
      entrant: { schoolId: 'school-1', school: { id: 'school-1', name: 'School A' } },
      sitting: { completedAt: new Date(), startedAt: new Date(Date.now() - 45 * 60 * 1000) },
    },
    {
      id: 'sub-3',
      roundId: 'round-1',
      result: { totalScore: 12 },
      entrant: { schoolId: 'school-2', school: { id: 'school-2', name: 'School B' } },
      sitting: { completedAt: new Date(), startedAt: new Date(Date.now() - 60 * 60 * 1000) },
    },
    {
      id: 'sub-4',
      roundId: 'round-1',
      result: null,
      entrant: { schoolId: 'school-2', school: { id: 'school-2', name: 'School B' } },
      sitting: { completedAt: null, startedAt: new Date() },
    },
  ];

  describe('GET /analytics/rounds/:roundId', () => {
    it('returns 404 if round not found', async () => {
      prisma.round.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/analytics/rounds/nonexistent')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Round not found');
    });

    it('returns 403 if user is not an organiser', async () => {
      prisma.round.findUnique.mockResolvedValue(mockRound);
      prisma.educator.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/analytics/rounds/round-1')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Not authorized');
    });

    it('returns comprehensive analytics for organisers', async () => {
      prisma.round.findUnique.mockResolvedValue(mockRound);
      prisma.submission.findMany.mockResolvedValue(mockSubmissions);
      authorization.isOlympiadOrganiser.mockResolvedValue(true);

      const res = await request(app)
        .get('/api/analytics/rounds/round-1')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('round');
      expect(res.body).toHaveProperty('participation');
      expect(res.body).toHaveProperty('scores');
      expect(res.body).toHaveProperty('timing');
      expect(res.body).toHaveProperty('questions');
      expect(res.body).toHaveProperty('schools');

      // Check participation metrics
      expect(res.body.participation.totalEntrants).toBe(4);
      expect(res.body.participation.completedSubmissions).toBe(3);
      expect(res.body.participation.completionRate).toBeCloseTo(0.75);

      // Check score metrics
      expect(res.body.scores.average).toBeGreaterThan(0);
      expect(res.body.scores.distribution).toBeInstanceOf(Array);
    });

    it('handles empty submissions gracefully', async () => {
      prisma.round.findUnique.mockResolvedValue(mockRound);
      prisma.submission.findMany.mockResolvedValue([]);
      authorization.isOlympiadOrganiser.mockResolvedValue(true);

      const res = await request(app)
        .get('/api/analytics/rounds/round-1')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.participation.totalEntrants).toBe(0);
      expect(res.body.scores.average).toBe(0);
    });
  });

  describe('GET /analytics/rounds/:roundId/schools/:schoolId', () => {
    it('returns 404 if round not found', async () => {
      prisma.round.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/analytics/rounds/nonexistent/schools/school-1')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(404);
    });

    it('returns 403 if educator tries to access another school', async () => {
      prisma.round.findUnique.mockResolvedValue(mockRound);
      prisma.educator.findUnique.mockResolvedValue({
        id: 'edu-1',
        userId: 'user-1',
        schoolId: 'school-2',
      });

      const res = await request(app)
        .get('/api/analytics/rounds/round-1/schools/school-1')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Not authorized');
    });

    it('allows educators to access their own school analytics', async () => {
      prisma.round.findUnique.mockResolvedValue(mockRound);
      prisma.submission.findMany.mockResolvedValue(
        mockSubmissions.filter((s) => s.entrant.schoolId === 'school-1')
      );
      prisma.educator.findUnique.mockResolvedValue({
        id: 'edu-1',
        userId: 'user-1',
        schoolId: 'school-1',
      });

      const res = await request(app)
        .get('/api/analytics/rounds/round-1/schools/school-1')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('school');
      expect(res.body.school.id).toBe('school-1');
      expect(res.body.participation.totalEntrants).toBe(2);
    });

    it('allows organisers to access any school analytics', async () => {
      prisma.round.findUnique.mockResolvedValue(mockRound);
      prisma.submission.findMany.mockResolvedValue(
        mockSubmissions.filter((s) => s.entrant.schoolId === 'school-1')
      );
      authorization.isOlympiadOrganiser.mockResolvedValue(true);

      const res = await request(app)
        .get('/api/analytics/rounds/round-1/schools/school-1')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.school.id).toBe('school-1');
    });
  });
});
