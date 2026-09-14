// One-off test data seeder for D4 (student dashboard) manual testing.
// Creates: an olympiad, an open round, a paper with a memo answer key, and
// registers the existing claimed entrant 'Thabo' in the round.
// Usage:
//   node seed-dashboard-test.js           -> set up the round + registration
//   node seed-dashboard-test.js --release -> set releasedAt on all results
// Safe to re-run (upserts).
require('dotenv').config();
const prisma = require('./src/lib/prisma');

const OLYMPIAD_ID = '00000000-0000-0000-0000-00000000a001';
const ROUND_ID = '00000000-0000-0000-0000-00000000b001';
// A real PDF served by the local backend (express serves /uploads statically).
const PAPER_FILE_URL = 'http://localhost:5000/uploads/papers/1786792506918-test.pdf';
const MEMO_ANSWERS = { q1: 'A', q2: 'B', q3: 'C', q4: 'B', q5: 'D' };

async function release() {
  const updated = await prisma.result.updateMany({
    where: { releasedAt: null },
    data: { releasedAt: new Date() },
  });
  console.log(`Released ${updated.count} result(s). Refresh the student dashboard.`);
}

async function setup() {
  const entrant = await prisma.entrant.findFirst({ where: { name: 'Thabo' } });
  if (!entrant) throw new Error('Entrant "Thabo" not found — register the student first via /register/student');

  await prisma.olympiad.upsert({
    where: { id: OLYMPIAD_ID },
    update: {},
    create: { id: OLYMPIAD_ID, name: 'Test Olympiad', timezone: 'Africa/Johannesburg' },
  });

  const now = Date.now();
  await prisma.round.upsert({
    where: { id: ROUND_ID },
    update: {},
    create: {
      id: ROUND_ID,
      olympiadId: OLYMPIAD_ID,
      name: 'Dash Test Round',
      openTime: new Date(now - 60 * 60 * 1000),  // opened an hour ago
      closeTime: new Date(now + 2 * 60 * 60 * 1000), // closes in two hours
      state: 'open',
    },
  });

  await prisma.roundEntrant.upsert({
    where: { roundId_entrantId: { roundId: ROUND_ID, entrantId: entrant.id } },
    update: {},
    create: { roundId: ROUND_ID, entrantId: entrant.id },
  });

  await prisma.paper.upsert({
    where: { roundId: ROUND_ID },
    update: {},
    create: { roundId: ROUND_ID, fileUrl: PAPER_FILE_URL, memoUrl: PAPER_FILE_URL, memoAnswers: MEMO_ANSWERS },
  });

  const round = await prisma.round.findUnique({ where: { id: ROUND_ID } });
  console.log('Round:', round.name, '| state:', round.state);
  console.log('Entrant registered:', entrant.name, '(grade ' + entrant.grade + ')');
  console.log('Paper ready with', Object.keys(MEMO_ANSWERS).length, 'questions');
  console.log('1. Student dashboard: http://localhost:3000/student');
  console.log('2. Start a sitting:   http://localhost:3000/student/sit?id=' + ROUND_ID);
  console.log('3. After submitting, release results with: node seed-dashboard-test.js --release');
}

mainSwitch();

function mainSwitch() {
  const mode = process.argv[2];
  const run = mode === '--release' ? release : setup;
  run()
    .catch((err) => {
      console.error('Seed failed:', err.message);
      process.exitCode = 1;
    })
    .then(() => process.exit());
}
