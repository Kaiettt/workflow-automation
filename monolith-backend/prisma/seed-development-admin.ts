import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

export const DEVELOPMENT_ADMIN_EMAIL = 'admin@flowpilot.local';
export const DEVELOPMENT_ADMIN_PASSWORD = 'Admin123!';

export async function seedDevelopmentAdmin(prisma: PrismaClient) {
  if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development')
    return null;
  const databaseUrl = process.env.DATABASE_URL;
  if (
    !databaseUrl ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname)
  )
    return null;

  const passwordHash = await hash(DEVELOPMENT_ADMIN_PASSWORD, 10);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(7261101)::text`;
    const existing = await tx.user.findUnique({
      where: { email: DEVELOPMENT_ADMIN_EMAIL },
      select: { email: true, role: true, isActive: true },
    });
    // Reseeding preserves passwords, suspensions and role changes made by Admin.
    if (existing) return existing;
    if (await tx.user.count({ where: { role: 'ADMIN', isActive: true } }))
      return null;
    const user = await tx.user.create({
      data: {
        email: DEVELOPMENT_ADMIN_EMAIL,
        name: 'Local Admin',
        passwordHash,
        role: 'ADMIN',
      },
      select: { id: true, email: true, role: true, isActive: true },
    });
    await tx.adminAuditEvent.create({
      data: {
        actorType: 'SYSTEM',
        actorId: null,
        targetType: 'USER',
        targetId: user.id,
        action: 'ADMIN_BOOTSTRAPPED',
        reason: 'Create initial Admin for local development',
        before: {},
        after: { role: 'ADMIN', isActive: true },
      },
    });
    return user;
  });
}
