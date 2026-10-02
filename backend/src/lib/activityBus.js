/**
 * In-memory pub/sub hub for the real-time activity feed (US-4.1).
 *
 * The backend runs as a single long-lived Node process (the round scheduler
 * already relies on that), so a process-local listener set is all the feed
 * needs — no external message broker. A small ring buffer of recent events
 * lets every newly connected stream catch up instantly.
 */

const crypto = require('crypto');

const MAX_RECENT_EVENTS = 50;

const recentEvents = [];
const listeners = new Set();

/**
 * Publishes an activity event to every connected stream and remembers it in
 * the recent-events buffer. Never throws: a failing listener must not break
 * the request that triggered the broadcast.
 *
 * @param {{type: string, message: string, olympiadId?: string, roundId?: string, schoolId?: string}} event
 * @returns the enriched event that was published
 */
function broadcast(event) {
  const enriched = {
    id: crypto.randomUUID(),
    type: event.type,
    message: event.message,
    olympiadId: event.olympiadId || null,
    roundId: event.roundId || null,
    schoolId: event.schoolId || null,
    createdAt: new Date().toISOString(),
  };

  recentEvents.push(enriched);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_RECENT_EVENTS);
  }

  for (const listener of listeners) {
    try {
      listener(enriched);
    } catch (err) {
      console.error('Activity feed listener failed:', err);
    }
  }

  return enriched;
}

/**
 * Registers a stream listener. Returns an unsubscribe function that is safe
 * to call more than once.
 */
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Newest-first snapshot of the buffered recent events.
 */
function recent(limit = 20) {
  return recentEvents.slice(-limit).reverse();
}

/** Number of live listeners — used by tests to assert cleanup. */
function listenerCount() {
  return listeners.size;
}

/** Clears all buffered events and listeners — used by tests. */
function reset() {
  recentEvents.length = 0;
  listeners.clear();
}

module.exports = { broadcast, subscribe, recent, listenerCount, reset };
