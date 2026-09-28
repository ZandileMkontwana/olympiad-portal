import { describe, it, expect, vi, afterEach } from 'vitest';
const { isDbBusyError, respondDbBusy } = require('./dbErrors');

function fakeRes() {
  const res = {};
  res.set = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('isDbBusyError', () => {
  it('recognises pool timeout (P2024) and transaction start timeout (P2028)', () => {
    expect(isDbBusyError({ code: 'P2024' })).toBe(true);
    expect(isDbBusyError({ code: 'P2028' })).toBe(true);
  });

  it('does not treat other errors as "busy"', () => {
    expect(isDbBusyError({ code: 'P2002' })).toBe(false);
    expect(isDbBusyError(new Error('boom'))).toBe(false);
    expect(isDbBusyError(null)).toBe(false);
    expect(isDbBusyError(undefined)).toBe(false);
  });
});

describe('respondDbBusy', () => {
  afterEach(() => vi.restoreAllMocks());

  it('answers 503 with Retry-After and a retryable JSON body', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = fakeRes();
    const req = { method: 'POST', originalUrl: '/api/rounds/1/sittings' };

    respondDbBusy(req, res, { code: 'P2024' });

    expect(res.set).toHaveBeenCalledWith('Retry-After', '2');
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ retryable: true, error: expect.any(String) })
    );
  });
});
