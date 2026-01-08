import process from 'node:process';
import { prisma } from './index';
import { hash } from 'bcryptjs';

async function createShadowUser(email: string, fullName: string, username: string) {
  // 1. Hash a default password (they won't use it, but Cal.com requires it)
  const hashedPassword = await hash('shadow-password-123', 12);

  // 2. Create User
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      username,
      name: fullName,
      password: {
        create: {
          hash: hashedPassword,
        },
      },
      identityProvider: 'CAL',
      completedOnboarding: true,
      timeZone: 'UTC',
    },
  });

  console.log(`User ${email} synced (ID: ${user.id}, Username: ${user.username})`);

  // 3. Create a Default Schedule if it doesn't exist
  let schedule = await prisma.schedule.findFirst({
    where: { userId: user.id, name: 'Default Schedule' },
  });

  if (!schedule) {
    schedule = await prisma.schedule.create({
      data: {
        userId: user.id,
        name: 'Default Schedule',
        timeZone: 'UTC',
      },
    });

    // 4. Add Working Hours (Mon-Fri, 9:00 - 17:00)
    await prisma.availability.createMany({
      data: [
        {
          userId: user.id,
          scheduleId: schedule.id,
          days: [1, 2, 3, 4, 5],
          startTime: new Date('1970-01-01T09:00:00Z'),
          endTime: new Date('1970-01-01T17:00:00Z'),
        },
      ],
    });
    console.log(`Default schedule created for ${username}`);
  }

  // 5. Create a Default Event Type (30 Min Meeting)
  const eventTypeSlug = '30min';
  const existingEventType = await prisma.eventType.findFirst({
    where: { userId: user.id, slug: eventTypeSlug },
    include: { users: true },
  });

  if (!existingEventType) {
    await prisma.eventType.create({
      data: {
        title: '30 Minute Meeting',
        slug: eventTypeSlug,
        length: 30,
        userId: user.id,
        schedulingType: null, // Default
        position: 0,
        scheduleId: schedule.id, // Link the schedule!
        users: {
          connect: [{ id: user.id }],
        },
      },
    });
    console.log(`Event type '30min' created for ${username}`);
  } else if (!existingEventType.scheduleId || existingEventType.users.length === 0) {
    // If it exists but has no schedule, or no users linked, update it
    await prisma.eventType.update({
      where: { id: existingEventType.id },
      data: { 
        scheduleId: schedule.id,
        users: {
          connect: [{ id: user.id }],
        },
      },
    });
    console.log(`Event type '30min' updated/linked for ${username}`);
  }

  return user;
}

async function main() {
  const mode = process.argv[2];

  if (mode === 'seed-test') {
    // Seed test users for local verification
    await createShadowUser('userB@example.com', 'User B (Sales)', 'user-b');
    await createShadowUser('userC@example.com', 'User C (Marketing)', 'user-c');
    await createShadowUser('userD@example.com', 'User D (Engineering)', 'user-d');
    console.log('✅ Test users seeded successfully.');
  } else if (mode === 'sync' && process.argv[3] && process.argv[4] && process.argv[5]) {
    // Manual sync: email, name, username
    await createShadowUser(process.argv[3], process.argv[4], process.argv[5]);
  } else {
    console.log('Usage:');
    console.log('  Seed test users: ts-node shadow-user-sync.ts seed-test');
    console.log('  Sync single user: ts-node shadow-user-sync.ts sync <email> <name> <username>');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
