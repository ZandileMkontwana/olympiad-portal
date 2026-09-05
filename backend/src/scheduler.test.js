import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const cron = require('node-cron');
const sgMail = require('@sendgrid/mail');
const prisma = require('./lib/prisma');
const { startScheduler } = require('./scheduler');

describe('startScheduler', () => {
  let scheduledCallback;

  beforeEach(() => {
    vi.spyOn(cron, 'schedule').mockImplementation((expr, fn) => {
      scheduledCallback = fn;
    });
    vi.spyOn(prisma.round, 'updateMany');
    vi.spyOn(prisma.round, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.notificationLog, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.notificationLog, 'create').mockResolvedValue({ id: 'log-1' });
    vi.spyOn(sgMail, 'send').mockResolvedValue({});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls cron.schedule with a cron expression and callback', () => {
    startScheduler();
    expect(cron.schedule).toHaveBeenCalledTimes(1);
    expect(typeof cron.schedule.mock.calls[0][1]).toBe('function');
  });

  it('logs a startup message', () => {
    startScheduler();
    expect(console.log).toHaveBeenCalledWith('Round scheduler started — ticking every 30s');
  });

  it('scheduled function opens rounds whose openTime has passed', async () => {
    startScheduler();
    prisma.round.updateMany.mockResolvedValueOnce({ count: 3 }).mockResolvedValueOnce({ count: 0 });

    await scheduledCallback();

    expect(prisma.round.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.round.updateMany).toHaveBeenNthCalledWith(1, {
      where: { state: 'scheduled', openTime: { lte: expect.any(Date) } },
      data: { state: 'open' },
    });
  });

  it('scheduled function closes rounds whose closeTime has passed', async () => {
    startScheduler();
    prisma.round.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 2 });

    await scheduledCallback();

    expect(prisma.round.updateMany).toHaveBeenNthCalledWith(2, {
      where: { state: 'open', closeTime: { lte: expect.any(Date) } },
      data: { state: 'closed' },
    });
  });

  it('logs opened count when rounds are opened', async () => {
    startScheduler();
    prisma.round.updateMany.mockResolvedValueOnce({ count: 5 }).mockResolvedValueOnce({ count: 0 });

    await scheduledCallback();

    const openedLogs = console.log.mock.calls.filter((c) => c[0]?.includes?.('Opened'));
    expect(openedLogs).toHaveLength(1);
    expect(openedLogs[0][0]).toContain('5');
  });

  it('logs closed count when rounds are closed', async () => {
    startScheduler();
    prisma.round.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 7 });

    await scheduledCallback();

    const closedLogs = console.log.mock.calls.filter((c) => c[0]?.includes?.('Closed'));
    expect(closedLogs).toHaveLength(1);
    expect(closedLogs[0][0]).toContain('7');
  });

  it('does not log opened/closed when counts are zero', async () => {
    startScheduler();
    prisma.round.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });

    await scheduledCallback();

    const openedLogs = console.log.mock.calls.filter((c) => c[0]?.includes?.('Opened'));
    const closedLogs = console.log.mock.calls.filter((c) => c[0]?.includes?.('Closed'));
    expect(openedLogs).toHaveLength(0);
    expect(closedLogs).toHaveLength(0);
  });

  describe('before-open reminder emails', () => {
    // Two entrants from the same school — their shared educator should only
    // get one reminder email.
    const upcomingRound = () => ({
      id: 'round-1',
      name: 'Round One',
      openTime: new Date(Date.now() + 30 * 60 * 1000),
      roundEntrants: [
        {
          entrant: {
            school: {
              educators: [{ user: { email: 'educator@school.com' } }],
            },
          },
        },
        {
          entrant: {
            school: {
              educators: [{ user: { email: 'educator@school.com' } }],
            },
          },
        },
      ],
    });

    it('queries rounds opening within the next hour', async () => {
      startScheduler();
      prisma.round.updateMany.mockResolvedValue({ count: 0 });

      await scheduledCallback();

      expect(prisma.round.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            state: 'scheduled',
            openTime: { gte: expect.any(Date), lte: expect.any(Date) },
          },
        })
      );
    });

    it('sends one reminder per unique educator email and logs it as before_open', async () => {
      startScheduler();
      prisma.round.updateMany.mockResolvedValue({ count: 0 });
      prisma.round.findMany.mockResolvedValueOnce([upcomingRound()]);
      prisma.notificationLog.findUnique.mockResolvedValue(null);

      await scheduledCallback();

      expect(sgMail.send).toHaveBeenCalledTimes(1);
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'educator@school.com', subject: 'Round One opens soon' })
      );
      expect(prisma.notificationLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: {
          roundId: 'round-1',
          entrantId: null,
          triggerType: 'before_open',
          recipientEmail: 'educator@school.com',
          status: 'sent',
        },
      });
    });

    it('skips educators who were already notified for the round', async () => {
      startScheduler();
      prisma.round.updateMany.mockResolvedValue({ count: 0 });
      prisma.round.findMany.mockResolvedValueOnce([upcomingRound()]);
      prisma.notificationLog.findUnique.mockResolvedValue({ id: 'existing-log' });

      await scheduledCallback();

      expect(prisma.notificationLog.findUnique).toHaveBeenCalledWith({
        where: {
          roundId_triggerType_recipientEmail: {
            roundId: 'round-1',
            triggerType: 'before_open',
            recipientEmail: 'educator@school.com',
          },
        },
      });
      expect(sgMail.send).not.toHaveBeenCalled();
      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });

    it('sends nothing when no rounds are upcoming', async () => {
      startScheduler();
      prisma.round.updateMany.mockResolvedValue({ count: 0 });

      await scheduledCallback();

      expect(sgMail.send).not.toHaveBeenCalled();
      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });
  });
});
