/**
 * Shared options for Prisma's interactive $transaction() calls.
 *
 * Prisma's defaults are quite tight for a real production database under
 * concurrent load: maxWait (how long to wait for a free connection before
 * giving up) defaults to 2000ms, and timeout (how long the whole
 * transaction may run once started) defaults to 5000ms. Under a burst of
 * simultaneous requests each needing their own transaction - exactly the
 * scenario in loadtest/round-boundary-submissions.js - the connection
 * pool can be briefly exhausted, and the default maxWait isn't always
 * enough time to wait for a connection to free up, causing a P2028 error
 * ("Unable to start a transaction in the given time") even though the
 * database itself isn't actually overloaded, just momentarily busy.
 *
 * These more generous values trade a bit of worst-case latency for
 * reliability: a request under contention waits longer for a connection
 * instead of failing outright. This does not fix a fundamentally
 * undersized connection pool - if requests are consistently queuing this
 * long, the actual connection_limit/pool_timeout on DATABASE_URL (or the
 * database's own pooler configuration) needs increasing too. Re-run
 * loadtest/round-boundary-submissions.js at increasing --concurrency
 * values after any pool-size change to confirm it actually helped.
 */
const TRANSACTION_OPTIONS = {
  maxWait: 10000, // wait up to 10s for a free connection (default: 2000ms)
  timeout: 15000, // allow up to 15s for the transaction to complete (default: 5000ms)
};

module.exports = { TRANSACTION_OPTIONS };
