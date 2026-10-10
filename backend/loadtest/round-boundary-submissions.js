/**
 * Load test for #196: simulates many simultaneous submissions arriving
 * around a round's close boundary, to prove the fixes from #194/#195
 * (transaction-wrapped round-state re-check, atomic Submission+Result
 * creation) actually hold under real concurrent load against a real
 * database - not just in mocked unit tests.
 *
 * This hits the real submissions route in-process via supertest (so
 * concurrency is exercised at the real Node event-loop + database
 * connection-pool level), with a fake auth middleware standing in for
 * Clerk (the same pattern the unit tests use) - but WITHOUT mocking
 * Prisma. Every request goes to your actual configured DATABASE_URL.
 *
 * IMPORTANT: this creates and deletes its own test data (prefixed
 * "LOADTEST-"), but it writes to whatever database DATABASE_URL in your
 * .env currently points to. Run this against a dev/staging database.
 * Never run it against production. Every run first sweeps stale LOADTEST-
 * rows left by a previously crashed run (see helpers.js), and cleanup runs
 * even when a scenario fails mid-way. 503 responses (pool-exhaustion
 * contract, #202) are retried per Retry-After, not counted as failures.
 *
 * Usage: npm run loadtest:submissions
 */

const express = require('express');
const prisma = require('../src/lib/prisma');
const submissionsRouter = require('../src/routes/submissions');
const { isDbBusyError, respondDbBusy } = require('../src/lib/dbErrors');
const { createEntrants, sweepStaleLoadtestData, postWithRetry, retryStats } = require('./helpers');

const CONCURRENT_ENTRANTS = Number(
  process.argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] || 50
);
// The close-time boundary is simulated by the state flip in scenario 3, so
// closeTime itself just needs to sit far enough out that the deployed
// scheduler's 30s tick never closes the round while scenarios 1-2 run.
const ROUND_DURATION_MS = 120000;
const DUPLICATE_KEY_RACERS = 20; // concurrent requests sharing one idempotencyKey

function fakeAuthApp(clerkUserId) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = () => ({ userId: clerkUserId });
    next();
  });
  app.use('/api', submissionsRouter);
  // Mirror the production global error handler (src/index.js): Prisma
  // pool-exhaustion thrown by pre-try route queries (e.g. the round lookup)
  // must surface as the 503 + Retry-After busy contract, not a raw 500 —
  // otherwise the harness measures a stack the deployment never runs.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (isDbBusyError(err)) {
      return respondDbBusy(req, res, err);
    }
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });
  return app;
}

async function setup() {
  const olympiad = await prisma.olympiad.create({
    data: { name: 'LOADTEST-Olympiad', timezone: 'UTC' },
  });

  const now = new Date();
  const round = await prisma.round.create({
    data: {
      olympiadId: olympiad.id,
      name: 'LOADTEST-Round',
      openTime: new Date(now.getTime() - 60_000),
      closeTime: new Date(now.getTime() + ROUND_DURATION_MS),
      state: 'open',
    },
  });

  const school = await prisma.school.create({
    data: { name: 'LOADTEST-School', timezone: 'UTC' },
  });

  const clerkUserId = `loadtest-clerk-${Date.now()}`;
  const user = await prisma.user.create({
    data: {
      clerkUserId,
      email: `loadtest-${Date.now()}@example.com`,
      role: 'educator',
      name: 'LOADTEST Educator',
    },
  });

  await prisma.educator.create({
    data: { userId: user.id, schoolId: school.id },
  });

  // The submissions route checks approved SchoolOlympiad access before
  // accepting anything — without this row every scenario request would
  // 403 at the access gate before exercising the concurrency under test.
  await prisma.schoolOlympiad.create({
    data: {
      schoolId: school.id,
      olympiadId: olympiad.id,
      status: 'approved',
    },
  });

  // Batched createMany via helpers, not N parallel creates: the Supabase
  // pooler allows ~5 concurrent connections and parallel setup queries
  // exhaust it (P2024) before any scenario even runs.
  const entrants = await createEntrants(school.id, CONCURRENT_ENTRANTS);

  return { olympiad, round, school, user, clerkUserId, entrants };
}

async function cleanup({ olympiad, round, school, user, entrants }) {
  // SchoolOlympiad row from setup (unique on schoolId+olympiadId).
  await prisma.schoolOlympiad.deleteMany({
    where: { schoolId: school.id, olympiadId: olympiad.id },
  });
  const submissions = await prisma.submission.findMany({
    where: { roundId: round.id },
    select: { id: true },
  });
  const submissionIds = submissions.map((s) => s.id);
  const entrantIds = entrants.map((e) => e.id);

  // Delete children before parents to satisfy FK constraints.
  await prisma.markingTask.deleteMany({ where: { submissionId: { in: submissionIds } } });
  await prisma.result.deleteMany({ where: { submissionId: { in: submissionIds } } });
  await prisma.submission.deleteMany({ where: { roundId: round.id } });
  await prisma.roundEntrant.deleteMany({ where: { roundId: round.id } });
  await prisma.entrant.deleteMany({ where: { id: { in: entrantIds } } });
  await prisma.educator.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.school.delete({ where: { id: school.id } });
  await prisma.round.delete({ where: { id: round.id } });
  await prisma.olympiad.delete({ where: { id: olympiad.id } });
}

