import { describe, it, expect } from 'vitest';
const { toUTCDate, formatInTimezone } = require('./timezone');

describe('toUTCDate', () => {
  it('converts a local time in Africa/Johannesburg (SAST, UTC+2) to UTC', () => {
    // 09:00 SAST = 07:00 UTC
    const result = toUTCDate('2026-06-15T09:00:00', 'Africa/Johannesburg');
    expect(result.getUTCHours()).toBe(7);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it('converts a local time in UTC to the same UTC time', () => {
    const result = toUTCDate('2026-06-15T09:00:00', 'UTC');
    expect(result.getUTCHours()).toBe(9);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it('converts a local time in America/New_York (EDT, UTC-4 in summer) to UTC', () => {
    // 09:00 EDT = 13:00 UTC
    const result = toUTCDate('2026-06-15T09:00:00', 'America/New_York');
    expect(result.getUTCHours()).toBe(13);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it('converts a local time in Asia/Kolkata (IST, UTC+5:30) to UTC', () => {
    // 09:00 IST = 03:30 UTC
    const result = toUTCDate('2026-06-15T09:00:00', 'Asia/Kolkata');
    expect(result.getUTCHours()).toBe(3);
    expect(result.getUTCMinutes()).toBe(30);
  });

  it('throws on invalid date string', () => {
    expect(() => toUTCDate('not-a-date', 'UTC')).toThrow('Invalid date string');
  });
});

describe('formatInTimezone', () => {
  it('formats a UTC date in Africa/Johannesburg timezone', () => {
    const utcDate = new Date('2026-06-15T07:00:00Z');
    const result = formatInTimezone(utcDate, 'Africa/Johannesburg');
    // 07:00 UTC = 09:00 SAST
    expect(result).toContain('09:00');
  });

  it('formats a UTC date in UTC timezone', () => {
    const utcDate = new Date('2026-06-15T07:30:00Z');
    const result = formatInTimezone(utcDate, 'UTC');
    expect(result).toContain('07:30');
  });

  it('accepts an ISO string input', () => {
    const result = formatInTimezone('2026-06-15T07:00:00Z', 'UTC');
    expect(result).toContain('07:00');
  });

  it('throws on invalid date', () => {
    expect(() => formatInTimezone('not-a-date', 'UTC')).toThrow('Invalid date');
  });
});
