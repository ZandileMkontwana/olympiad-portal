const prisma = require('./src/lib/prisma');

async function main() {
  const roundId = 'b08d38c5-5c3b-4d57-b339-8ae11e5e6ae2';
  const round = await prisma.round.findUnique({ where: { id: roundId } });
  console.log('ROUND', JSON.stringify(round, null, 2));

  if (round) {
    const olympiad = await prisma.olympiad.findUnique({
      where: { id: round.olympiadId },
      select: { id: true, name: true, organiserId: true, createdAt: true },
    });
    console.log('OLYMPIAD', JSON.stringify(olympiad, null, 2));

    const organisers = await prisma.olympiadOrganiser.findMany({
      where: { olympiadId: round.olympiadId },
    });
    console.log('OLYMPIAD ORGANISERS', JSON.stringify(organisers, null, 2));
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, clerkUserId: true },
  });
  console.log('USERS', JSON.stringify(users, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
