import { PrismaClient, UserRole } from '@prisma/client';
import { seedMvp } from './seed-mvp';

const prisma = new PrismaClient();

async function main() {
  const defaultUserId = '00000000-0000-0000-0000-000000000000';
  const frontendUserId = '9f16ce27-4570-4044-89f2-5790b30a5544';

  // Check if it's already seeded to avoid unnecessary work
  const existingDefaultUser = await prisma.user.findUnique({
    where: { id: defaultUserId },
  });

  if (existingDefaultUser) {
    console.log('Database is already seeded with default users. Skipping default user seed...');
  } else {
    await prisma.user.upsert({
      where: { id: defaultUserId },
      update: {},
      create: {
        id: defaultUserId,
        email: 'system@flowpilot.local',
        passwordHash: '$2b$10$qhBGHlAqCdvFzfzIJU5E6uE47odBXUD2pAFD50a6TY85o59vD6mTm',
        name: 'System User',
        role: UserRole.DEVELOPER,
        isActive: true,
      },
    });

    await prisma.user.upsert({
      where: { id: frontendUserId },
      update: {},
      create: {
        id: frontendUserId,
        email: 'dev@flowpilot.local',
        passwordHash: '$2b$10$qhBGHlAqCdvFzfzIJU5E6uE47odBXUD2pAFD50a6TY85o59vD6mTm',
        name: 'Frontend Developer',
        role: UserRole.DEVELOPER,
        isActive: true,
      },
    });

    console.log('Seeded users:', defaultUserId, frontendUserId);
  }

  // Run MVP execution data seeding
  await seedMvp(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
