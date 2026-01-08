import process from 'node:process';
import { prisma } from './index';

async function main() {
  const email = 'admin@example.com'; // Use the admin user we created earlier
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`User ${email} not found. Please run create-user.ts first.`);
    process.exit(1);
  }

  // 1. Create or Get Organization
  const orgSlug = 'my-platform-org';
  let org = await prisma.team.findFirst({
    where: { slug: orgSlug },
  });

  if (!org) {
    org = await prisma.team.create({
      data: {
        name: 'My Platform Org',
        slug: orgSlug,
        isOrganization: true,
      },
    });
    console.log(`Organization created: ${org.name} (ID: ${org.id})`);
  } else {
    console.log(`Organization found: ${org.name} (ID: ${org.id})`);
  }

  // 2. Add User as Owner
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: user.id,
        teamId: org.id,
      },
    },
  });

  if (!membership) {
    await prisma.membership.create({
      data: {
        userId: user.id,
        teamId: org.id,
        role: 'OWNER',
        accepted: true,
      },
    });
    console.log(`User ${email} added as OWNER of organization.`);
  }

  // 3. Create Key/Secret
  // NOTE: PlatformOAuthClient permissions is an Int. Using 255 (all permissions assumed or just generic high level).
  // Real implementation might use bitmasks.
  const clientId = 'my-client-id';
  const clientSecret = 'my-client-secret';

  const existingClient = await prisma.platformOAuthClient.findUnique({
    where: { id: clientId },
  });

  if (existingClient) {
    console.log('OAuth Client already exists.');
    console.log(`Client ID: ${existingClient.id}`);
    console.log(`Client Secret: ${existingClient.secret}`);
  } else {
    const client = await prisma.platformOAuthClient.create({
      data: {
        id: clientId,
        name: 'My Platform Client',
        secret: clientSecret,
        permissions: 255, 
        organizationId: org.id,
        redirectUris: ['http://localhost:3000'],
      },
    });
    console.log('OAuth Client Created!');
    console.log(`Client ID: ${client.id}`);
    console.log(`Client Secret: ${client.secret}`);
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
