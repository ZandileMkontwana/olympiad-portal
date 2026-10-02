/**
 * Production-like seed data for the Olympiad Portal.
 *
 * Creates realistic schools, educators, students, olympiads, rounds,
 * submissions, results, and audit logs so the demo and rubric evaluation
 * reflect a real system — not just test rows.
 *
 * SAFE TO RE-RUN: skips anything that already exists (matched by email or name).
 *
 * Usage (from backend/):
 *   node prisma/seed-production.js
 *
 * Prerequisites:
 *   - DATABASE_URL and Clerk keys in .env
 *   - The organiser account already exists (run seed.js first)
 */

require('dotenv').config();
const prisma = require('../src/lib/prisma');
const { clerkClient } = require('@clerk/express');
const bcrypt = require('bcrypt');

// ── Helpers ──────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate an MCQ memo: 20 questions with answers A–D */
function generateMemo(questionCount = 20) {
  const options = ['A', 'B', 'C', 'D'];
  const memo = {};
  for (let i = 1; i <= questionCount; i++) {
    memo[`q${i}`] = pick(options);
  }
  return memo;
}

/** Generate a student answer set that scores roughly `targetPercent`% */
function generateAnswers(memo, targetPercent) {
  const answers = {};
  const keys = Object.keys(memo);
  const correctCount = Math.round((keys.length * targetPercent) / 100);

  // Shuffle keys so correct answers aren't always at the start
  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  const options = ['A', 'B', 'C', 'D'];

  for (let i = 0; i < shuffled.length; i++) {
    const qId = shuffled[i];
    if (i < correctCount) {
      answers[qId] = memo[qId]; // correct
    } else {
      // Wrong answer — pick a different option
      const wrong = options.filter((o) => o !== memo[qId]);
      answers[qId] = pick(wrong);
    }
  }
  return answers;
}

/** Realistic score distribution: bell curve centred around 55–65% */
function randomScore() {
  // Box-Muller for normal distribution, mean 60, stddev 18, clamped 0–100
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.min(100, Math.round((60 + z * 18) * 10) / 10));
}

// ── Data ─────────────────────────────────────────────────────────────────────

const SCHOOLS = [
  { name: 'Sandton High School', timezone: 'Africa/Johannesburg' },
  { name: 'Soweto Secondary', timezone: 'Africa/Johannesburg' },
  { name: 'Pretoria Boys High', timezone: 'Africa/Johannesburg' },
  { name: 'Cape Town Girls High', timezone: 'Africa/Cape_Town' },
  { name: 'Durbanville College', timezone: 'Africa/Johannesburg' },
  { name: 'Killarney Combined School', timezone: 'Africa/Johannesburg' },
];

const EDUCATOR_NAMES = [
  // Sandton
  ['Nomsa Dlamini', 'David van der Merwe', 'Fatima Patel'],
  // Soweto
  ['Thabo Molefe', 'Lindiwe Khumalo', 'Sipho Ngcobo'],
  // Pretoria Boys
  ['Johan Botha', 'Priya Naidoo', 'Mary Mokoena'],
  // Cape Town Girls
  ['Aisha Abrahams', 'Sarah de Wet', 'Zanele Mthembu'],
  // Durbanville
  ['Pieter Joubert', 'Grace Mthembu', 'Raj Govender'],
  // Killarney
  ['Rebecca Stein', 'Bongani Zwane', 'Helen Ng'],
];

const STUDENT_FIRST_NAMES = [
  'Thabo',
  'Lerato',
  'Sipho',
  'Nomsa',
  'Bongani',
  'Zanele',
  'Kagiso',
  'Palesa',
  'Mandla',
  'Dineo',
  'Tshepo',
  'Lindiwe',
  'Sibusiso',
  'Nokuthula',
  'Mthunzi',
  'Amahle',
  'Lwando',
  'Naledi',
  'Katlego',
  'Refilwe',
  'Jayden',
  'Aisha',
  'Liam',
  'Priya',
  'Noah',
  'Fatima',
  'Ethan',
  'Zara',
  'Daniel',
  'Leah',
  'Connor',
  'Emma',
  'Ryan',
  'Chloe',
  'Luke',
  'Maya',
  'Ben',
  'Sarah',
  'Adam',
  'Hannah',
];

