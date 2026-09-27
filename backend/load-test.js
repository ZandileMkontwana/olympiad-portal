// Load-test harness for the round open/close spikes the brief calls out as the
// hardest requirement, plus an exactly-once check for concurrent submissions.
//
// It is intentionally dependency-free (Node's built-in fetch only) so it runs
// identically from any dev machine or CI runner, against a local backend or a
// deployed one.
//
// Usage (from backend/, with the server already running):
//   node load-test.js                                # full run, localhost:5000
//   node load-test.js --students=20 --concurrency=10 --reads=400 --autosaves=3
//   node load-test.js --base-url=https://<deployed-host>   # run against Render
//   node load-test.js --cleanup                      # remove the load-test round
//
// Every run seeds its own fixtures (a dedicated olympiad/round/school and N
// student accounts), resets the previous run's sittings/submissions, then
// drives four phases: warmup, public reads, a round-open storm, and a
// close-time submit storm with duplicate retries.
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcrypt');
const prisma = require('./src/lib/prisma');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Fixed IDs keep the fixtures recognisable and make cleanup/re-runs trivial.
const OLYMPIAD_ID = '00000000-0000-0000-0000-00000000d001';
const ROUND_ID = '00000000-0000-0000-0000-00000000d002';
const SCHOOL_ID = '00000000-0000-0000-0000-00000000d003';

// The paper's answer key and the answers every simulated student saves. Two of
// five answers match, so every automarked result must come out at exactly 40%.
const MEMO_ANSWERS = { q1: 'A', q2: 'B', q3: 'C', q4: 'B', q5: 'D' };
const SAVED_ANSWERS = { q1: 'A', q2: 'B' };
const EXPECTED_SCORE = 40;

// Student accounts are created by this script with a known password so the
// login storm can be scripted without browser-side Clerk sessions.
const PASSWORD = 'loadtest-password';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--([\w-]+)(?:=(.*))?$/);
    if (match) parsed[match[1]] = match[2] === undefined ? true : match[2];
  }
  return parsed;
}

