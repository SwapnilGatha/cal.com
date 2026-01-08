import process from 'node:process';
import { prisma } from './index';
import { hash } from 'bcryptjs';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const username = process.argv[4] || email.split('@')[0];
  const role = process.argv[5] === 'admin' ? 'ADMIN' : 'USER';
  
  if (!email || !password) {
    console.error('Usage: ts-node create-user.ts <email> <password> [username] [role:admin|user]');
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log(`User with email ${email} already exists.`);
    return;
  }

  const hashedPassword = await hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      role: role as any,
      password: {
        create: {
          hash: hashedPassword,
        },
      },
      metadata: {},
      identityProvider: 'CAL',
      completedOnboarding: true,
    },
  });

  console.log(`User created: ${user.email} (ID: ${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
