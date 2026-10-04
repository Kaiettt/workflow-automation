import { PrismaClient, UserRole } from '@prisma/client';
import { seedMvp } from './seed-mvp';

const prisma = new PrismaClient();

async function main() {
  const defaultUserId = '00000000-0000-0000-0000-000000000000';
  const frontendUserId = '9f16ce27-4570-4044-89f2-5790b30a5544';

  await prisma.user.upsert({
    where: { id: defaultUserId },
    update: {
      passwordHash: '$2b$10$nx.K4i7OWVN03lAln6.f3OYlf/Wg6MdAvmBY9M.1jeYyrYJoyk7FW',
      isActive: true,
    },
    create: {
      id: defaultUserId,
      email: 'system@flowpilot.local',
      passwordHash: '$2b$10$nx.K4i7OWVN03lAln6.f3OYlf/Wg6MdAvmBY9M.1jeYyrYJoyk7FW',
      name: 'System User',
      role: UserRole.DEVELOPER,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { id: frontendUserId },
    update: {
      passwordHash: '$2b$10$nx.K4i7OWVN03lAln6.f3OYlf/Wg6MdAvmBY9M.1jeYyrYJoyk7FW',
      isActive: true,
    },
    create: {
      id: frontendUserId,
      email: 'dev@flowpilot.local',
      passwordHash: '$2b$10$nx.K4i7OWVN03lAln6.f3OYlf/Wg6MdAvmBY9M.1jeYyrYJoyk7FW',
      name: 'Frontend Developer',
      role: UserRole.DEVELOPER,
      isActive: true,
    },
  });

  console.log('Seeded users:', defaultUserId, frontendUserId);

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
