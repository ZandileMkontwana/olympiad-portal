import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const cron = require('node-cron');
const prisma = require('./lib/prisma');
const { startScheduler } = require('./scheduler');

describe('startScheduler', () => {
  let scheduledCallback;

  beforeEach(() => {
    vi.spyOn(cron, 'schedule').mockImplementation((expr, fn) => {
      scheduledCallback = fn;
    });
    vi.spyOn(prisma.round, 'updateMany');
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
});
