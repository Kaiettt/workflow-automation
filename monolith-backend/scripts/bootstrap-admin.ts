import { PrismaService } from '../libs/database/src/prisma/prisma.service';
import { PrismaAccountAdministration } from '../libs/auth/src/infrastructure/persistence/prisma-account-administration';

try {
  process.loadEnvFile();
} catch {
  /* Environment may be supplied by deployment. */
}
const [email, ...reasonParts] = process.argv.slice(2);
if (!email || !reasonParts.length) {
  console.error(
    'Usage: npm run admin:bootstrap -- <registered-email> <reason>',
  );
  process.exit(1);
}
const prisma = new PrismaService();
new PrismaAccountAdministration(prisma)
  .bootstrap(email, reasonParts.join(' '))
  .then((user) =>
    console.log(`Admin granted to ${user.email}; audit ${user.auditEventId}`),
  )
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Bootstrap failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
