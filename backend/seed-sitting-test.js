// One-off test data seeder for Story A2 (online sitting) manual testing.
// Creates: a school, an entrant, a round registration, and a paper with a
// memo answer key for the currently open round. Safe to re-run (upserts).
require('dotenv').config();
const prisma = require('./src/lib/prisma');

const OPEN_ROUND_ID = '612d470b-795b-48ab-9e7f-ecd3caff6963'; // Olympiad2 / Round 1
const PAPER_FILE_URL =
  'https://qfapigqzgznzmgnpgvco.supabase.co/storage/v1/object/public/papers/1788031292625-aaa';

async function main() {
  const round = await prisma.round.findUnique({ where: { id: OPEN_ROUND_ID } });
  if (!round) throw new Error('Open round not found: ' + OPEN_ROUND_ID);
  console.log('Round:', round.name, '| state:', round.state);

  const school = await prisma.school.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Test High School',
      timezone: 'Africa/Johannesburg',
    },
  });
  console.log('School:', school.name);

  const entrant = await prisma.entrant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      schoolId: school.id,
      name: 'Test Student',
      grade: '11',
    },
  });
  console.log('Entrant:', entrant.name, '(grade ' + entrant.grade + ')');

  await prisma.roundEntrant.upsert({
    where: {
      roundId_entrantId: { roundId: round.id, entrantId: entrant.id },
    },
    update: {},
    create: { roundId: round.id, entrantId: entrant.id },
  });
  console.log('Registered entrant in round');

  const paper = await prisma.paper.upsert({
    where: { roundId: round.id },
    update: {},
    create: {
      roundId: round.id,
      fileUrl: PAPER_FILE_URL,
      memoUrl: PAPER_FILE_URL,
      memoAnswers: { q1: 'A', q2: 'B', q3: 'C', q4: 'B', q5: 'D' },
    },
  });
  console.log(
    'Paper ready with',
    Object.keys(paper.memoAnswers).length,
    'questions:',
    Object.keys(paper.memoAnswers).join(', ')
  );
  console.log('Done. Test at: /student/sit?id=' + round.id);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .then(() => process.exit());
