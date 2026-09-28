import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const sgMail = require('@sendgrid/mail');
const prisma = require('../lib/prisma');
const entrantsRouter = require('./entrants');

// Simulate Clerk's clerkMiddleware() having run: req.auth() returns the
// signed-in Clerk user. requireRole() (middleware/auth.js) then loads the
// matching database record to check the role and set req.user.
function createApp(authenticated = true) {
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req, _res, next) => {
      req.auth = () => ({ userId: 'clerk-user-1' });
      next();
    });
  }
  app.use('/api', entrantsRouter);
  return app;
}

describe('Entrants routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.user, 'create');
    vi.spyOn(prisma.user, 'update');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma.school, 'findUnique');
    vi.spyOn(prisma.entrant, 'create');
    vi.spyOn(prisma.entrant, 'findUnique');
    vi.spyOn(prisma.entrant, 'findMany');
    vi.spyOn(prisma.entrant, 'delete');
    vi.spyOn(prisma.user, 'delete');
    vi.spyOn(prisma.submission, 'findMany');
    vi.spyOn(prisma.submission, 'deleteMany');
    vi.spyOn(prisma.result, 'deleteMany');
    vi.spyOn(prisma.sitting, 'deleteMany');
    vi.spyOn(prisma.round, 'findMany');
    vi.spyOn(prisma.roundEntrant, 'createMany');
    vi.spyOn(prisma.roundEntrant, 'deleteMany');
    vi.spyOn(prisma.notificationLog, 'deleteMany');
    vi.spyOn(prisma.schoolOlympiad, 'findMany');
    vi.spyOn(prisma.schoolOlympiad, 'findUnique');
    vi.spyOn(prisma, '$transaction');
    vi.spyOn(sgMail, 'send').mockResolvedValue([{}]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Default: the school has approved access to olympiad-1, so the
    // auto-registration step can match open rounds of that olympiad.
    prisma.schoolOlympiad.findMany.mockResolvedValue([{ olympiadId: 'olympiad-1' }]);
    prisma.schoolOlympiad.findUnique.mockResolvedValue({
      schoolId: 'school-1',
      olympiadId: 'olympiad-1',
      status: 'approved',
    });
    // Default: the Clerk user maps to an educator linked to school-1
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.clerkUserId) {
        return Promise.resolve({
          id: 'user-1',
          email: 'teacher@school.com',
          role: 'educator',
          name: 'Teacher One',
        });
      }
      return Promise.resolve(null);
    });
    prisma.educator.findUnique.mockResolvedValue({
      id: 'educator-1',
      userId: 'user-1',
      schoolId: 'school-1',
    });
    prisma.school.findUnique.mockResolvedValue({ id: 'school-1', name: 'Test School' });
    prisma.user.create.mockResolvedValue({ id: 'user-2' });
    prisma.user.update.mockResolvedValue({ id: 'user-2' });
    // DELETE /entrants/:id cascade defaults — every spy needs a mocked value,
    // otherwise it calls through to the real Prisma client.
    prisma.submission.findMany.mockResolvedValue([]);
    prisma.result.deleteMany.mockResolvedValue({ count: 0 });
    prisma.submission.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sitting.deleteMany.mockResolvedValue({ count: 0 });
    prisma.roundEntrant.deleteMany.mockResolvedValue({ count: 0 });
    prisma.notificationLog.deleteMany.mockResolvedValue({ count: 0 });
    prisma.entrant.delete.mockResolvedValue({ id: 'entrant-1' });
    prisma.user.delete.mockResolvedValue({ id: 'user-2' });
    // Default $transaction: run the callback against the mocked prisma
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/entrants', () => {
    it('returns 401 when not authenticated (no Clerk session)', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp)
        .post('/api/entrants')
        .send({ name: 'Alice', email: 'alice@school.com', grade: '10', olympiadId: 'olympiad-1' });
      expect(res.status).toBe(401);
      expect(prisma.entrant.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the Clerk user has no database record', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/entrants')
        .send({ name: 'Alice', email: 'alice@school.com', grade: '10', olympiadId: 'olympiad-1' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });

    it('returns 403 when user is not an educator', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
      const res = await request(app)
        .post('/api/entrants')
        .send({ name: 'Alice', email: 'alice@school.com', grade: '10', olympiadId: 'olympiad-1' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('educator access required');
      expect(prisma.entrant.create).not.toHaveBeenCalled();
    });

    it('returns 400 when fields are missing', async () => {
      const res = await request(app)
        .post('/api/entrants')
        .send({ name: 'Alice', grade: '10', olympiadId: 'olympiad-1' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name, email and grade are required/);
    });

    it('returns 400 when olympiadId is missing', async () => {
      const res = await request(app)
        .post('/api/entrants')
        .send({ name: 'Alice', email: 'alice@school.com', grade: '10' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/olympiadId is required/);
    });

    it('returns 400 when the email is invalid', async () => {
      const res = await request(app)
        .post('/api/entrants')
        .send({ name: 'Alice', email: 'not-an-email', grade: '10', olympiadId: 'olympiad-1' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/valid email/);
      expect(prisma.entrant.create).not.toHaveBeenCalled();
    });

    it('returns 400 when the grade is not a whole number from 1 to 12', async () => {
      for (const grade of ['0', '13', 'ten', '1.5', '-3', '100', 'Grade 10']) {
        const res = await request(app)
          .post('/api/entrants')
          .send({ name: 'Alice', email: 'alice@school.com', grade, olympiadId: 'olympiad-1' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/grade must be a whole number from 1 to 12/);
      }
      expect(prisma.entrant.create).not.toHaveBeenCalled();
    });

    it('accepts every grade boundary from 1 to 12', async () => {
      prisma.entrant.create.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '12',
      });
      prisma.round.findMany.mockResolvedValue([]);

      for (const grade of ['1', '9', '10', '12', ' 11 ']) {
        const res = await request(app)
          .post('/api/entrants')
          .send({ name: 'Alice', email: 'alice@school.com', grade, olympiadId: 'olympiad-1' });
        expect(res.status).toBe(201);
      }
      // Whitespace is trimmed before storing
      expect(prisma.entrant.create).toHaveBeenLastCalledWith({
        data: { name: 'Alice', grade: '11', schoolId: 'school-1' },
      });
    });

    it('returns 403 when the account has no educator profile', async () => {
      prisma.educator.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/entrants')
        .send({ name: 'Alice', email: 'alice@school.com', grade: '10', olympiadId: 'olympiad-1' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/No school linked/);
      expect(prisma.entrant.create).not.toHaveBeenCalled();
    });

    it('returns 409 when a user with that email already exists', async () => {
      prisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.clerkUserId) {
          return Promise.resolve({
            id: 'user-1',
            role: 'educator',
            name: 'Teacher One',
          });
        }
        if (where.email) {
          return Promise.resolve({ id: 'user-2', email: where.email, role: 'student' });
        }
        return Promise.resolve(null);
      });

      const res = await request(app)
        .post('/api/entrants')
        .send({ name: 'Alice', email: 'taken@school.com', grade: '10', olympiadId: 'olympiad-1' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/);
      expect(prisma.entrant.create).not.toHaveBeenCalled();
    });

    it('creates the entrant + student account and returns 201', async () => {
      prisma.entrant.create.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.round.findMany.mockResolvedValue([]);
      const res = await request(app)
        .post('/api/entrants')
        .send({
          name: ' Alice ',
          email: 'Alice@School.com',
          grade: '10',
          olympiadId: 'olympiad-1',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Alice');
      expect(res.body.email).toBe('alice@school.com');
      expect(res.body.accountStatus).toBe('invite_pending');
      expect(res.body.invitationSent).toBe(true);
      expect(res.body.registeredRounds).toEqual([]);

      expect(prisma.entrant.create).toHaveBeenCalledWith({
        data: { name: 'Alice', grade: '10', schoolId: 'school-1' },
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'alice@school.com',
          role: 'student',
          name: 'Alice',
          invitationToken: expect.any(String),
          invitationExpiresAt: expect.any(Date),
          entrant: { connect: { id: 'entrant-1' } },
        }),
      });
      // Invitation email goes out via SendGrid
      expect(sgMail.send).toHaveBeenCalledTimes(1);
      const msg = sgMail.send.mock.calls[0][0];
      expect(msg.to).toBe('alice@school.com');
      expect(msg.subject).toMatch(/Set up your Olympiad Portal account/);
      expect(msg.html).toContain('Test School');
      // The link embeds the invitation token stored on the user
      const createdUser = prisma.user.create.mock.calls[0][0].data;
      expect(msg.html).toContain(createdUser.invitationToken);
    });

    it('still returns 201 when the invitation email fails to send', async () => {
      prisma.entrant.create.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.round.findMany.mockResolvedValue([]);
      sgMail.send.mockRejectedValue(new Error('SendGrid down'));

      const res = await request(app)
        .post('/api/entrants')
        .send({ name: 'Alice', email: 'alice@school.com', grade: '10', olympiadId: 'olympiad-1' });

      expect(res.status).toBe(201);
      expect(res.body.invitationSent).toBe(false);
    });

    it('auto-registers the new entrant for open rounds of the specified olympiad', async () => {
      prisma.entrant.create.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.round.findMany.mockResolvedValue([
        { id: 'round-1', name: 'Round One', olympiad: { name: 'Maths Olympiad' } },
        { id: 'round-2', name: 'Round Two', olympiad: { name: 'Science Olympiad' } },
      ]);
      prisma.roundEntrant.createMany.mockResolvedValue({ count: 2 });

      const res = await request(app)
        .post('/api/entrants')
        .send({ name: 'Alice', email: 'alice@school.com', grade: '10', olympiadId: 'olympiad-1' });

      expect(res.status).toBe(201);
      expect(res.body.registeredRounds).toEqual([
        { id: 'round-1', name: 'Round One', olympiadName: 'Maths Olympiad' },
        { id: 'round-2', name: 'Round Two', olympiadName: 'Science Olympiad' },
      ]);
      expect(prisma.schoolOlympiad.findUnique).toHaveBeenCalledWith({
        where: {
          schoolId_olympiadId: { schoolId: 'school-1', olympiadId: 'olympiad-1' },
        },
      });
      expect(prisma.round.findMany).toHaveBeenCalledWith({
        where: { state: 'open', olympiadId: 'olympiad-1' },
        select: {
          id: true,
          name: true,
          prerequisiteRoundId: true,
          qualifyingThreshold: true,
          olympiad: { select: { name: true } },
        },
      });
      expect(prisma.roundEntrant.createMany).toHaveBeenCalledWith({
        data: [
          { roundId: 'round-1', entrantId: 'entrant-1' },
          { roundId: 'round-2', entrantId: 'entrant-1' },
        ],
        skipDuplicates: true,
      });
    });

    it('returns 403 when the school does not have approved access to the olympiad', async () => {
      prisma.entrant.create.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.schoolOlympiad.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/entrants')
        .send({ name: 'Alice', email: 'alice@school.com', grade: '10', olympiadId: 'olympiad-99' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/doesn't have access/);
    });

    it('skips open rounds whose prerequisites the entrant has not met', async () => {
      prisma.entrant.create.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.round.findMany.mockResolvedValue([
        {
          id: 'round-1',
          name: 'Round One',
          prerequisiteRoundId: null,
          qualifyingThreshold: null,
          olympiad: { name: 'Maths Olympiad' },
        },
        {
          id: 'round-2',
          name: 'Round Two',
          prerequisiteRoundId: 'round-1',
          qualifyingThreshold: 50,
          olympiad: { name: 'Science Olympiad' },
        },
      ]);
      // The new entrant has no qualifying submission in round-1 yet
      prisma.submission.findMany.mockResolvedValue([]);
      prisma.roundEntrant.createMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .post('/api/entrants')
        .send({ name: 'Alice', email: 'alice@school.com', grade: '10', olympiadId: 'olympiad-1' });

      expect(res.status).toBe(201);
      expect(prisma.roundEntrant.createMany).toHaveBeenCalledWith({
        data: [{ roundId: 'round-1', entrantId: 'entrant-1' }],
        skipDuplicates: true,
      });
    });

    it('auto-registers for a gated round once the prerequisite has been passed', async () => {
      prisma.entrant.create.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.round.findMany.mockResolvedValue([
        {
          id: 'round-2',
          name: 'Round Two',
          prerequisiteRoundId: 'round-1',
          qualifyingThreshold: 50,
          olympiad: { name: 'Science Olympiad' },
        },
      ]);
      prisma.submission.findMany.mockResolvedValue([{ entrantId: 'entrant-1' }]);
      prisma.roundEntrant.createMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .post('/api/entrants')
        .send({ name: 'Alice', email: 'alice@school.com', grade: '10', olympiadId: 'olympiad-1' });

      expect(res.status).toBe(201);
      expect(prisma.roundEntrant.createMany).toHaveBeenCalledWith({
        data: [{ roundId: 'round-2', entrantId: 'entrant-1' }],
        skipDuplicates: true,
      });
    });

    it('returns 500 on unexpected error', async () => {
      prisma.entrant.create.mockRejectedValue(new Error('DB error'));
      const res = await request(app)
        .post('/api/entrants')
        .send({ name: 'Alice', email: 'alice@school.com', grade: '10', olympiadId: 'olympiad-1' });
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not create entrant/);
    });
  });

  describe('POST /api/entrants/:id/resend-invite', () => {
    it('returns 404 when the entrant is not at the educator school', async () => {
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-9',
        schoolId: 'school-99',
        name: 'Elsewhere',
      });
      const res = await request(app).post('/api/entrants/entrant-9/resend-invite');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found at your school/);
    });

    it('returns 400 when a legacy entrant has no user and no email given', async () => {
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Legacy',
        user: null,
        school: { name: 'Test School' },
      });
      const res = await request(app).post('/api/entrants/entrant-1/resend-invite');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/email is required/);
    });

    it('returns 409 when the given email already has an account', async () => {
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Legacy',
        user: null,
        school: { name: 'Test School' },
      });
      prisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.clerkUserId) {
          return Promise.resolve({ id: 'user-1', role: 'educator' });
        }
        return Promise.resolve({ id: 'user-2', email: where.email, role: 'student' });
      });

      const res = await request(app)
        .post('/api/entrants/entrant-1/resend-invite')
        .send({ email: 'taken@school.com' });

      expect(res.status).toBe(409);
    });

    it('creates an account for a legacy entrant and sends the invitation', async () => {
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Legacy',
        user: null,
        school: { name: 'Test School' },
      });

      const res = await request(app)
        .post('/api/entrants/entrant-1/resend-invite')
        .send({ email: 'legacy@school.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Invitation sent/);
      expect(res.body.invitationSent).toBe(true);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'legacy@school.com',
          role: 'student',
          name: 'Legacy',
          invitationToken: expect.any(String),
          entrant: { connect: { id: 'entrant-1' } },
        }),
      });
      expect(sgMail.send).toHaveBeenCalledTimes(1);
      expect(sgMail.send.mock.calls[0][0].to).toBe('legacy@school.com');
    });

    it('rolls a fresh token for an existing invite-pending student', async () => {
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Alice',
        user: { id: 'user-2', email: 'alice@school.com', passwordHash: null },
        school: { name: 'Test School' },
      });

      const res = await request(app).post('/api/entrants/entrant-1/resend-invite');

      expect(res.status).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: {
          invitationToken: expect.any(String),
          invitationExpiresAt: expect.any(Date),
        },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(sgMail.send).toHaveBeenCalledTimes(1);
    });

    it('returns 500 on unexpected error', async () => {
      prisma.entrant.findUnique.mockRejectedValue(new Error('DB error'));
      const res = await request(app).post('/api/entrants/entrant-1/resend-invite');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not resend/);
    });
  });

  describe('DELETE /api/entrants/:id', () => {
    it('returns 401 when not authenticated (no Clerk session)', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).delete('/api/entrants/entrant-1');
      expect(res.status).toBe(401);
      expect(prisma.entrant.delete).not.toHaveBeenCalled();
    });

    it('returns 403 when user is not an educator', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
      const res = await request(app).delete('/api/entrants/entrant-1');
      expect(res.status).toBe(403);
      expect(prisma.entrant.delete).not.toHaveBeenCalled();
    });

    it('returns 403 when the account has no educator profile', async () => {
      prisma.educator.findUnique.mockResolvedValue(null);
      const res = await request(app).delete('/api/entrants/entrant-1');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/No school linked/);
    });

    it('returns 404 when the entrant is not at the educator school', async () => {
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-9',
        schoolId: 'school-99',
        name: 'Elsewhere',
      });
      const res = await request(app).delete('/api/entrants/entrant-9');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found at your school/);
      expect(prisma.entrant.delete).not.toHaveBeenCalled();
    });

    it('removes the entrant, their account and all their records', async () => {
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Alice',
        user: { id: 'user-2' },
      });
      prisma.submission.findMany.mockResolvedValue([{ id: 'sub-1' }, { id: 'sub-2' }]);
      prisma.entrant.delete.mockResolvedValue({ id: 'entrant-1' });
      prisma.user.delete.mockResolvedValue({ id: 'user-2' });

      const res = await request(app).delete('/api/entrants/entrant-1');

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/removed/i);

      expect(prisma.result.deleteMany).toHaveBeenCalledWith({
        where: { submissionId: { in: ['sub-1', 'sub-2'] } },
      });
      expect(prisma.submission.deleteMany).toHaveBeenCalledWith({
        where: { entrantId: 'entrant-1' },
      });
      expect(prisma.sitting.deleteMany).toHaveBeenCalledWith({
        where: { entrantId: 'entrant-1' },
      });
      expect(prisma.roundEntrant.deleteMany).toHaveBeenCalledWith({
        where: { entrantId: 'entrant-1' },
      });
      expect(prisma.notificationLog.deleteMany).toHaveBeenCalledWith({
        where: { entrantId: 'entrant-1' },
      });
      expect(prisma.entrant.delete).toHaveBeenCalledWith({ where: { id: 'entrant-1' } });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-2' } });
    });

    it('skips result deletion when the entrant has no submissions', async () => {
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Alice',
        user: { id: 'user-2' },
      });
      prisma.submission.findMany.mockResolvedValue([]);

      const res = await request(app).delete('/api/entrants/entrant-1');

      expect(res.status).toBe(200);
      expect(prisma.result.deleteMany).not.toHaveBeenCalled();
      expect(prisma.submission.deleteMany).toHaveBeenCalledWith({
        where: { entrantId: 'entrant-1' },
      });
    });

    it('leaves users untouched for legacy entrants without an account', async () => {
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Legacy',
        user: null,
      });
      prisma.submission.findMany.mockResolvedValue([]);

      const res = await request(app).delete('/api/entrants/entrant-1');

      expect(res.status).toBe(200);
      expect(prisma.entrant.delete).toHaveBeenCalledWith({ where: { id: 'entrant-1' } });
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('returns 500 on unexpected error', async () => {
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Alice',
        user: { id: 'user-2' },
      });
      prisma.submission.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).delete('/api/entrants/entrant-1');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not remove/);
    });
  });

  describe('GET /api/entrants', () => {
    it('returns 401 when not authenticated (no Clerk session)', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).get('/api/entrants');
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not an educator', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
      const res = await request(app).get('/api/entrants');
      expect(res.status).toBe(403);
      expect(prisma.entrant.findMany).not.toHaveBeenCalled();
    });

    it('lists only the educator school entrants with account status', async () => {
      prisma.entrant.findMany.mockResolvedValue([
        {
          id: 'entrant-1',
          schoolId: 'school-1',
          name: 'Alice',
          grade: '10',
          user: { email: 'alice@school.com', passwordHash: 'hashed' },
        },
        { id: 'entrant-2', schoolId: 'school-1', name: 'Bob', grade: '11', user: null },
      ]);
      const res = await request(app).get('/api/entrants');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(prisma.entrant.findMany).toHaveBeenCalledWith({
        where: { schoolId: 'school-1' },
        orderBy: { name: 'asc' },
        include: { user: { select: { email: true, passwordHash: true } } },
      });
      expect(res.body[0]).toMatchObject({
        email: 'alice@school.com',
        accountStatus: 'active',
      });
      expect(res.body[1]).toMatchObject({ email: null, accountStatus: null });
      expect(res.body[0].user).toBeUndefined();
    });

    it('returns 403 when the account has no educator profile', async () => {
      prisma.educator.findUnique.mockResolvedValue(null);
      const res = await request(app).get('/api/entrants');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/No school linked/);
    });

    it('returns 500 on unexpected error', async () => {
      prisma.entrant.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/entrants');
      expect(res.status).toBe(500);
    });
  });
});