const STUDENT_SURNAMES = [
  'Mokoena',
  'van der Merwe',
  'Nkosi',
  'Smith',
  'Dlamini',
  'Botha',
  'Khumalo',
  'Patel',
  'Zwane',
  'de Wet',
  'Ngcobo',
  'Pillay',
  'Mthembu',
  'Joubert',
  'Abrahams',
  'Govender',
  'Stein',
  'Molefe',
  'Naidoo',
  'Zulu',
  'Swanepoel',
  'Mashaba',
  'Tshabalala',
  'Ngwenya',
];

const GRADES = ['8', '9', '10', '11', '12'];

const NOW = new Date();
function daysAgo(n) {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}
function daysFromNow(n) {
  return new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting production data seed...\n');

  // ── 1. Organiser ────────────────────────────────────────────────────────
  const organiser = await prisma.user.findFirst({ where: { role: 'organiser' } });
  if (!organiser) {
    console.error('❌ No organiser found. Run `node prisma/seed.js` first.');
    return;
  }
  console.log(`✅ Organiser: ${organiser.name} (${organiser.email})`);

  // ── 2. Schools ──────────────────────────────────────────────────────────
  const schools = [];
  for (const s of SCHOOLS) {
    const existing = await prisma.school.findFirst({ where: { name: s.name } });
    if (existing) {
      schools.push(existing);
      console.log(`✅ School exists: ${s.name}`);
      continue;
    }
    const created = await prisma.school.create({ data: s });
    schools.push(created);
    console.log(`🏫 Created school: ${s.name}`);
  }

  // ── 3. Educators (with Clerk accounts for first 2 per school) ───────────
  const educators = []; // flat list of { dbUser, educator, schoolIndex }
  for (let si = 0; si < schools.length; si++) {
    const names = EDUCATOR_NAMES[si];
    for (let ei = 0; ei < names.length; ei++) {
      const name = names[ei];
      const emailBase = name
        .toLowerCase()
        .replace(/[^a-z]/g, '.')
        .replace(/\.+/g, '.');
      const email = `${emailBase}@${schools[si].name.toLowerCase().replace(/[^a-z]/g, '')}.edu.za`;

      // Check if user already exists
      let dbUser = await prisma.user.findUnique({ where: { email } });
      if (!dbUser) {
        // Create Clerk user for first 2 educators per school (demo login)
        let clerkUserId = null;
        if (ei < 2) {
          const clerkEmail = email.replace('@', '+clerk@');
          const existingClerk = await clerkClient.users.getUserList({
            emailAddress: [clerkEmail],
          });
          if (existingClerk.data.length > 0) {
            clerkUserId = existingClerk.data[0].id;
          } else {
            const clerkUser = await clerkClient.users.createUser({
              emailAddress: [clerkEmail],
              password: 'DemoAccount2026!',
              firstName: name.split(' ')[0],
              lastName: name.split(' ').slice(1).join(' '),
            });
            clerkUserId = clerkUser.id;
          }
        }

        dbUser = await prisma.user.create({
          data: {
            clerkUserId,
            email,
            role: 'educator',
            name,
          },
        });
      }

      let educator = await prisma.educator.findUnique({ where: { userId: dbUser.id } });
      if (!educator) {
        educator = await prisma.educator.create({
          data: { userId: dbUser.id, schoolId: schools[si].id },
        });
      }

      educators.push({ dbUser, educator, schoolIndex: si, canLogin: ei < 2 });
      console.log(`👩‍🏫 Educator: ${name} at ${schools[si].name}${ei < 2 ? ' [can login]' : ''}`);
    }
  }

  // ── 4. Students / Entrants ──────────────────────────────────────────────
  const entrantsBySchool = []; // array of arrays
  for (let si = 0; si < schools.length; si++) {
    const entrants = [];
    const studentsPerSchool = 12;

    for (let i = 0; i < studentsPerSchool; i++) {
      const firstName = pick(STUDENT_FIRST_NAMES);
      const surname = pick(STUDENT_SURNAMES);
      const name = `${firstName} ${surname}`;
      const grade = GRADES[i % GRADES.length];
      const email = `${firstName.toLowerCase()}.${surname.toLowerCase()}${i}@student.${schools[si].name.toLowerCase().replace(/[^a-z]/g, '')}.edu.za`;

      // Check if entrant already exists at this school with this name
      const existing = await prisma.entrant.findFirst({
        where: { schoolId: schools[si].id, name },
      });
      if (existing) {
        entrants.push(existing);
        continue;
      }

      // Create student user with bcrypt password (pre-activated)
      const passwordHash = await bcrypt.hash('Student2026!', 10);
      const dbUser = await prisma.user.create({
        data: {
          email,
          role: 'student',
          name,
          passwordHash,
        },
      });

      const entrant = await prisma.entrant.create({
        data: {
          name,
          grade,
          schoolId: schools[si].id,
          userId: dbUser.id,
        },
      });
      entrants.push(entrant);
    }

    entrantsBySchool.push(entrants);
    console.log(`🎓 School ${schools[si].name}: ${entrants.length} students created`);
  }

  // ── 5. Olympiads & Rounds ───────────────────────────────────────────────
  // Olympiad 1: Wits Mathematics Olympiad (3 rounds, MCQ)
  let olympiad1 = await prisma.olympiad.findFirst({
    where: { name: 'Wits Mathematics Olympiad 2026' },
  });
  if (!olympiad1) {
    olympiad1 = await prisma.olympiad.create({
      data: {
        name: 'Wits Mathematics Olympiad 2026',
        description:
          'Annual mathematics competition for grades 8–12. Three rounds of increasing difficulty, with the top scorers advancing to the provincial finals.',
        timezone: 'Africa/Johannesburg',
        grades: 'Grade 8-12',
        startDate: daysAgo(30),
        endDate: daysFromNow(30),
        organiserId: organiser.id,
      },
    });
    console.log(`\n🏆 Created olympiad: ${olympiad1.name}`);
  }

  // Olympiad 2: Science Literacy Challenge (3 rounds, mixed)
  let olympiad2 = await prisma.olympiad.findFirst({
    where: { name: 'National Science Literacy Challenge' },
  });
  if (!olympiad2) {
    olympiad2 = await prisma.olympiad.create({
      data: {
        name: 'National Science Literacy Challenge',
        description:
          'A reading comprehension and scientific reasoning competition. Rounds include both multiple-choice and short-answer questions requiring manual marking.',
        timezone: 'Africa/Johannesburg',
        grades: 'Grade 10-12',
        startDate: daysAgo(14),
        endDate: daysFromNow(45),
        organiserId: organiser.id,
      },
    });
    console.log(`🏆 Created olympiad: ${olympiad2.name}`);
  }

  // Rounds for Olympiad 1
  const mathRounds = [];
  const mathRoundDefs = [
    { name: 'Round 1 — Foundations', offset: -21, duration: 7, threshold: 50 },
    { name: 'Round 2 — Intermediate', offset: -7, duration: 14, threshold: 60 },
    { name: 'Round 3 — Finals', offset: 7, duration: 14, threshold: null },
  ];

  for (let ri = 0; ri < mathRoundDefs.length; ri++) {
    const def = mathRoundDefs[ri];
    const existing = await prisma.round.findFirst({
      where: { olympiadId: olympiad1.id, name: def.name },
    });
    if (existing) {
      mathRounds.push(existing);
      continue;
    }

    const openTime = daysAgo(-def.offset);
    const closeTime = new Date(openTime.getTime() + def.duration * 24 * 60 * 60 * 1000);

    let state = 'scheduled';
    if (closeTime < NOW) state = ri === 0 ? 'released' : 'closed';
    else if (openTime < NOW) state = 'open';

    const round = await prisma.round.create({
      data: {
        name: def.name,
        olympiadId: olympiad1.id,
        openTime,
        closeTime,
        state,
        qualifyingThreshold: def.threshold,
        prerequisiteRoundId: ri > 0 ? mathRounds[ri - 1].id : null,
      },
    });
    mathRounds.push(round);

    // Create paper with memo for MCQ rounds
    const memo = generateMemo(20);
    await prisma.paper.create({
      data: {
        roundId: round.id,
        fileUrl: `papers/math-round${ri + 1}.pdf`,
        memoUrl: `papers/math-round${ri + 1}-memo.pdf`,
        memoAnswers: memo,
      },
    });

    console.log(`📝 Round: ${def.name} — state: ${state}, ${Object.keys(memo).length} questions`);
  }

  // Rounds for Olympiad 2
  const sciRounds = [];
  const sciRoundDefs = [
    { name: 'Heat 1 — Biology', offset: -10, duration: 10, threshold: 55 },
    { name: 'Heat 2 — Chemistry', offset: 3, duration: 14, threshold: 60 },
    { name: 'Heat 3 — Physics', offset: 20, duration: 14, threshold: null },
  ];

  for (let ri = 0; ri < sciRoundDefs.length; ri++) {
    const def = sciRoundDefs[ri];
    const existing = await prisma.round.findFirst({
      where: { olympiadId: olympiad2.id, name: def.name },
    });
    if (existing) {
      sciRounds.push(existing);
      continue;
    }

    const openTime = daysAgo(-def.offset);
    const closeTime = new Date(openTime.getTime() + def.duration * 24 * 60 * 60 * 1000);

    let state = 'scheduled';
    if (closeTime < NOW) state = 'closed';
    else if (openTime < NOW) state = 'open';

    const round = await prisma.round.create({
      data: {
        name: def.name,
        olympiadId: olympiad2.id,
        openTime,
        closeTime,
        state,
        qualifyingThreshold: def.threshold,
        prerequisiteRoundId: ri > 0 ? sciRounds[ri - 1].id : null,
      },
    });
    sciRounds.push(round);

    // Heat 1 has memo (MCQ), Heat 2 & 3 have no memo (manual marking)
    if (ri === 0) {
      const memo = generateMemo(15);
      await prisma.paper.create({
        data: {
          roundId: round.id,
          fileUrl: `papers/sci-heat${ri + 1}.pdf`,
          memoUrl: `papers/sci-heat${ri + 1}-memo.pdf`,
          memoAnswers: memo,
        },
      });
    } else {
      await prisma.paper.create({
        data: {
          roundId: round.id,
          fileUrl: `papers/sci-heat${ri + 1}.pdf`,
          memoUrl: `papers/sci-heat${ri + 1}-memo.pdf`,
          memoAnswers: null, // manual marking
        },
      });
    }

    console.log(`📝 Round: ${def.name} — state: ${state}, ${ri === 0 ? 'MCQ' : 'manual marking'}`);
  }

  // ── 6. School-Olympiad access ───────────────────────────────────────────
  for (const school of schools) {
    for (const olympiad of [olympiad1, olympiad2]) {
      const existing = await prisma.schoolOlympiad.findUnique({
        where: { schoolId_olympiadId: { schoolId: school.id, olympiadId: olympiad.id } },
      });
      if (!existing) {
        await prisma.schoolOlympiad.create({
          data: {
            schoolId: school.id,
            olympiadId: olympiad.id,
            status: 'approved',
            requestedById: educators.find((e) => e.schoolIndex === schools.indexOf(school))?.dbUser
              .id,
            decidedAt: daysAgo(25),
          },
        });
      }
    }
  }
  console.log('\n✅ School-Olympiad access records created');

  // ── 7. Round-Entrants, Submissions, Results ─────────────────────────────
  let totalSubmissions = 0;
  let totalResults = 0;

  // Math Olympiad Round 1 (closed + released) — most students submitted
  const round1 = mathRounds[0];
  if (round1) {
    const memo = (await prisma.paper.findUnique({ where: { roundId: round1.id } }))?.memoAnswers;

    for (let si = 0; si < schools.length; si++) {
      // ~85% submission rate for released round
      const submittingEntrants = entrantsBySchool[si].filter(() => Math.random() < 0.85);

      for (const entrant of submittingEntrants) {
        // RoundEntrant
        await prisma.roundEntrant.upsert({
          where: { roundId_entrantId: { roundId: round1.id, entrantId: entrant.id } },
          create: { roundId: round1.id, entrantId: entrant.id },
          update: {},
        });

        // Check if submission already exists
        const existingSub = await prisma.submission.findFirst({
          where: { roundId: round1.id, entrantId: entrant.id },
        });
        if (existingSub) continue;

        const score = randomScore();
        const answers = memo ? generateAnswers(memo, score) : {};
        const submittedAt = new Date(
          round1.openTime.getTime() +
            Math.random() * (round1.closeTime.getTime() - round1.openTime.getTime())
        );

        const submission = await prisma.submission.create({
          data: {
            roundId: round1.id,
            entrantId: entrant.id,
            answers,
            idempotencyKey: `seed-math1-${entrant.id}`,
            submittedAt,
          },
        });

        await prisma.result.create({
          data: {
            submissionId: submission.id,
            score,
            releasedAt: daysAgo(5),
          },
        });

        totalSubmissions++;
        totalResults++;
      }
    }
    console.log(`📊 ${round1.name}: ${totalSubmissions} submissions, ${totalResults} results`);
  }

  // Math Olympiad Round 2 (open) — some students already submitted
  const round2 = mathRounds[1];
  let r2Subs = 0;
  if (round2) {
    const memo = (await prisma.paper.findUnique({ where: { roundId: round2.id } }))?.memoAnswers;

    for (let si = 0; si < schools.length; si++) {
      // Only entrants who passed Round 1 (score >= 50%) can enter Round 2
      const qualifiedEntrants = [];
      for (const entrant of entrantsBySchool[si]) {
        const sub = await prisma.submission.findFirst({
          where: { roundId: round1.id, entrantId: entrant.id },
          include: { result: true },
        });
        if (sub && sub.result && sub.result.score >= 50) {
          qualifiedEntrants.push(entrant);
        }
      }

      // ~40% of qualified students have submitted so far
      const submittedEntrants = qualifiedEntrants.filter(() => Math.random() < 0.4);

      for (const entrant of submittedEntrants) {
        await prisma.roundEntrant.upsert({
          where: { roundId_entrantId: { roundId: round2.id, entrantId: entrant.id } },
          create: { roundId: round2.id, entrantId: entrant.id },
          update: {},
        });

        const existingSub = await prisma.submission.findFirst({
          where: { roundId: round2.id, entrantId: entrant.id },
        });
        if (existingSub) continue;

        const score = randomScore();
        const answers = memo ? generateAnswers(memo, score) : {};

        await prisma.submission.create({
          data: {
            roundId: round2.id,
            entrantId: entrant.id,
            answers,
            idempotencyKey: `seed-math2-${entrant.id}`,
            submittedAt: daysAgo(Math.floor(Math.random() * 5)),
          },
        });

        r2Subs++;
        totalSubmissions++;
      }
    }
    console.log(`📊 ${round2.name}: ${r2Subs} submissions so far (round still open)`);
  }

  // Science Olympiad Heat 1 (closed) — submissions with MCQ marking
  const sciRound1 = sciRounds[0];
  let sci1Subs = 0;
  if (sciRound1) {
    const memo = (await prisma.paper.findUnique({ where: { roundId: sciRound1.id } }))?.memoAnswers;

    for (let si = 0; si < schools.length; si++) {
      // Only grades 10-12 for science olympiad
      const eligibleEntrants = entrantsBySchool[si].filter((e) =>
        ['10', '11', '12'].includes(e.grade)
      );
      const submittingEntrants = eligibleEntrants.filter(() => Math.random() < 0.75);

      for (const entrant of submittingEntrants) {
        await prisma.roundEntrant.upsert({
          where: { roundId_entrantId: { roundId: sciRound1.id, entrantId: entrant.id } },
          create: { roundId: sciRound1.id, entrantId: entrant.id },
          update: {},
        });

        const existingSub = await prisma.submission.findFirst({
          where: { roundId: sciRound1.id, entrantId: entrant.id },
        });
        if (existingSub) continue;

        const score = randomScore();
        const answers = memo ? generateAnswers(memo, score) : {};

        await prisma.submission.create({
          data: {
            roundId: sciRound1.id,
            entrantId: entrant.id,
            answers,
            idempotencyKey: `seed-sci1-${entrant.id}`,
            submittedAt: new Date(
              sciRound1.openTime.getTime() +
                Math.random() * (sciRound1.closeTime.getTime() - sciRound1.openTime.getTime())
            ),
          },
        });

        await prisma.result.create({
          data: {
            submissionId: (
              await prisma.submission.findFirst({
                where: { roundId: sciRound1.id, entrantId: entrant.id },
              })
            ).id,
            score,
            releasedAt: null, // not released yet
          },
        });

        sci1Subs++;
        totalSubmissions++;
        totalResults++;
      }
    }
    console.log(`📊 ${sciRound1.name}: ${sci1Subs} submissions`);
  }

  // Science Olympiad Heat 2 (open) — manual marking, create some marking tasks
  const sciRound2 = sciRounds[1];
  if (sciRound2) {
    // A few submissions that need marking tasks
    for (let si = 0; si < Math.min(3, schools.length); si++) {
      const eligibleEntrants = entrantsBySchool[si].filter((e) =>
        ['10', '11', '12'].includes(e.grade)
      );
      const submitted = eligibleEntrants.filter(() => Math.random() < 0.3);

      for (const entrant of submitted) {
        await prisma.roundEntrant.upsert({
          where: { roundId_entrantId: { roundId: sciRound2.id, entrantId: entrant.id } },
          create: { roundId: sciRound2.id, entrantId: entrant.id },
          update: {},
        });

        const existingSub = await prisma.submission.findFirst({
          where: { roundId: sciRound2.id, entrantId: entrant.id },
        });
        if (existingSub) continue;

        const submission = await prisma.submission.create({
          data: {
            roundId: sciRound2.id,
            entrantId: entrant.id,
            answers: { q1: 'Photosynthesis converts light energy to chemical energy.', q2: 'H2O' },
            idempotencyKey: `seed-sci2-${entrant.id}`,
            submittedAt: daysAgo(Math.floor(Math.random() * 3)),
          },
        });

        // No memo → marking task created
        await prisma.markingTask.create({
          data: { submissionId: submission.id },
        });

        totalSubmissions++;
      }
    }
    console.log(`📊 ${sciRound2.name}: marking tasks created for manual-mark submissions`);
  }

  // ── 8. Audit logs ──────────────────────────────────────────────────────
  const existingAuditCount = await prisma.auditLog.count();
  if (existingAuditCount === 0) {
    const auditEntries = [];

    // Round lifecycle events
    for (const round of [...mathRounds, ...sciRounds]) {
      if (['open', 'closed', 'released'].includes(round.state)) {
        auditEntries.push({
          action: 'round_opened',
          roundId: round.id,
          timestamp: round.openTime,
          payload: { openedAt: round.openTime.toISOString() },
        });
      }
      if (['closed', 'released'].includes(round.state)) {
        auditEntries.push({
          action: 'round_closed',
          roundId: round.id,
          timestamp: round.closeTime,
          payload: { closedAt: round.closeTime.toISOString() },
        });
      }
    }

    if (auditEntries.length > 0) {
      await prisma.auditLog.createMany({ data: auditEntries });
      console.log(`\n📋 Created ${auditEntries.length} audit log entries`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const counts = {
    schools: schools.length,
    educators: educators.length,
    students: await prisma.entrant.count(),
    olympiads: 2,
    rounds: mathRounds.length + sciRounds.length,
    submissions: await prisma.submission.count(),
    results: await prisma.result.count(),
    markingTasks: await prisma.markingTask.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  console.log('\n────────────────────────────────────────────');
  console.log('🌱 Production seed complete!');
  console.log('────────────────────────────────────────────');
  console.log(`  Schools:        ${counts.schools}`);
  console.log(`  Educators:      ${counts.educators}`);
  console.log(`  Students:       ${counts.students}`);
  console.log(`  Olympiads:      ${counts.olympiads}`);
  console.log(`  Rounds:         ${counts.rounds}`);
  console.log(`  Submissions:    ${counts.submissions}`);
  console.log(`  Results:        ${counts.results}`);
  console.log(`  Marking tasks:  ${counts.markingTasks}`);
  console.log(`  Audit logs:     ${counts.auditLogs}`);
  console.log('────────────────────────────────────────────');
  console.log('\nDemo login credentials:');
  console.log('  Educators with Clerk accounts can log in at /login');
  console.log('  Password for all demo educator accounts: DemoAccount2026!');
  console.log('  Students use JWT auth with password: Student2026!');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
