/**
 * Attaches the production-like demo data to existing organiser and educator accounts.
 *
 * The educator keeps their existing school. The script grants that school access to
 * the seeded olympiads and adds realistic entrant, submission, and result data.
 *
 * Usage (from backend/):
 *   node prisma/seed-existing-accounts.js \
 *     --organiser-email organiser@example.com \
 *     --educator-email educator@example.com
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const prisma = require('../src/lib/prisma');

const DEMO_STUDENT_PASSWORD = 'Student2026!';

const DEMO_ENTRANTS = [
  ['Aphiwe Nkosi', '8'],
  ['Megan Williams', '8'],
  ['Siyabonga Dube', '9'],
  ['Hannah Jacobs', '9'],
  ['Kamohelo Molefe', '10'],
  ['Ethan Naidoo', '10'],
  ['Lethabo Mokoena', '11'],
  ['Sofia Petersen', '11'],
  ['Ayanda Zulu', '12'],
  ['Joshua Pillay', '12'],
  ['Keletso Khumalo', '10'],
  ['Mia Botha', '11'],
];

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index !== -1 && process.argv[index + 1]
    ? process.argv[index + 1].trim().toLowerCase()
    : null;
}

function demoStudentEmail(name) {
  return `${name
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.|\.$/g, '')}@students.hftlou.edu.za`;
}

function createAnswers(memo, score) {
  const answers = {};
  const questionIds = Object.keys(memo);
  const correctCount = Math.round((questionIds.length * score) / 100);
  const shuffled = [...questionIds].sort(() => Math.random() - 0.5);
  const options = ['A', 'B', 'C', 'D'];

  for (let index = 0; index < shuffled.length; index++) {
    const questionId = shuffled[index];
    answers[questionId] =
      index < correctCount
        ? memo[questionId]
        : options.find((option) => option !== memo[questionId]);
  }

  return answers;
}

async function findSeededRound(olympiadId, name) {
  const round = await prisma.round.findFirst({ where: { olympiadId, name } });
  if (!round) throw new Error(`Seeded round "${name}" was not found`);
  return round;
}

async function main() {
  const organiserEmail = argValue('--organiser-email');
  const educatorEmail = argValue('--educator-email');

  if (!organiserEmail || !educatorEmail) {
    throw new Error('Both --organiser-email and --educator-email are required');
  }

  const organiser = await prisma.user.findUnique({ where: { email: organiserEmail } });
  if (!organiser || organiser.role !== 'organiser') {
    throw new Error(`${organiserEmail} is not an existing organiser account`);
  }

  const educatorUser = await prisma.user.findUnique({
    where: { email: educatorEmail },
    include: { educator: { include: { school: true } } },
  });
  if (!educatorUser || educatorUser.role !== 'educator' || !educatorUser.educator) {
    throw new Error(`${educatorEmail} is not an existing educator account linked to a school`);
  }

  const school = educatorUser.educator.school;
  const olympiads = await prisma.olympiad.findMany({
    where: {
      name: { in: ['Wits Mathematics Olympiad 2026', 'National Science Literacy Challenge'] },
    },
  });
  if (olympiads.length !== 2) {
    throw new Error('Run seed-production.js before associating existing accounts');
  }

  const mathOlympiad = olympiads.find(
    (olympiad) => olympiad.name === 'Wits Mathematics Olympiad 2026'
  );

  for (const olympiad of olympiads) {
    await prisma.olympiadOrganiser.upsert({
      where: {
        olympiadId_organiserId: { olympiadId: olympiad.id, organiserId: organiser.id },
      },
      create: { olympiadId: olympiad.id, organiserId: organiser.id },
      update: {},
    });

    await prisma.schoolOlympiad.upsert({
      where: {
        schoolId_olympiadId: { schoolId: school.id, olympiadId: olympiad.id },
      },
      create: {
        schoolId: school.id,
        olympiadId: olympiad.id,
        status: 'approved',
        requestedById: educatorUser.id,
        decidedAt: new Date(),
      },
      update: {
        status: 'approved',
        requestedById: educatorUser.id,
        decidedAt: new Date(),
      },
    });
  }

  const studentPasswordHash = await bcrypt.hash(DEMO_STUDENT_PASSWORD, 10);
  const entrants = [];
  for (const [name, grade] of DEMO_ENTRANTS) {
    const email = demoStudentEmail(name);
    let entrant = await prisma.entrant.findFirst({
      where: { schoolId: school.id, name },
      include: { user: true },
    });

    if (entrant?.user && entrant.user.role !== 'student') {
      throw new Error(`Entrant ${name} is linked to a non-student account`);
    }

    let studentUser = entrant?.user || (await prisma.user.findUnique({ where: { email } }));
    if (studentUser && studentUser.role !== 'student') {
      throw new Error(`${email} already belongs to a non-student account`);
    }
    if (!studentUser) {
      studentUser = await prisma.user.create({
        data: { email, name, role: 'student', passwordHash: studentPasswordHash },
      });
    } else if (!studentUser.passwordHash) {
      studentUser = await prisma.user.update({
        where: { id: studentUser.id },
        data: { passwordHash: studentPasswordHash },
      });
    }

    if (!entrant) {
      entrant = await prisma.entrant.create({
        data: { schoolId: school.id, name, grade, userId: studentUser.id },
      });
    } else if (entrant.userId !== studentUser.id) {
      entrant = await prisma.entrant.update({
        where: { id: entrant.id },
        data: { userId: studentUser.id },
      });
    }
    entrants.push(entrant);
  }

  const roundOne = await findSeededRound(mathOlympiad.id, 'Round 1 — Foundations');
  const roundTwo = await findSeededRound(mathOlympiad.id, 'Round 2 — Intermediate');
  const [roundOnePaper, roundTwoPaper] = await Promise.all([
    prisma.paper.findUnique({ where: { roundId: roundOne.id } }),
    prisma.paper.findUnique({ where: { roundId: roundTwo.id } }),
  ]);

  if (!roundOnePaper?.memoAnswers || !roundTwoPaper?.memoAnswers) {
    throw new Error('The seeded Mathematics papers must have MCQ memos');
  }

  let roundOneSubmissions = 0;
  let roundTwoSubmissions = 0;
  for (let index = 0; index < entrants.length; index++) {
    const entrant = entrants[index];
    const roundOneScore = 46 + ((index * 7) % 50);

    await prisma.roundEntrant.upsert({
      where: { roundId_entrantId: { roundId: roundOne.id, entrantId: entrant.id } },
      create: { roundId: roundOne.id, entrantId: entrant.id },
      update: {},
    });

    let submission = await prisma.submission.findFirst({
      where: { roundId: roundOne.id, entrantId: entrant.id },
      include: { result: true },
    });
    if (!submission) {
      submission = await prisma.submission.create({
        data: {
          roundId: roundOne.id,
          entrantId: entrant.id,
          answers: createAnswers(roundOnePaper.memoAnswers, roundOneScore),
          idempotencyKey: `existing-account-math-r1-${entrant.id}`,
          submittedAt: new Date(roundOne.closeTime.getTime() - (index + 1) * 60 * 60 * 1000),
        },
        include: { result: true },
      });
      roundOneSubmissions++;
    }
    if (!submission.result) {
      await prisma.result.create({
        data: {
          submissionId: submission.id,
          score: roundOneScore,
          releasedAt: new Date(roundOne.closeTime),
        },
      });
    }

    // Entrants who passed Round 1 receive realistic in-progress Round 2 activity.
    if (roundOneScore >= 50 && index % 2 === 0) {
      await prisma.roundEntrant.upsert({
        where: { roundId_entrantId: { roundId: roundTwo.id, entrantId: entrant.id } },
        create: { roundId: roundTwo.id, entrantId: entrant.id },
        update: {},
      });

      const existingRoundTwoSubmission = await prisma.submission.findFirst({
        where: { roundId: roundTwo.id, entrantId: entrant.id },
      });
      if (!existingRoundTwoSubmission) {
        await prisma.submission.create({
          data: {
            roundId: roundTwo.id,
            entrantId: entrant.id,
            answers: createAnswers(roundTwoPaper.memoAnswers, 55 + ((index * 5) % 35)),
            idempotencyKey: `existing-account-math-r2-${entrant.id}`,
            submittedAt: new Date(),
          },
        });
        roundTwoSubmissions++;
      }
    }
  }

  console.log(`Associated organiser ${organiser.email} with ${olympiads.length} seeded olympiads.`);
  console.log(`Approved ${school.name} for both seeded olympiads.`);
  console.log(`Ensured ${entrants.length} demo entrants for ${school.name}.`);
  console.log(
    `Created ${roundOneSubmissions} Round 1 and ${roundTwoSubmissions} Round 2 submissions.`
  );
}

main()
  .catch((error) => {
    console.error('Account association seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
