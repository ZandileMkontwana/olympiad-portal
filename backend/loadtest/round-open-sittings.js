/**
 * Load test for #197: simulates many students simultaneously starting an
 * online sitting right at a round's open boundary, to prove the fixes
 * from #194/#195 (transaction-wrapped round-state re-check, atomic
 * RoundEntrant+Sitting creation) hold under real concurrent load against
 * a real database - not just in mocked unit tests.
 *
 * This hits the real sittings route in-process via supertest (so
 * concurrency is exercised at the real Node event-loop + database
 * connection-pool level), with a fake auth middleware standing in for a
 * signed-in session - but WITHOUT mocking Prisma. Every request goes to
 * your actual configured DATABASE_URL.
 *
 * IMPORTANT: this creates and deletes its own test data (prefixed
 * "LOADTEST-"), but it writes to whatever database DATABASE_URL in your
 * .env currently points to. Run this against a dev/staging database.
 * Never run it against production. Every run first sweeps stale LOADTEST-
 * rows left by a previously crashed run (see helpers.js), and cleanup runs
 * even when a scenario fails mid-way.
 *
 * Usage: npm run loadtest:sittings
 *        npm run loadtest:sittings -- --concurrency=10
 */

const express = require('express');
const prisma = require('../src/lib/prisma');
const sittingsRouter = require('../src/routes/sittings');
const { isDbBusyError, respondDbBusy } = require('../src/lib/dbErrors');
const { createEntrants, sweepStaleLoadtestData, postWithRetry, retryStats } = require('./helpers');

const CONCURRENT_ENTRANTS = Number(
  process.argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] || 50
);
// Pre-open window: wide enough that setup completes and any 503-retried
// request still lands while the round is 'scheduled'.
const ROUND_DELAY_MS = 20000;
const DOUBLE_CLICK_RACERS = 20; // concurrent "start test" requests from the SAME entrant

function fakeAuthApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // sittings.js's requireAuth only checks req.auth().userId is truthy -
    // it never loads a User row for this route (no requireRole here), so
    // no real User/Clerk setup is needed for this load test.
    req.auth = () => ({ userId: 'loadtest-clerk-user' });
    next();
  });
  app.use('/api', sittingsRouter);
  // Mirror the production global error handler (src/index.js) so Prisma
  // pool-exhaustion surfaces as the 503 + Retry-After busy contract even
  // when thrown by pre-try route queries — same stack the deployment runs.
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
      openTime: new Date(now.getTime() + ROUND_DELAY_MS),
      closeTime: new Date(now.getTime() + ROUND_DELAY_MS + 60 * 60 * 1000),
      state: 'scheduled',
    },
  });

  await prisma.paper.create({
    data: {
      roundId: round.id,
      fileUrl: 'https://example.com/loadtest-paper.pdf',
      memoUrl: 'https://example.com/loadtest-memo.pdf',
      memoAnswers: { 1: 'A', 2: 'B' },
    },
  });

  const school = await prisma.school.create({
    data: { name: 'LOADTEST-School', timezone: 'UTC' },
  });

  // Batched createMany via helpers, not N parallel creates: the Supabase
  // pooler allows ~5 concurrent connections and parallel setup queries
  // exhaust it (P2024) before any scenario even runs.
  const entrants = await createEntrants(school.id, CONCURRENT_ENTRANTS);

  return { olympiad, round, school, entrants };
}

