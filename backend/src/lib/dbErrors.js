/**
 * Maps database connection-pool exhaustion to a proper "busy, retry" response.
 *
 * Under a burst of simultaneous requests (e.g. many students starting a
 * sitting the moment a round opens) Prisma can run out of connections:
 *   P2024 - timed out fetching a connection from the pool
 *   P2028 - unable to start (or keep open) an interactive transaction in time
 *
 * These are capacity problems, not bugs in the request. The transaction is
 * rolled back, so nothing is half-written, and the routes are safe to retry
 * (sitting start is an upsert, submissions carry an idempotencyKey). Returning
 * 503 + Retry-After tells the client to retry, instead of a generic 500.
 */

const POOL_ERROR_CODES = new Set(['P2024', 'P2028']);

function isDbBusyError(err) {
  return Boolean(err && POOL_ERROR_CODES.has(err.code));
}

function respondDbBusy(req, res, err) {
  // One short line instead of a full stack trace per failed request.
  console.warn(`[db-busy] ${err.code} on ${req.method} ${req.originalUrl}`);
  res.set('Retry-After', '2');
  return res.status(503).json({
    error: 'The server is busy right now. Please try again in a few seconds.',
    retryable: true,
  });
}

module.exports = { isDbBusyError, respondDbBusy };
