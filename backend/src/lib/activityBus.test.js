import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
const activityBus = require('./activityBus');

describe('activityBus', () => {
  beforeEach(() => {
    activityBus.reset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enriches broadcast events with an id and createdAt timestamp', () => {
    const event = activityBus.broadcast({ type: 'test_type', message: 'hello' });

    expect(event.id).toEqual(expect.any(String));
    expect(event.createdAt).toEqual(expect.any(String));
    expect(new Date(event.createdAt).getTime()).not.toBeNaN();
    expect(event.type).toBe('test_type');
    expect(event.message).toBe('hello');
    expect(event.olympiadId).toBeNull();
    expect(event.roundId).toBeNull();
    expect(event.schoolId).toBeNull();
  });

  it('delivers events to every subscriber and honors unsubscribe', () => {
    const seenA = [];
    const seenB = [];
    const stopA = activityBus.subscribe((event) => seenA.push(event));
    activityBus.subscribe((event) => seenB.push(event));

    activityBus.broadcast({ type: 'round_opened', message: 'R1 open' });

    expect(seenA).toHaveLength(1);
    expect(seenB).toHaveLength(1);
    expect(seenA[0].message).toBe('R1 open');
    expect(activityBus.listenerCount()).toBe(2);

    stopA();
    stopA(); // unsubscribing twice is safe
    expect(activityBus.listenerCount()).toBe(1);

    activityBus.broadcast({ type: 'round_opened', message: 'R2 open' });
    expect(seenA).toHaveLength(1);
    expect(seenB).toHaveLength(2);
  });

  it('keeps a newest-first recent buffer capped at 50 events', () => {
    for (let i = 1; i <= 55; i++) {
      activityBus.broadcast({ type: 'tick', message: `event ${i}` });
    }

    const recent = activityBus.recent(100);
    expect(recent).toHaveLength(50);
    expect(recent[0].message).toBe('event 55');
    expect(recent[49].message).toBe('event 6');
    // The default limit is 20
    expect(activityBus.recent()).toHaveLength(20);
    expect(activityBus.recent(2)[0].message).toBe('event 55');
  });

  it('keeps broadcasting when a listener throws', () => {
    activityBus.subscribe(() => {
      throw new Error('listener exploded');
    });
    const seen = [];
    activityBus.subscribe((event) => seen.push(event));

    expect(() => activityBus.broadcast({ type: 'tick', message: 'still works' })).not.toThrow();
    expect(seen).toHaveLength(1);
  });
});
