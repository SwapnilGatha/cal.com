import process from 'node:process';
import { prisma } from './index';
import { hash } from 'bcryptjs';

async function updateAvailability(userId: number, scheduleId: number, days: number[], startTimeStr: string, endTimeStr: string): Promise<void> {
  // Delete existing availability for this schedule to reset it
  await prisma.availability.deleteMany({
    where: { scheduleId },
  });

  // Add new working hours
  await prisma.availability.create({
    data: {
      userId,
      scheduleId,
      days,
      startTime: new Date(`1970-01-01T${startTimeStr}Z`),
      endTime: new Date(`1970-01-01T${endTimeStr}Z`),
    },
  });
  console.log(`Availability updated: ${days.join(',')} from ${startTimeStr} to ${endTimeStr}`);
}

interface SimpleSchedule {
  id: number;
}

interface SimpleUser {
  id: number;
  username: string | null;
  email: string;
}

async function ensureDefaultEventType(user: SimpleUser, schedule: SimpleSchedule): Promise<void> {
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
        users: { connect: [{ id: user.id }] },
      },
    });
    console.log(`Event type '30min' created for ${user.username}`);
  } else if (!existingEventType.scheduleId || existingEventType.users.length === 0) {
    // If it exists but has no schedule, or no users linked, update it
    await prisma.eventType.update({
      where: { id: existingEventType.id },
      data: { 
        scheduleId: schedule.id,
        users: { connect: [{ id: user.id }] },
      },
    });
    console.log(`Event type '30min' updated/linked for ${user.username}`);
  }
}

async function createShadowUser(email: string, fullName: string, username: string): Promise<SimpleUser> {
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
      password: { create: { hash: hashedPassword } },
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

    // 4. Add Working Hours (Mon-Fri, 9:00 - 17:00) by default
    await updateAvailability(user.id, schedule.id, [1, 2, 3, 4, 5], '09:00:00', '17:00:00');
    console.log(`Default schedule created for ${username}`);
  }

  // 5. Create a Default Event Type (30 Min Meeting)
  await ensureDefaultEventType(user, schedule);
  
  return user;
}
async function main(): Promise<void> {
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
  } else if (mode === 'update-availability' && process.argv[3] && process.argv[4] && process.argv[5] && process.argv[6]) {
    // update-availability <username> <days: 1,2,3> <startTime: 09:00:00> <endTime: 17:00:00>
    const username = process.argv[3];
    const days = process.argv[4].split(',').map(Number);
    const startTime = process.argv[5];
    const endTime = process.argv[6];

    const user = await prisma.user.findFirst({ where: { username } });
    if (!user) {
      console.error(`User ${username} not found`);
      return;
    }

    const schedule = await prisma.schedule.findFirst({
      where: { userId: user.id, name: 'Default Schedule' },
    });

    if (!schedule) {
      console.error(`Default schedule not found for user ${username}`);
      return;
    }

    await updateAvailability(user.id, schedule.id, days, startTime, endTime);
    console.log(`✅ Availability updated for ${username}`);
  } else {
    console.log('Usage:');
    console.log('  Seed test users: ts-node shadow-user-sync.ts seed-test');
    console.log('  Sync single user: ts-node shadow-user-sync.ts sync <email> <name> <username>');
    console.log('  Update availability: ts-node shadow-user-sync.ts update-availability <username> <days:1,2,3,4,5> <HH:mm:ss> <HH:mm:ss>');
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { createShadowUser, updateAvailability };
