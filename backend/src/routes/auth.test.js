import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const authRouter = require('./auth');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', authRouter);
  return app;
}

describe('Auth routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(jwt, 'verify');
    vi.spyOn(jwt, 'sign');
    vi.spyOn(bcrypt, 'hash');
    vi.spyOn(bcrypt, 'compare');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.user, 'create');
    vi.spyOn(prisma.user, 'update');
    vi.spyOn(prisma.user, 'delete');
    vi.spyOn(prisma.school, 'findFirst');
    vi.spyOn(prisma.school, 'create');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('returns 400 when fields are missing', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it('returns 409 when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'a@b.com' });
      const res = await request(app).post('/api/auth/register').send({
        email: 'a@b.com',
        password: 'pass123',
        name: 'Test',
        schoolName: 'Test School',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/);
    });

    it('creates a user with existing school and returns 201', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.school.findFirst.mockResolvedValue({ id: 'school-1', name: 'Test School' });
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        role: 'educator',
        name: 'Test',
        educator: { school: { name: 'Test School' } },
      });
      bcrypt.hash.mockResolvedValue('hashed-pw');
      jwt.sign.mockReturnValue('mock-token');

      const res = await request(app).post('/api/auth/register').send({
        email: 'a@b.com',
        password: 'pass123',
        name: 'Test',
        schoolName: 'Test School',
      });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('a@b.com');
      expect(res.body.user.role).toBe('educator');
      expect(res.headers['set-cookie']).toBeDefined();
      expect(prisma.school.create).not.toHaveBeenCalled();
    });

    it('creates school when it does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.school.findFirst.mockResolvedValue(null);
      prisma.school.create.mockResolvedValue({ id: 'school-2', name: 'New School' });
      prisma.user.create.mockResolvedValue({
        id: 'user-2',
        email: 'b@b.com',
        role: 'educator',
        name: 'Test2',
        educator: { school: { name: 'New School' } },
      });
      bcrypt.hash.mockResolvedValue('hashed-pw');
      jwt.sign.mockReturnValue('mock-token');

      const res = await request(app).post('/api/auth/register').send({
        email: 'b@b.com',
        password: 'pass123',
        name: 'Test2',
        schoolName: 'New School',
      });

      expect(res.status).toBe(201);
      expect(prisma.school.create).toHaveBeenCalledWith({
        data: { name: 'New School', timezone: 'Africa/Johannesburg' },
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 400 when fields are missing', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
      expect(res.status).toBe(400);
    });

    it('returns 401 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app).post('/api/auth/login').send({
        email: 'nobody@b.com',
        password: 'pass123',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('returns 401 when password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        passwordHash: 'hashed',
        role: 'educator',
      });
      bcrypt.compare.mockResolvedValue(false);
      const res = await request(app).post('/api/auth/login').send({
        email: 'a@b.com',
        password: 'wrong',
      });
      expect(res.status).toBe(401);
    });

    it('returns 200 with token cookie on success', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        passwordHash: 'hashed',
        role: 'educator',
      });
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock-token');

      const res = await request(app).post('/api/auth/login').send({
        email: 'a@b.com',
        password: 'pass123',
      });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('a@b.com');
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({});
      expect(res.status).toBe(401);
    });

    it('returns 400 when fields are missing', async () => {
      jwt.verify.mockReturnValue({ userId: '1', role: 'educator' });
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', 'token=valid')
        .send({ currentPassword: 'old' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when user not found', async () => {
      jwt.verify.mockReturnValue({ userId: '1', role: 'educator' });
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', 'token=valid')
        .send({ currentPassword: 'old', newPassword: 'new' });
      expect(res.status).toBe(404);
    });

    it('returns 401 when current password is wrong', async () => {
      jwt.verify.mockReturnValue({ userId: '1', role: 'educator' });
      prisma.user.findUnique.mockResolvedValue({ id: '1', passwordHash: 'hashed' });
      bcrypt.compare.mockResolvedValue(false);
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', 'token=valid')
        .send({ currentPassword: 'wrong', newPassword: 'new' });
      expect(res.status).toBe(401);
    });

    it('updates password and returns 200', async () => {
      jwt.verify.mockReturnValue({ userId: '1', role: 'educator' });
      prisma.user.findUnique.mockResolvedValue({ id: '1', passwordHash: 'hashed' });
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('new-hash');
      prisma.user.update.mockResolvedValue({});

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', 'token=valid')
        .send({ currentPassword: 'old', newPassword: 'new' });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { passwordHash: 'new-hash' },
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears cookie and returns 200', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Logged out/);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 404 when user not found', async () => {
      jwt.verify.mockReturnValue({ userId: '1', role: 'educator' });
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app).get('/api/auth/me').set('Cookie', 'token=valid');
      expect(res.status).toBe(404);
    });

    it('returns user on success', async () => {
      jwt.verify.mockReturnValue({ userId: '1', role: 'educator' });
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        role: 'educator',
      });
      const res = await request(app).get('/api/auth/me').set('Cookie', 'token=valid');
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('a@b.com');
    });
  });

  describe('DELETE /api/auth/account', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).delete('/api/auth/account');
      expect(res.status).toBe(401);
    });

    it('returns 404 when user not found', async () => {
      jwt.verify.mockReturnValue({ userId: '1', role: 'educator' });
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app).delete('/api/auth/account').set('Cookie', 'token=valid');
      expect(res.status).toBe(404);
    });

    it('deletes user and returns 200', async () => {
      jwt.verify.mockReturnValue({ userId: '1', role: 'educator' });
      prisma.user.findUnique.mockResolvedValue({ id: '1' });
      prisma.user.delete.mockResolvedValue({});

      const res = await request(app).delete('/api/auth/account').set('Cookie', 'token=valid');
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });
});
