import { describe, it, expect, vi, afterEach } from 'vitest';
const prisma = require('./prisma');
const { getDbNow } = require('./dbTime');

describe('getDbNow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('queries the database for its own current timestamp via SELECT NOW()', async () => {
    const dbTimestamp = new Date('2026-06-15T12:00:00.000Z');
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ now: dbTimestamp }]);

    const result = await getDbNow();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual(dbTimestamp);
  });

  it('returns exactly what the database reports, not the app server clock', async () => {
    // A timestamp deliberately different from "real now" to prove this
    // isn't silently falling back to new Date() anywhere.
    const dbTimestamp = new Date('2099-01-01T00:00:00.000Z');
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ now: dbTimestamp }]);

    const result = await getDbNow();

    expect(result).toEqual(dbTimestamp);
  });
});
