/**
 * Shared helpers for the boundary load-test scripts (loadtest/).
 *
 * The Supabase session pooler caps this project at ~5 backend
 * connections, which drives every design decision here:
 *   - setup must never fire dozens of parallel Prisma queries (P2024);
 *   - concurrency-50 scenarios deliberately exceed the pool, so requests
 *     surface the 503 + Retry-After contract from lib/dbErrors.js (#202)
 *     and are retried instead of counting as scenario failures;
 *   - runs target the shared development database, so every run sweeps
 *     leftovers from previously crashed runs before starting.
 */
const request = require('supertest');
const prisma = require('../src/lib/prisma');

const RETRY_AFTER_DEFAULT_MS = 2000;
const MAX_RETRIES = 5;

// Process-wide counters so the scripts can report how often the busy
// contract was exercised during a run.
const retryStats = { retried: 0, exhausted: 0 };

/**
 * Creates N entrants for a school in small sequential batches. One
 * createMany per batch is a single pooled query — unlike N parallel
 * prisma.entrant.create() calls, which exhaust the pooler (P2024) before
 * any scenario even runs (the crash that killed the original setups).
 */
async function createEntrants(schoolId, count, batchSize = 10) {
  for (let start = 0; start < count; start += batchSize) {
    const size = Math.min(batchSize, count - start);
    await prisma.entrant.createMany({
      data: Array.from({ length: size }, (_, i) => ({
        schoolId,
        name: `LOADTEST Entrant ${start + i}`,
        grade: '10',
      })),
    });
  }
  // createMany returns only a count, so read the rows back. The school was
  // created moments ago in the same setup, so every row found belongs to
  // this run.
  return prisma.entrant.findMany({ where: { schoolId } });
}

/**
 * Deletes LOADTEST- rows left behind by a previously crashed run. A
 * scenario crash is covered by each script's finally-cleanup, but a crash
 * inside setup() itself cannot be — hence this pre-flight sweep. It also
 * removes rows referencing LOADTEST entrants from OTHER rounds: the
 * deployed scheduler's auto-registration once added them to any open
 * round on the shared database. Safe to run before every test: it only
 * touches rows the boundary scripts create.
 */
async function sweepStaleLoadtestData() {
  const schools = await prisma.school.findMany({
    where: { name: { startsWith: 'LOADTEST-' } },
    select: { id: true },
  });
  const rounds = await prisma.round.findMany({
    where: { name: { startsWith: 'LOADTEST-' } },
    select: { id: true },
  });
  const olympiads = await prisma.olympiad.findMany({
    where: { name: { startsWith: 'LOADTEST-' } },
    select: { id: true },
  });
  const users = await prisma.user.findMany({
    where: { name: 'LOADTEST Educator' },
    select: { id: true },
  });

  if (schools.length + rounds.length + olympiads.length + users.length === 0) return;

  const schoolIds = schools.map((s) => s.id);
  const roundIds = rounds.map((r) => r.id);
  const olympiadIds = olympiads.map((o) => o.id);
  const entrants = await prisma.entrant.findMany({
    where: { schoolId: { in: schoolIds } },
    select: { id: true },
  });
  const entrantIds = entrants.map((e) => e.id);

  if (entrantIds.length) {
    await prisma.roundEntrant.deleteMany({ where: { entrantId: { in: entrantIds } } });
    await prisma.notificationLog.deleteMany({ where: { entrantId: { in: entrantIds } } });
    await prisma.sitting.deleteMany({ where: { entrantId: { in: entrantIds } } });
    const submissions = await prisma.submission.findMany({
      where: { entrantId: { in: entrantIds } },
      select: { id: true },
    });
    if (submissions.length) {
      const submissionIds = submissions.map((s) => s.id);
      await prisma.remarkRequest.deleteMany({ where: { submissionId: { in: submissionIds } } });
      await prisma.markingTask.deleteMany({ where: { submissionId: { in: submissionIds } } });
      await prisma.result.deleteMany({ where: { submissionId: { in: submissionIds } } });
      await prisma.submission.deleteMany({ where: { id: { in: submissionIds } } });
    }
    await prisma.entrant.deleteMany({ where: { id: { in: entrantIds } } });
  }
  for (const user of users) {
    await prisma.educator.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  }
  if (roundIds.length) {
    // The deployed scheduler writes AuditLog/NotificationLog rows when it
    // opens/closes these rounds on the shared database.
    await prisma.auditLog.deleteMany({ where: { roundId: { in: roundIds } } });
    await prisma.notificationLog.deleteMany({ where: { roundId: { in: roundIds } } });
    await prisma.sitting.deleteMany({ where: { roundId: { in: roundIds } } });
    await prisma.roundEntrant.deleteMany({ where: { roundId: { in: roundIds } } });
    await prisma.submission.deleteMany({ where: { roundId: { in: roundIds } } });
    await prisma.paper.deleteMany({ where: { roundId: { in: roundIds } } });
  }
  if (olympiadIds.length) {
    await prisma.schoolOlympiad.deleteMany({ where: { olympiadId: { in: olympiadIds } } });
  }
  await prisma.round.deleteMany({ where: { id: { in: roundIds } } });
  await prisma.olympiad.deleteMany({ where: { id: { in: olympiadIds } } });
  await prisma.school.deleteMany({ where: { id: { in: schoolIds } } });

  console.log(
    `Swept stale LOADTEST data from a previous crashed run: ${olympiads.length} olympiad(s), ` +
      `${rounds.length} round(s), ${schools.length} school(s), ` +
      `${entrants.length} entrant(s), ${users.length} user(s)`
  );
}

/**
 * POSTs via supertest, retrying whenever the backend answers 503 (the
 * dbErrors.js pool-exhaustion contract: retryable + Retry-After). At
 * concurrency 50 the scenarios intentionally exceed the shared pooler's
 * ~5-connection budget, so honoring the retry contract is part of the
 * behaviour under test, not noise. Resolves with the final response; a
 * network-level failure after the last retry resolves with
 * { status: 'ERROR' } so callers' status-count logic keeps working.
 */
function postWithRetry(app, path, body) {
  return new Promise((resolve) => {
    const attempt = async (triesLeft) => {
      try {
        const response = await request(app).post(path).send(body);
        if (response.status === 503 && triesLeft > 0) {
          retryStats.retried += 1;
          const seconds = Number(response.headers['retry-after']);
          const delay =
            Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : RETRY_AFTER_DEFAULT_MS;
          setTimeout(() => attempt(triesLeft - 1), delay);
          return;
        }
        if (response.status === 503) retryStats.exhausted += 1;
        resolve(response);
      } catch (err) {
        if (triesLeft > 0) {
          retryStats.retried += 1;
          setTimeout(() => attempt(triesLeft - 1), RETRY_AFTER_DEFAULT_MS);
          return;
        }
        resolve({ status: 'ERROR', error: err.message });
      }
    };
    attempt(MAX_RETRIES);
  });
}

module.exports = { createEntrants, sweepStaleLoadtestData, postWithRetry, retryStats };