async function cleanup({ olympiad, round, school, entrants }) {
  const entrantIds = entrants.map((e) => e.id);

  // Delete children before parents to satisfy FK constraints.
  await prisma.sitting.deleteMany({ where: { roundId: round.id } });
  await prisma.roundEntrant.deleteMany({ where: { roundId: round.id } });
  await prisma.entrant.deleteMany({ where: { id: { in: entrantIds } } });
  await prisma.paper.deleteMany({ where: { roundId: round.id } });
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

  console.log(`Setting up LOADTEST data (round opens in ${ROUND_DELAY_MS}ms)...`);
  const ctx = await setup();
  const app = fakeAuthApp();

  try {
    // --- Scenario 1: sitting-start attempts BEFORE the round has opened ---
    console.log(
      `\n[1] Firing ${CONCURRENT_ENTRANTS} concurrent sitting starts before the round opens...`
    );
    const beforeOpenResults = await Promise.allSettled(
      ctx.entrants.map((entrant) =>
        postWithRetry(app, `/api/rounds/${ctx.round.id}/sittings`, { entrantId: entrant.id })
      )
    );
    console.log('   Status counts:', statusCounts(beforeOpenResults));
    const notRejected = beforeOpenResults.filter(
      (r) => r.status !== 'fulfilled' || r.value.status !== 403
    );
    if (notRejected.length === 0) {
      console.log('   PASS: every pre-open sitting start was correctly rejected with 403.');
    } else {
      const msg = `Scenario 1: expected all 403s before open, got ${notRejected.length} that were not.`;
      console.log(`   FAIL: ${msg}`);
      failures.push(msg);
    }

    // --- Wait for, then simulate, the round opening ---
    const msUntilOpen = ctx.round.openTime.getTime() - Date.now() + 250; // small buffer past open
    if (msUntilOpen > 0) {
      console.log(`\nWaiting ${msUntilOpen}ms for the round boundary...`);
      await new Promise((resolve) => setTimeout(resolve, msUntilOpen));
    }
    // The scheduler isn't running in this script, so open the round the
    // same way it would, to simulate the boundary having just passed.
    await prisma.round.update({ where: { id: ctx.round.id }, data: { state: 'open' } });

    // --- Scenario 2: many different entrants starting sittings at once ---
    console.log(
      `\n[2] Firing ${CONCURRENT_ENTRANTS} concurrent sitting starts (one per entrant)...`
    );
    const startedAt = Date.now();
    const openResults = await Promise.allSettled(
      ctx.entrants.map((entrant) =>
        postWithRetry(app, `/api/rounds/${ctx.round.id}/sittings`, { entrantId: entrant.id })
      )
    );
    console.log(
      `   Completed in ${Date.now() - startedAt}ms. Status counts:`,
      statusCounts(openResults)
    );
    const notOk = openResults.filter((r) => r.status !== 'fulfilled' || r.value.status !== 200);
    if (notOk.length === 0) {
      console.log('   PASS: every entrant successfully started a sitting.');
    } else {
      const msg = `Scenario 2: expected all 200s once open, got ${notOk.length} that were not.`;
      console.log(`   FAIL: ${msg}`);
      failures.push(msg);
    }

    // --- Scenario 3: the SAME entrant double-clicking "start test" ---
    const racerEntrant = ctx.entrants[0];
    console.log(
      `\n[3] Firing ${DOUBLE_CLICK_RACERS} concurrent "start test" requests from the same entrant (double-click)...`
    );
    await Promise.allSettled(
      Array.from({ length: DOUBLE_CLICK_RACERS }, () =>
        postWithRetry(app, `/api/rounds/${ctx.round.id}/sittings`, {
          entrantId: racerEntrant.id,
        })
      )
    );
    const sittingsForRacer = await prisma.sitting.findMany({
      where: { roundId: ctx.round.id, entrantId: racerEntrant.id },
    });
    if (sittingsForRacer.length === 1) {
      console.log('   PASS: exactly one Sitting exists for the double-clicking entrant.');
    } else {
      const msg = `Scenario 3: expected exactly 1 Sitting for the racing entrant, found ${sittingsForRacer.length}.`;
      console.log(`   FAIL: ${msg}`);
      failures.push(msg);
    }

    // --- Atomicity check: every Sitting should have a matching RoundEntrant ---
    console.log('\n[4] Checking every Sitting has a matching RoundEntrant registration...');
    const sittings = await prisma.sitting.findMany({ where: { roundId: ctx.round.id } });
    const roundEntrants = await prisma.roundEntrant.findMany({
      where: { roundId: ctx.round.id },
    });
    const registeredEntrantIds = new Set(roundEntrants.map((re) => re.entrantId));
    const orphanedSittings = sittings.filter((s) => !registeredEntrantIds.has(s.entrantId));
    if (orphanedSittings.length === 0) {
      console.log('   PASS: every Sitting has a matching RoundEntrant registration.');
    } else {
      const msg = `Scenario 4: found ${orphanedSittings.length} Sitting(s) with no matching RoundEntrant.`;
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
