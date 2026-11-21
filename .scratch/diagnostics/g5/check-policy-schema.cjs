// Diagnostic harness: read-only checks against the backend's configured database.
const path = require('node:path');
try { process.loadEnvFile(); } catch { /* Environment may already be provided. */ }
const { PrismaService } = require(path.join(process.cwd(), 'libs/database/src'));
const { PrismaAdminRead } = require(path.join(process.cwd(), 'libs/admin/src/infrastructure/prisma-admin-read'));
const prisma = new PrismaService();
const reads = new PrismaAdminRead(prisma);
async function main() {
  let failures = 0;
  const checks = [
    ['connector_policies', () => reads.connectors({ page: 1, pageSize: 1 })],
    ['node_type_policies', () => reads.nodeTypes({ page: 1, pageSize: 1 })],
  ];
  for (const [table, check] of checks) {
    try {
      const result = await check();
      if (!Array.isArray(result.items)) throw new Error('Unexpected projection contract');
      console.log('PASS ' + table + ': Admin list query succeeds');
    } catch (error) {
      failures += 1;
      const code = error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN';
      console.log('FAIL ' + table + ': code=' + code);
    }
  }
  process.exitCode = failures ? 1 : 0;
}
main().catch(() => { console.error('Diagnostic could not complete'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
