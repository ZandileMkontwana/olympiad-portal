const prisma = require('./prisma');

/**
 * Returns the database server's own current timestamp, rather than the
 * app server's local clock (`new Date()` / `Date.now()`).
 *
 * Why this matters: every time-boundary decision in this app (has a round
 * opened/closed yet? has a sitting expired?) is ultimately checked against
 * timestamp columns stored in Postgres. If the app server's clock drifts
 * even slightly from the database server's clock (different machines,
 * container restarts, NTP sync delay, etc.), comparisons made using the
 * app server's `new Date()` can disagree with what the database itself
 * would consider "now" - opening a round a few seconds early, or letting
 * a sitting be resumed a few seconds after it should have expired.
 *
 * Using the database's own clock for these comparisons removes that class
 * of bug entirely: the same source of truth (Postgres) both stores the
 * boundary timestamps and defines what "now" means when comparing against
 * them.
 */
async function getDbNow() {
  const [{ now }] = await prisma.$queryRaw`SELECT NOW() as now`;
  return now;
}

module.exports = { getDbNow };
