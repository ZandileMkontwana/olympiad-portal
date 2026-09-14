const prisma = require('../src/lib/prisma');
const { clerkClient } = require('@clerk/express');

async function main() {
  const email = 'zsikelelwa7@gmail.com';
  const password = 'Codecrafters@2026';
  const name = 'Portal Organiser';

  // Check if this email already has a Clerk account
  const existingUsers = await clerkClient.users.getUserList({ emailAddress: [email] });

  let clerkUser;
  if (existingUsers.data.length > 0) {
    clerkUser = existingUsers.data[0];
    console.log(`Clerk user already exists for ${email}`);
  } else {
    clerkUser = await clerkClient.users.createUser({
      emailAddress: [email],
      password,
      firstName: name,
    });
    console.log(`Created Clerk user for ${email}`);
  }

  const existingDbUser = await prisma.user.findUnique({ where: { clerkUserId: clerkUser.id } });
  if (existingDbUser) {
    console.log('Organiser already exists in our database too. Nothing more to do.');
    return;
  }

  await prisma.user.create({
    data: {
      clerkUserId: clerkUser.id,
      email,
      role: 'organiser',
      name,
    },
  });

  console.log('Organiser account created:');
  console.log(`  email: ${email}`);
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
