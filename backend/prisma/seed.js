const prisma = require('../src/lib/prisma');
const bcrypt = require('bcrypt');

async function main() {
  const email = 'organiser@olympiadportal.com';
  const password = 'FirstOrganiser123';

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`Organiser account already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, passwordHash, role: 'organiser' },
  });

  console.log('Organiser account created:');
  console.log(`  email: ${user.email}`);
  console.log(`  password: ${password}`);
  console.log('  (change this password after first login)');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