function intOption(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const args = parseArgs(process.argv);

const config = {
  baseUrl: String(
    args['base-url'] || process.env.LOAD_TEST_BASE_URL || 'http://localhost:5000'
  ).replace(/\/+$/, ''),
  students: intOption(args.students, 20),
  concurrency: intOption(args.concurrency, 10),
  reads: intOption(args.reads, 400),
  autosaves: intOption(args.autosaves, 3),
  resultsFile: args['results-file'] || path.join(__dirname, 'load-test-results.json'),
};

function printUsage() {
  console.log(`Load test for the Olympiad Portal backend.

Options:
  --base-url=<url>      Target backend (default http://localhost:5000)
  --students=<n>        Simulated students for the storm phases (default 20)
  --concurrency=<n>     Concurrent in-flight requests per pool (default 10)
  --reads=<n>           Total public read requests (default 400)
  --autosaves=<n>       Autosave PATCHes per student (default 3)
  --results-file=<path> Where to write raw JSON results
  --cleanup             Delete the load-test round and its data, then exit
  --help                Show this message`);
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const metrics = new Map();

function record(scenario, ms, status, ok) {
  let entry = metrics.get(scenario);
  if (!entry) {
    entry = {
      scenario,
      requests: 0,
      ok: 0,
      errors: 0,
      latencies: [],
      statuses: {},
      firstAt: null,
      lastAt: null,
    };
    metrics.set(scenario, entry);
  }

  entry.requests += 1;
  if (ok) entry.ok += 1;
  else entry.errors += 1;
  entry.latencies.push(ms);
  entry.statuses[status] = (entry.statuses[status] || 0) + 1;

  const now = Date.now();
  if (entry.firstAt === null) entry.firstAt = now;
  entry.lastAt = now;
}

// Nearest-rank percentile — exact rank looking up, no interpolation.
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function summarize() {
  const rows = [];
  for (const entry of metrics.values()) {
    const sorted = [...entry.latencies].sort((a, b) => a - b);
    const durationMs = Math.max(entry.lastAt - entry.firstAt, 1);
    rows.push({
      scenario: entry.scenario,
      requests: entry.requests,
      ok: entry.ok,
      errors: entry.errors,
      durationSeconds: durationMs / 1000,
      requestsPerSecond: entry.requests / (durationMs / 1000),
      avgMs: entry.latencies.reduce((sum, value) => sum + value, 0) / entry.latencies.length,
      p50Ms: percentile(sorted, 50),
      p95Ms: percentile(sorted, 95),
      p99Ms: percentile(sorted, 99),
      maxMs: sorted[sorted.length - 1],
      statuses: entry.statuses,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// HTTP + concurrency helpers
// ---------------------------------------------------------------------------

async function timedRequest(scenario, method, apiPath, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const startedAt = process.hrtime.bigint();
  let status = 0;
  let ok = false;
  let parsed = null;

  try {
    const response = await fetch(`${config.baseUrl}${apiPath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    status = response.status;
    ok = response.ok;
    parsed = await response.json().catch(() => null);
  } catch (err) {
    // Network errors, timeouts and connection-pool rejections all land here;
    // status -1 keeps them distinguishable from HTTP error codes in the report.
    status = -1;
    parsed = { error: err.message };
  }

  const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
  record(scenario, ms, status, ok);
  return { status, ok, body: parsed, ms };
}

async function runPool(items, concurrency, task) {
  const queue = [...items];
  const workerCount = Math.max(1, Math.min(concurrency, queue.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      await task(item);
    }
  });
  await Promise.all(workers);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Fixture setup / cleanup
// ---------------------------------------------------------------------------

async function ensureBackendReachable() {
  try {
    const response = await fetch(`${config.baseUrl}/api/rounds`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (err) {
    console.error(`Cannot reach the backend at ${config.baseUrl} (${err.message}).`);
    console.error('Start it first:  cd backend  &&  node src/index.js');
    process.exitCode = 1;
    return false;
  }
  return true;
}

async function setupFixtures(studentCount) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const now = Date.now();

  await prisma.olympiad.upsert({
    where: { id: OLYMPIAD_ID },
    update: {},
    create: { id: OLYMPIAD_ID, name: 'Load Test Olympiad', timezone: 'Africa/Johannesburg' },
  });

  // Re-open the round on every run (same IDs) so re-runs never depend on the
  // previous run's schedule.
  const openTime = new Date(now - 60 * 60 * 1000);
  const closeTime = new Date(now + 6 * 60 * 60 * 1000);
  await prisma.round.upsert({
    where: { id: ROUND_ID },
    update: {
      state: 'open',
      openTime,
      closeTime,
      qualifyingThreshold: null,
      prerequisiteRoundId: null,
      autoAdvanceProcessedAt: null,
    },
    create: {
      id: ROUND_ID,
      olympiadId: OLYMPIAD_ID,
      name: 'Load Test Round',
      openTime,
      closeTime,
      state: 'open',
    },
  });

  await prisma.paper.upsert({
    where: { roundId: ROUND_ID },
    update: { memoAnswers: MEMO_ANSWERS },
    create: {
      roundId: ROUND_ID,
      fileUrl: 'https://example.invalid/load-test-paper.pdf',
      memoUrl: 'https://example.invalid/load-test-memo.pdf',
      memoAnswers: MEMO_ANSWERS,
    },
  });

  await prisma.school.upsert({
    where: { id: SCHOOL_ID },
    update: {},
    create: { id: SCHOOL_ID, name: 'Load Test School', timezone: 'Africa/Johannesburg' },
  });

  const students = [];
  for (let index = 1; index <= studentCount; index += 1) {
    const email = `loadtest.student.${index}@olympiad.test`;
    const name = `Load Test Student ${index}`;

    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role: 'student', name },
      create: { email, role: 'student', name, passwordHash },
    });

    let entrant = await prisma.entrant.findFirst({ where: { userId: user.id } });
    if (!entrant) {
      entrant = await prisma.entrant.create({
        data: { schoolId: SCHOOL_ID, name, grade: '11', userId: user.id },
      });
    }

    students.push({ email, entrantId: entrant.id });
  }

  // Reset the previous run's artifacts so every run verifies from the same
  // clean baseline: no sittings, no submissions, fresh round registrations.
  // Results and marking tasks reference their submission, so they go first.
  await prisma.result.deleteMany({ where: { submission: { roundId: ROUND_ID } } });
  await prisma.markingTask.deleteMany({ where: { submission: { roundId: ROUND_ID } } });
  await prisma.submission.deleteMany({ where: { roundId: ROUND_ID } });
  await prisma.sitting.deleteMany({ where: { roundId: ROUND_ID } });
  await prisma.roundEntrant.deleteMany({ where: { roundId: ROUND_ID } });
  await prisma.roundEntrant.createMany({
    data: students.map((student) => ({ roundId: ROUND_ID, entrantId: student.entrantId })),
    skipDuplicates: true,
  });

  return students;
}

async function cleanupFixtures() {
  await prisma.result.deleteMany({ where: { submission: { roundId: ROUND_ID } } });
  await prisma.markingTask.deleteMany({ where: { submission: { roundId: ROUND_ID } } });
  await prisma.submission.deleteMany({ where: { roundId: ROUND_ID } });
  await prisma.sitting.deleteMany({ where: { roundId: ROUND_ID } });
  await prisma.roundEntrant.deleteMany({ where: { roundId: ROUND_ID } });
  await prisma.paper.deleteMany({ where: { roundId: ROUND_ID } });
  await prisma.round.deleteMany({ where: { id: ROUND_ID } });
  await prisma.olympiad.deleteMany({ where: { id: OLYMPIAD_ID } });
  console.log('Removed the load-test round, its sittings and its submissions.');
  console.log('(Load-test student accounts are kept so the next run can reuse them.)');
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function scenarioWarmup() {
  for (let i = 0; i < 5; i += 1) {
    await timedRequest('warmup', 'GET', '/api/rounds');
    await sleep(20);
  }
}

async function scenarioPublicReads(reads) {
  const endpoints = ['/api/rounds', `/api/rounds/${ROUND_ID}`];
  const tasks = Array.from({ length: reads }, (_, i) => endpoints[i % endpoints.length]);
  await runPool(tasks, config.concurrency, (endpoint) =>
    timedRequest('public_reads', 'GET', endpoint)
  );
}

// Phase 3: what happens when a round opens — students log in and start sitting,
// all within a short window.
async function scenarioRoundOpenStorm(students) {
  const sessions = [];

  await runPool(students, config.concurrency, async (student) => {
    const login = await timedRequest('student_login', 'POST', '/api/students/login', {
      body: { email: student.email, password: PASSWORD },
    });
    if (!login.ok || !login.body || !login.body.token) return;

    const start = await timedRequest('start_sitting', 'POST', `/api/rounds/${ROUND_ID}/sittings`, {
      token: login.body.token,
      body: { entrantId: student.entrantId },
    });
    if (!start.ok || !start.body || !start.body.sitting) return;

    sessions.push({ token: login.body.token, sittingId: start.body.sitting.id });
  });

  return sessions;
}

// Phase 4a: students working through the paper, autosaving periodically.
async function scenarioAutosave(sessions) {
  const tasks = [];
  for (const session of sessions) {
    for (let i = 0; i < config.autosaves; i += 1) tasks.push(session);
  }

  await runPool(tasks, config.concurrency, ({ token, sittingId }) =>
    timedRequest('autosave', 'PATCH', `/api/sittings/${sittingId}/answers`, {
      token,
      body: { answers: SAVED_ANSWERS },
    })
  );
}

// Phase 4b: the close-time spike. Every sitting gets one normal submit plus
// two near-simultaneous duplicates — the derived idempotencyKey
// ("sitting:<id>") must keep the submission exactly-once no matter how the
// three attempts interleave.
async function scenarioSubmitStorm(sessions) {
  const attempts = [];
  for (const session of sessions) {
    attempts.push({ ...session, scenario: 'submit' });
    attempts.push({ ...session, scenario: 'submit_duplicate' });
    attempts.push({ ...session, scenario: 'submit_duplicate' });
  }

  await runPool(attempts, config.concurrency, ({ token, sittingId, scenario }) =>
    timedRequest(scenario, 'POST', `/api/sittings/${sittingId}/submit`, { token })
  );
}

// ---------------------------------------------------------------------------
// Exactly-once verification
// ---------------------------------------------------------------------------

async function verifyExactlyOnce(studentCount) {
  await prisma.$connect();

  const sittings = await prisma.sitting.findMany({ where: { roundId: ROUND_ID } });
  const completedSittings = sittings.filter((sitting) => sitting.completedAt !== null);
  const submissions = await prisma.submission.findMany({
    where: { roundId: ROUND_ID },
    include: { result: true },
  });

  const submissionsPerKey = new Map();
  for (const submission of submissions) {
    submissionsPerKey.set(
      submission.idempotencyKey,
      (submissionsPerKey.get(submission.idempotencyKey) || 0) + 1
    );
  }
  const duplicatedKeys = [...submissionsPerKey.values()].filter((count) => count > 1).length;
  const scoredCorrectly = submissions.filter(
    (submission) => submission.result && Math.abs(submission.result.score - EXPECTED_SCORE) < 0.001
  ).length;

  const checks = [
    {
      name: 'every student has a sitting',
      pass: sittings.length === studentCount,
      detail: `${sittings.length}/${studentCount}`,
    },
    {
      name: 'every sitting completed',
      pass: completedSittings.length === studentCount,
      detail: `${completedSittings.length}/${studentCount}`,
    },
    {
      name: 'exactly one submission per sitting',
      pass: submissions.length === studentCount && duplicatedKeys === 0,
      detail: `${submissions.length} submissions, ${duplicatedKeys} duplicated idempotency keys`,
    },
    {
      name: 'every submission automarked at the expected score',
      pass: scoredCorrectly === studentCount,
      detail: `${scoredCorrectly}/${studentCount} at ${EXPECTED_SCORE}%`,
    },
  ];

  return {
    pass: checks.every((check) => check.pass),
    checks,
    totals: {
      sittings: sittings.length,
      completedSittings: completedSittings.length,
      submissions: submissions.length,
      duplicatedIdempotencyKeys: duplicatedKeys,
    },
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function formatRow(values, widths) {
  return values.map((value, index) => String(value).padEnd(widths[index])).join('  ');
}

function formatSummaryTable(rows) {
  const headers = [
    'Scenario',
    'Requests',
    'OK',
    'Errors',
    'Duration (s)',
    'Req/s',
    'Avg (ms)',
    'p50',
    'p95',
    'p99',
    'Max',
  ];
  const body = rows.map((row) => [
    row.scenario,
    row.requests,
    row.ok,
    row.errors,
    row.durationSeconds.toFixed(1),
    row.requestsPerSecond.toFixed(1),
    row.avgMs.toFixed(1),
    row.p50Ms.toFixed(1),
    row.p95Ms.toFixed(1),
    row.p99Ms.toFixed(1),
    row.maxMs.toFixed(1),
  ]);

  const widths = headers.map((header, index) =>
    Math.max(header.length, ...body.map((row) => String(row[index]).length))
  );

  const lines = [
    formatRow(headers, widths),
    formatRow(
      widths.map((w) => '-'.repeat(w)),
      widths
    ),
  ];
  for (const row of body) lines.push(formatRow(row, widths));
  return lines.join('\n');
}

function printSummary(rows, verification) {
  console.log('');
  console.log('Load test summary');
  console.log('=================');
  console.log(`Base URL:     ${config.baseUrl}`);
  console.log(`Students:     ${config.students}`);
  console.log(`Concurrency:  ${config.concurrency}`);
  console.log(`Public reads: ${config.reads}   Autosaves per student: ${config.autosaves}`);
  console.log('');
  console.log(formatSummaryTable(rows));

  console.log('');
  console.log('Status codes per scenario');
  for (const row of rows) {
    const codes = Object.entries(row.statuses)
      .map(([status, count]) => `${status}:${count}`)
      .join('  ');
    console.log(`  ${row.scenario.padEnd(18)} ${codes}`);
  }

  console.log('');
  console.log('Exactly-once verification');
  for (const check of verification.checks) {
    console.log(`  [${check.pass ? 'PASS' : 'FAIL'}] ${check.name} — ${check.detail}`);
  }
}

function writeResults(rows, verification) {
  const results = {
    capturedAt: new Date().toISOString(),
    config: {
      baseUrl: config.baseUrl,
      students: config.students,
      concurrency: config.concurrency,
      reads: config.reads,
      autosaves: config.autosaves,
    },
    environment: {
      node: process.version,
      platform: process.platform,
      cpus: os.cpus().length,
    },
    scenarios: rows,
    verification,
  };

  fs.writeFileSync(config.resultsFile, JSON.stringify(results, null, 2));
  console.log('');
  console.log(`Raw results written to ${config.resultsFile}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  if (args.help) {
    printUsage();
    return;
  }

  if (args.cleanup) {
    await cleanupFixtures();
    return;
  }

  if (!(await ensureBackendReachable())) return;

  console.log(`Seeding ${config.students} load-test students and an open round...`);
  const students = await setupFixtures(config.students);
  console.log(`Fixtures ready — round ${ROUND_ID} is open with ${students.length} students.`);

  // Release this script's own database connections during the load phase so
  // the whole session-pooler budget belongs to the backend under test.
  await prisma.$disconnect();

  console.log('\nPhase 1/4  Warmup');
  await scenarioWarmup();

  console.log('Phase 2/4  Public read load');
  await scenarioPublicReads(config.reads);

  console.log('Phase 3/4  Round-open storm (login + start sitting)');
  const sessions = await scenarioRoundOpenStorm(students);
  console.log(`           ${sessions.length}/${students.length} students hold a sitting`);

  console.log('Phase 4/4  Autosave + close-time submit storm');
  await scenarioAutosave(sessions);
  await scenarioSubmitStorm(sessions);

  const verification = await verifyExactlyOnce(students.length);
  const rows = summarize();
  printSummary(rows, verification);
  writeResults(rows, verification);

  const errors = rows.reduce((sum, row) => sum + row.errors, 0);
  if (!verification.pass || errors > 0) {
    console.error('\nLoad test finished with failures — see the summary above.');
    process.exitCode = 1;
  } else {
    console.log('\nAll scenarios clean and exactly-once verification passed.');
  }
}

main()
  .catch((err) => {
    console.error('Load test failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