function statusCounts(results) {
  const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value.status : 'ERROR'));
  return statuses.reduce((acc, s) => {
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
}

async function main() {
  const failures = [];

  // Remove rows a previously crashed run left behind, then set up fresh.
  await sweepStaleLoadtestData();

  console.log(
    `Setting up LOADTEST data (boundary handled by state flip; closeTime ${ROUND_DURATION_MS / 1000}s out)...`
  );
  const ctx = await setup();
  const app = fakeAuthApp(ctx.clerkUserId);

  try {
    // --- Scenario 1: many different entrants submitting concurrently ---
    console.log(`\n[1] Firing ${CONCURRENT_ENTRANTS} concurrent submissions (one per entrant)...`);
    const startedAt = Date.now();
    const results = await Promise.allSettled(
      ctx.entrants.map((entrant, i) =>
        postWithRetry(app, `/api/rounds/${ctx.round.id}/submissions`, {
          entrantId: entrant.id,
          answers: { q1: 'A' },
          idempotencyKey: `loadtest-${entrant.id}-${i}`,
        })
      )
    );
    console.log(
      `   Completed in ${Date.now() - startedAt}ms. Status counts:`,
      statusCounts(results)
    );
    const unexpected = results.filter((r) => r.status !== 'fulfilled' || r.value.status !== 201);
    if (unexpected.length > 0) {
      failures.push(
        `Scenario 1: expected all 201s, got ${unexpected.length} unexpected response(s).`
      );
    }

    // --- Scenario 2: same idempotencyKey fired concurrently (duplicate race) ---
    const raceEntrant = ctx.entrants[0];
    const sharedKey = `loadtest-race-${raceEntrant.id}`;
    console.log(
      `\n[2] Firing ${DUPLICATE_KEY_RACERS} concurrent requests sharing one idempotencyKey...`
    );
    await Promise.allSettled(
      Array.from({ length: DUPLICATE_KEY_RACERS }, () =>
        postWithRetry(app, `/api/rounds/${ctx.round.id}/submissions`, {
          entrantId: raceEntrant.id,
          answers: { q1: 'B' },
          idempotencyKey: sharedKey,
        })
      )
    );
    const submissionsForKey = await prisma.submission.findMany({
      where: { idempotencyKey: sharedKey },
    });
    if (submissionsForKey.length === 1) {
      console.log('   PASS: exactly one Submission exists for the shared idempotencyKey.');
    } else {
      const msg = `Scenario 2: expected exactly 1 Submission for the shared key, found ${submissionsForKey.length}.`;
      console.log(`   FAIL: ${msg}`);
      failures.push(msg);
    }

    // --- Scenario 3: submissions arriving right at/after the round closes ---
    // The close boundary is simulated by the state flip below (the routes
    // gate on state, not closeTime) — see the note in setup().
    console.log(
      `\n[3] Flipping the round to closed (boundary simulation), then firing ${CONCURRENT_ENTRANTS} concurrent submissions...`
    );
    await prisma.round.update({ where: { id: ctx.round.id }, data: { state: 'closed' } });
    const afterCloseResults = await Promise.allSettled(
      ctx.entrants.map((entrant, i) =>
        postWithRetry(app, `/api/rounds/${ctx.round.id}/submissions`, {
          entrantId: entrant.id,
          answers: { q1: 'A' },
          idempotencyKey: `loadtest-after-close-${entrant.id}-${i}`,
        })
      )
    );
    console.log('   Status counts:', statusCounts(afterCloseResults));
    const notRejected = afterCloseResults.filter(
      (r) => r.status !== 'fulfilled' || r.value.status !== 403
    );
    if (notRejected.length === 0) {
      console.log('   PASS: every post-close submission was correctly rejected with 403.');
    } else {
      const msg = `Scenario 3: expected all 403s after close, got ${notRejected.length} that were not.`;
      console.log(`   FAIL: ${msg}`);
      failures.push(msg);
    }

    // --- Atomicity check: no orphaned Submissions ---
    console.log('\n[4] Checking for orphaned Submissions (neither a Result nor a MarkingTask)...');
    const orphaned = await prisma.submission.findMany({
      where: { roundId: ctx.round.id, result: null, markingTask: null },
    });
    if (orphaned.length === 0) {
      console.log('   PASS: no orphaned Submissions found.');
    } else {
      const msg = `Scenario 4: found ${orphaned.length} orphaned Submission(s) with neither a Result nor a MarkingTask.`;
      console.log(`   FAIL: ${msg}`);
      failures.push(msg);
    }
  } finally {
    console.log('\nCleaning up LOADTEST data...');
    await cleanup(ctx);
  }

  console.log('\n' + '='.repeat(60));
  if (failures.length === 0) {
    console.log('ALL SCENARIOS PASSED');
  } else {
    console.log(`${failures.length} SCENARIO(S) FAILED:`);
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  }
  console.log(
    `503 busy-retries honoured: ${retryStats.retried} (abandoned: ${retryStats.exhausted})`
  );
  console.log('='.repeat(60));
}

main()
  .catch((err) => {
    console.error('Load test crashed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
