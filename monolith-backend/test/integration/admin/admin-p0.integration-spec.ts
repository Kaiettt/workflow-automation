import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  cpSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { PrismaAdminRead } from '../../../libs/admin/src/infrastructure/prisma-admin-read';
import type { AccountSummary } from '@app/auth/application/ports/account-administration.port';
import {
  seedDevelopmentAdmin,
  DEVELOPMENT_ADMIN_EMAIL,
  DEVELOPMENT_ADMIN_PASSWORD,
} from '../../../prisma/seed-development-admin';
import { AdminModule } from '../../../libs/admin/src/admin.module';
import { DesignerModule } from '@app/designer';
import { PrismaService } from '@app/database';
import { JwtStrategy } from '@app/auth/infrastructure/strategies/jwt.strategy';
import { UserRole } from '@app/auth/domain/enums/user-role.enum';
import { SessionRevocationWorker } from '@app/auth/infrastructure/session-revocation.worker';
import { AccountAdministrationPort } from '@app/auth/application/ports/account-administration.port';
import { RefreshTokenRepository } from '@app/auth/domain/repositories/refresh-token.repository';
import { PrismaExecutionRepository } from '@app/execution/infrastructure/persistence/prisma-execution.repository';
import { ExecutionProcessor } from '@app/execution/infrastructure/queue/execution.processor';
import { WorkflowEngine } from '@app/execution/application/services/workflow-engine';
import {
  ExecutionStatus,
  TriggerType,
} from '@app/execution/domain/constants/execution.constants';
import type { QueuedExecutionJob } from '@app/execution/application/ports/execution-queue.port';
import type { Job } from 'bullmq';
import { QueryBus } from '@nestjs/cqrs';
import { SessionAccessPort } from '@app/auth/application/session-access.port';
import { ExecutionStreamService } from '@app/execution/application/services/execution-stream.service';
import { InMemoryExecutionEventPublisher } from '@app/execution/infrastructure/events/in-memory-execution-event.publisher';

type DashboardResult = Awaited<ReturnType<PrismaAdminRead['dashboard']>>;
function dataOf<T>(response: request.Response): T {
  return (response.body as { data: T }).data;
}
jest.setTimeout(120000);
describe('Admin P0 — PostgreSQL/Redis and HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let control: PrismaClient;
  let databaseName: string;
  let originalUrl: string | undefined;
  let adminId: string;
  let clientId: string;
  let adminToken: string;
  let clientToken: string;
  const password = 'AdminTest123!';
  const server = (): Server => app.getHttpServer() as Server;

  function deploy(schema: string) {
    const result = spawnSync(
      process.execPath,
      [
        resolve('node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        schema,
      ],
      { encoding: 'utf8', env: process.env },
    );
    if (result.status !== 0)
      throw new Error(
        'Test database migration failed: ' +
          result.stderr.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '<REDACTED>'),
      );
  }
  async function login(email: string) {
    const response = await request(server())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return dataOf<{ accessToken: string; refreshToken: string }>(response);
  }
  beforeAll(async () => {
    try {
      process.loadEnvFile();
    } catch {
      /* CI supplies env. */
    }
    originalUrl = process.env.DATABASE_URL;
    if (!originalUrl)
      throw new Error(
        'DATABASE_URL is required for isolated integration tests',
      );
    control = new PrismaClient({ datasources: { db: { url: originalUrl } } });
    databaseName = 'flowpilot_admin_test_' + randomUUID().replaceAll('-', '');
    await control.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    const testUrl = new URL(originalUrl);
    testUrl.pathname = '/' + databaseName;
    process.env.DATABASE_URL = testUrl.toString();
    // Rehearse the actual legacy migration, including user/workflow relationships.
    const temporary = mkdtempSync(
      join(tmpdir(), 'flowpilot-admin-migrations-'),
    );
    try {
      writeFileSync(
        join(temporary, 'schema.prisma'),
        readFileSync(resolve('prisma/schema.prisma')),
      );
      mkdirSync(join(temporary, 'migrations'));
      for (const entry of readdirSync(resolve('prisma/migrations'))) {
        if (entry !== '20261114000000_admin_p0')
          cpSync(
            join(resolve('prisma/migrations'), entry),
            join(temporary, 'migrations', entry),
            { recursive: true },
          );
      }
      deploy(join(temporary, 'schema.prisma'));
      const legacy = new PrismaClient({
        datasources: { db: { url: testUrl.toString() } },
      });
      const legacyId = randomUUID();
      const legacyWorkflowId = randomUUID();
      await legacy.$executeRaw`INSERT INTO users (id,email,password_hash,name,role,updated_at) VALUES (${legacyId}::uuid,'legacy@example.test','hash','Legacy','BUSINESS_USER',NOW())`;
      await legacy.$executeRaw`INSERT INTO users (id,email,password_hash,name,role,updated_at) VALUES (${randomUUID()}::uuid,'developer@example.test','hash','Developer','DEVELOPER',NOW())`;
      await legacy.$executeRaw`INSERT INTO workflows (id,name,owner_id,updated_at) VALUES (${legacyWorkflowId}::uuid,'Legacy workflow',${legacyId}::uuid,NOW())`;
      await legacy.$executeRaw`INSERT INTO users (id,email,password_hash,name,role,is_active,updated_at) VALUES (${randomUUID()}::uuid,'legacy-admin@example.test','hash','Legacy Admin','ADMIN',false,NOW())`;
      await legacy.$disconnect();
      deploy(resolve('prisma/schema.prisma'));
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
    const moduleRef = await Test.createTestingModule({
      imports: [AdminModule, DesignerModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(password, 4);
    adminId = randomUUID();
    clientId = randomUUID();
    await prisma.user.createMany({
      data: [
        {
          id: adminId,
          email: 'admin@example.test',
          name: 'Admin',
          passwordHash: hash,
          role: 'CLIENT',
        },
        {
          id: clientId,
          email: 'client@example.test',
          name: 'Client',
          passwordHash: hash,
          role: 'CLIENT',
        },
      ],
    });
    const bootstrap = spawnSync(
      process.execPath,
      [
        '-r',
        'ts-node/register',
        '-r',
        'tsconfig-paths/register',
        'scripts/bootstrap-admin.ts',
        'admin@example.test',
        'Initial test administrator',
      ],
      { encoding: 'utf8', env: process.env },
    );
    expect(bootstrap.status).toBe(0);
    const boot = await prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });
    expect(boot.role).toBe('ADMIN');
    const audit = await prisma.adminAuditEvent.findFirstOrThrow({
      where: { targetId: adminId, action: 'ADMIN_BOOTSTRAPPED' },
    });
    expect(audit.actorType).toBe('SYSTEM');
    expect(audit.actorId).toBeNull();
    await expect(
      app
        .get(AccountAdministrationPort)
        .bootstrap('client@example.test', 'Bootstrap should not repeat'),
    ).rejects.toThrow();
    adminToken = (await login('admin@example.test')).accessToken;
    clientToken = (await login('client@example.test')).accessToken;
  });
  afterAll(async () => {
    if (app) {
      const tokens = app.get(RefreshTokenRepository);
      const users = prisma
        ? await prisma.user.findMany({ select: { id: true } })
        : [];
      for (const user of users) await tokens.revoke(user.id);
      await app.close();
    }
    if (
      control &&
      databaseName &&
      /^flowpilot_admin_test_[a-f0-9]+$/.test(databaseName)
    ) {
      await control.$executeRawUnsafe(
        `DROP DATABASE "${databaseName}" WITH (FORCE)`,
      );
      await control.$disconnect();
    }
    if (originalUrl) process.env.DATABASE_URL = originalUrl;
  });
  it('preserves legacy ownership while converting role and default', async () => {
    const legacy = await prisma.user.findUniqueOrThrow({
      where: { email: 'legacy@example.test' },
      include: { ownedWorkflows: true },
    });
    expect(legacy.role).toBe('CLIENT');
    expect(legacy.ownedWorkflows).toHaveLength(1);
    expect(legacy.sessionVersion).toBe(0);
    const legacyAdmin = await prisma.user.findUniqueOrThrow({
      where: { email: 'legacy-admin@example.test' },
    });
    expect(legacyAdmin.role).toBe('ADMIN');
    expect(legacyAdmin.isActive).toBe(false);
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { email: 'developer@example.test' },
        })
      ).role,
    ).toBe('CLIENT');
  });
  it('preserves a suspended seeded account and its revision/session version across reseeding', async () => {
    const id = '00000000-0000-0000-0000-000000000000';
    await prisma.user.create({
      data: {
        id,
        email: 'system@flowpilot.local',
        name: 'System',
        passwordHash: 'hash',
        isActive: false,
        revision: 2,
        sessionVersion: 2,
      },
    });
    const seed = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register', 'prisma/seed.ts'],
      { encoding: 'utf8', env: process.env },
    );
    expect(seed.status).toBe(0);
    const owner = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(owner.isActive).toBe(false);
    expect(owner.revision).toBe(2);
    expect(owner.sessionVersion).toBe(2);
    expect(owner.passwordHash).toBe('hash');
  });
  it('requires Admin on every P0 endpoint and validates query/body fields', async () => {
    for (const path of [
      '/api/admin/users',
      '/api/admin/users/' + clientId,
      '/api/admin/users/' + clientId + '/workflows',
      '/api/admin/dashboard',
    ]) {
      await request(server()).get(path).expect(401);
      await request(server())
        .get(path)
        .auth(clientToken, { type: 'bearer' })
        .expect(403);
    }
    await request(server())
      .patch('/api/admin/users/' + adminId + '/role')
      .auth(clientToken, { type: 'bearer' })
      .send({ role: 'ADMIN', expectedRevision: 0, reason: 'Try escalation' })
      .expect(403);
    await request(server())
      .get('/api/admin/users?pageSize=101')
      .auth(adminToken, { type: 'bearer' })
      .expect(400);
    await request(server())
      .get('/api/admin/dashboard?timezone=INVALID')
      .auth(adminToken, { type: 'bearer' })
      .expect(400);
  });
  it('rejects registration role before creating a privileged user', async () => {
    for (const role of ['ADMIN', 'DEVELOPER', 'BUSINESS_USER', '', null]) {
      await request(server())
        .post('/api/auth/register')
        .send({ email: 'new@example.test', name: 'New', password, role })
        .expect(400);
    }
    expect(
      await prisma.user.count({ where: { email: 'new@example.test' } }),
    ).toBe(0);
  });
  it('rejects extra account mutation fields before global whitelisting can hide them', async () => {
    const target = await prisma.user.findUniqueOrThrow({
      where: { id: clientId },
    });
    await request(server())
      .patch(`/api/admin/users/${clientId}/active`)
      .auth(adminToken, { type: 'bearer' })
      .send({
        isActive: false,
        reason: 'Invalid extra fields',
        expectedRevision: target.revision,
        actorId: clientId,
      })
      .expect(400);
    await request(server())
      .patch(`/api/admin/users/${clientId}/role`)
      .auth(adminToken, { type: 'bearer' })
      .send({
        role: 'ADMIN',
        reason: 'Invalid extra fields',
        expectedRevision: target.revision,
        isActive: false,
      })
      .expect(400);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: clientId } }))
        .revision,
    ).toBe(target.revision);
  });
  it('allows same-role no-op and demotion for inactive Admins but rejects promotion while inactive', async () => {
    const target = await prisma.user.findUniqueOrThrow({
      where: { email: 'legacy-admin@example.test' },
    });
    const noop = await request(server())
      .patch(`/api/admin/users/${target.id}/role`)
      .auth(adminToken, { type: 'bearer' })
      .send({
        role: 'ADMIN',
        reason: 'Keep current inactive role',
        expectedRevision: 0,
      })
      .expect(200);
    expect(
      dataOf<{ auditEventId: string | null }>(noop).auditEventId,
    ).toBeNull();
    await request(server())
      .patch(`/api/admin/users/${target.id}/role`)
      .auth(adminToken, { type: 'bearer' })
      .send({
        role: 'CLIENT',
        reason: 'Demote inactive administrator',
        expectedRevision: 0,
      })
      .expect(200);
    await request(server())
      .patch(`/api/admin/users/${target.id}/role`)
      .auth(adminToken, { type: 'bearer' })
      .send({
        role: 'ADMIN',
        reason: 'Cannot promote inactive account',
        expectedRevision: 1,
      })
      .expect(409);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: target.id } }))
        .isActive,
    ).toBe(false);
  });
  it('denies old tokens without a session version', async () => {
    await expect(
      app.get(JwtStrategy).validate({
        sub: adminId,
        email: 'admin@example.test',
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow();
    const session = await login('admin@example.test');
    await request(server())
      .get('/api/admin/users')
      .auth(session.refreshToken, { type: 'bearer' })
      .expect(401);
  });
  it('returns only safe account metadata with filtering and pagination', async () => {
    const response = await request(server())
      .get('/api/admin/users?q=CLIENT&role=CLIENT&pageSize=1')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(dataOf<{ items: AccountSummary[] }>(response).items).toHaveLength(1);
    expect(dataOf<{ items: AccountSummary[] }>(response).items[0].email).toBe(
      'client@example.test',
    );
    expect(
      dataOf<{ items: AccountSummary[] }>(response).items[0],
    ).not.toHaveProperty('passwordHash');
    expect(
      dataOf<{ items: AccountSummary[] }>(response).items[0],
    ).not.toHaveProperty('sessionVersion');
  });
  it('prevents ownership bypass by either Client or Admin', async () => {
    const workflow = await prisma.workflow.findFirstOrThrow({
      where: { owner: { email: 'legacy@example.test' } },
    });
    for (const token of [adminToken, clientToken]) {
      await request(server())
        .get(`/api/workflows/${workflow.id}/draft`)
        .auth(token, { type: 'bearer' })
        .expect(403);
      await request(server())
        .get(`/api/workflows/${workflow.id}/versions`)
        .auth(token, { type: 'bearer' })
        .expect(403);
    }
    await request(server())
      .post('/api/workflows')
      .auth(clientToken, { type: 'bearer' })
      .send({ name: 'Spoof', ownerId: adminId })
      .expect(400);
  });
  it('serializes stale writes and revokes both access and refresh across unlock', async () => {
    const oldSession = await login('client@example.test');
    const changes = await Promise.all([
      request(server())
        .patch(`/api/admin/users/${clientId}/active`)
        .auth(adminToken, { type: 'bearer' })
        .send({
          isActive: false,
          reason: 'Suspend test account',
          expectedRevision: 0,
        }),
      request(server())
        .patch(`/api/admin/users/${clientId}/role`)
        .auth(adminToken, { type: 'bearer' })
        .send({
          role: 'ADMIN',
          reason: 'Concurrent role request',
          expectedRevision: 0,
        }),
    ]);
    expect(changes.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: clientId },
    });
    expect(user.revision).toBe(1);
    await request(server())
      .get('/api/auth/me')
      .auth(oldSession.accessToken, { type: 'bearer' })
      .expect(401);
    await request(server())
      .post('/api/auth/refresh')
      .send({ refreshToken: oldSession.refreshToken })
      .expect(401);
    // Restore Client/active with the latest revision; neither action resurrects old tokens.
    let revision = user.revision;
    if (!user.isActive) {
      await request(server())
        .patch(`/api/admin/users/${clientId}/active`)
        .auth(adminToken, { type: 'bearer' })
        .send({
          isActive: true,
          reason: 'Reactivate test account',
          expectedRevision: revision++,
        })
        .expect(200);
    }
    if (user.role === 'ADMIN') {
      await request(server())
        .patch(`/api/admin/users/${clientId}/role`)
        .auth(adminToken, { type: 'bearer' })
        .send({
          role: 'CLIENT',
          reason: 'Restore client role',
          expectedRevision: revision++,
        })
        .expect(200);
    }
    await request(server())
      .get('/api/auth/me')
      .auth(oldSession.accessToken, { type: 'bearer' })
      .expect(401);
    clientToken = (await login('client@example.test')).accessToken;
    await app.get(SessionRevocationWorker).flush();
    await request(server())
      .get('/api/auth/me')
      .auth(clientToken, { type: 'bearer' })
      .expect(200);
  });
  it('blocks self changes and concurrent loss of all active Admins', async () => {
    const manager = app.get(AccountAdministrationPort);
    await expect(
      manager.change({
        actorId: adminId,
        targetId: adminId,
        expectedRevision: 1,
        isActive: false,
        reason: 'Self suspend test',
      }),
    ).rejects.toThrow();
    const second = await prisma.user.create({
      data: {
        email: 'second-admin@example.test',
        name: 'Second',
        passwordHash: 'hash',
        role: 'ADMIN',
      },
    });
    const actor = await prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });
    const outcomes = await Promise.allSettled([
      manager.change({
        actorId: adminId,
        targetId: second.id,
        expectedRevision: 0,
        role: 'CLIENT',
        reason: 'Demote second administrator',
      }),
      manager.change({
        actorId: second.id,
        targetId: adminId,
        expectedRevision: actor.revision,
        role: 'CLIENT',
        reason: 'Demote first administrator',
      }),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      await prisma.user.count({ where: { role: 'ADMIN', isActive: true } }),
    ).toBe(1);
    // Preserve a stable actor for following scenarios, using test fixture setup only.
    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'ADMIN' },
    });
    await prisma.user.update({
      where: { id: second.id },
      data: { role: 'CLIENT' },
    });
    adminToken = (await login('admin@example.test')).accessToken;
  });
  it('rolls back account change if the audit insert fails and treats same-value as no-op', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: clientId },
    });
    await prisma.$executeRawUnsafe(
      "ALTER TABLE admin_audit_events ADD CONSTRAINT test_audit_failure CHECK (reason <> 'Force audit failure')",
    );
    try {
      await request(server())
        .patch(`/api/admin/users/${clientId}/active`)
        .auth(adminToken, { type: 'bearer' })
        .send({
          isActive: false,
          expectedRevision: user.revision,
          reason: 'Force audit failure',
        })
        .expect(500);
      const after = await prisma.user.findUniqueOrThrow({
        where: { id: clientId },
      });
      expect(after.revision).toBe(user.revision);
      expect(after.isActive).toBe(true);
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE admin_audit_events DROP CONSTRAINT test_audit_failure',
      );
    }
    const auditCount = await prisma.adminAuditEvent.count();
    const response = await request(server())
      .patch(`/api/admin/users/${clientId}/active`)
      .auth(adminToken, { type: 'bearer' })
      .send({
        isActive: true,
        expectedRevision: user.revision,
        reason: 'Same current value',
      })
      .expect(200);
    expect(
      dataOf<{ auditEventId: string | null }>(response).auditEventId,
    ).toBeNull();
    expect(await prisma.adminAuditEvent.count()).toBe(auditCount);
  });
  it('denies old access/refresh immediately during Redis cleanup failure and retries the outbox', async () => {
    const owner = await prisma.user.create({
      data: {
        email: 'outbox@example.test',
        name: 'Outbox',
        passwordHash: await bcrypt.hash(password, 4),
      },
    });
    const old = await login(owner.email);
    const tokens = app.get(RefreshTokenRepository);
    const cleanup = jest
      .spyOn(tokens, 'revokeBefore')
      .mockRejectedValue(new Error('Redis unavailable'));
    try {
      await app.get(AccountAdministrationPort).change({
        actorId: adminId,
        targetId: owner.id,
        expectedRevision: 0,
        isActive: false,
        reason: 'Suspend during Redis outage',
      });
      await app.get(SessionRevocationWorker).flush();
      expect(
        await prisma.sessionRevocation.count({
          where: { userId: owner.id, completedAt: null },
        }),
      ).toBe(1);
      await request(server())
        .get('/api/auth/me')
        .auth(old.accessToken, { type: 'bearer' })
        .expect(401);
      await request(server())
        .post('/api/auth/refresh')
        .send({ refreshToken: old.refreshToken })
        .expect(401);
    } finally {
      cleanup.mockRestore();
    }
    await app.get(SessionRevocationWorker).flush();
    expect(
      await prisma.sessionRevocation.count({
        where: { userId: owner.id, completedAt: null },
      }),
    ).toBe(0);
    expect(await tokens.validate(owner.id, old.refreshToken)).toBe(false);
  });
  it('closes an idle private stream on the next 15-second heartbeat after suspension', async () => {
    const owner = await prisma.user.create({
      data: {
        email: 'stream@example.test',
        name: 'Stream',
        passwordHash: 'hash',
      },
    });
    const query = {
      execute: jest.fn().mockResolvedValue({ status: 'RUNNING' }),
    } as unknown as QueryBus;
    const publisher = new InMemoryExecutionEventPublisher();
    const stream = new ExecutionStreamService(
      query,
      publisher,
      app.get(SessionAccessPort),
    );
    let snapshot!: () => void;
    const initial = new Promise<void>((resolve) => {
      snapshot = resolve;
    });
    let complete!: () => void;
    const closed = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const subscription = stream
      .createStream('test-stream', owner.id, 0)
      .subscribe({ next: snapshot, complete });
    try {
      await initial;
      const started = Date.now();
      await app.get(AccountAdministrationPort).change({
        actorId: adminId,
        targetId: owner.id,
        expectedRevision: 0,
        isActive: false,
        reason: 'Close suspended private stream',
      });
      await closed;
      expect(Date.now() - started).toBeLessThan(30000);
      expect(subscription.closed).toBe(true);
    } finally {
      subscription.unsubscribe();
    }
  });
  it('demotes an Admin, denies its old JWT and refresh, and gives its new login Client access', async () => {
    const target = await prisma.user.create({
      data: {
        email: 'demotion@example.test',
        name: 'Demoted',
        passwordHash: await bcrypt.hash(password, 4),
        role: 'ADMIN',
      },
    });
    const old = await login(target.email);
    await request(server())
      .patch(`/api/admin/users/${target.id}/role`)
      .auth(adminToken, { type: 'bearer' })
      .send({
        role: 'CLIENT',
        expectedRevision: 0,
        reason: 'Remove administrative access',
      })
      .expect(200);
    await request(server())
      .get('/api/admin/users')
      .auth(old.accessToken, { type: 'bearer' })
      .expect(401);
    await request(server())
      .post('/api/auth/refresh')
      .send({ refreshToken: old.refreshToken })
      .expect(401);
    const current = await login(target.email);
    await request(server())
      .get('/api/admin/users')
      .auth(current.accessToken, { type: 'bearer' })
      .expect(403);
    await request(server())
      .patch(`/api/admin/users/${target.id}/role`)
      .auth(adminToken, { type: 'bearer' })
      .send({
        role: 'CLIENT',
        expectedRevision: 0,
        reason: 'Retry old role revision',
      })
      .expect(409);
  });
  it('cancels queued runs before executor, leaves running work intact and never overwrites cancellation', async () => {
    const owner = await prisma.user.create({
      data: {
        email: 'runtime@example.test',
        name: 'Runtime',
        passwordHash: 'hash',
      },
    });
    const workflow = await prisma.workflow.create({
      data: { name: 'Runtime', ownerId: owner.id, active: true },
    });
    const version = await prisma.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        versionNumber: 1,
        publishedById: owner.id,
        definition: { nodes: [], edges: [] },
      },
    });
    const repository = new PrismaExecutionRepository(prisma);
    const queued = await repository.createExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
      triggeredById: null,
      triggerType: TriggerType.WEBHOOK,
      status: ExecutionStatus.QUEUED,
      queuedAt: new Date(),
      startedAt: null,
    });
    const running = await repository.createExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
      triggeredById: null,
      triggerType: TriggerType.WEBHOOK,
      status: ExecutionStatus.QUEUED,
      queuedAt: new Date(),
      startedAt: null,
    });
    await repository.claimQueuedExecution(running, new Date());
    await app.get(AccountAdministrationPort).change({
      actorId: adminId,
      targetId: owner.id,
      isActive: false,
      expectedRevision: 0,
      reason: 'Suspend runtime owner',
    });
    const engine = new WorkflowEngine(repository, []);
    const engineRun = jest.spyOn(engine, 'run');
    const processor = new ExecutionProcessor(repository, engine);
    const job = {
      data: {
        executionId: queued,
        workflowVersionId: version.id,
        triggerItems: [],
        queuedAt: new Date().toISOString(),
      },
    } as unknown as Job<QueuedExecutionJob>;
    expect(await processor.process(job)).toBe(ExecutionStatus.CANCELLED);
    expect(engineRun).not.toHaveBeenCalled();
    await repository.failUnfinishedExecution(queued, new Date());
    expect(
      (await prisma.execution.findUniqueOrThrow({ where: { id: queued } }))
        .cancellationReason,
    ).toBe('OWNER_SUSPENDED');
    expect(
      (await prisma.execution.findUniqueOrThrow({ where: { id: running } }))
        .status,
    ).toBe('RUNNING');
    await repository.finishExecution(
      running,
      ExecutionStatus.SUCCESS,
      new Date(),
      20,
    );
    expect(
      (await prisma.execution.findUniqueOrThrow({ where: { id: running } }))
        .status,
    ).toBe('SUCCESS');
    expect(
      (await prisma.workflow.findUniqueOrThrow({ where: { id: workflow.id } }))
        .active,
    ).toBe(true);
    await expect(
      repository.createExecution({
        workflowId: workflow.id,
        workflowVersionId: version.id,
        triggeredById: null,
        triggerType: TriggerType.WEBHOOK,
        status: ExecutionStatus.QUEUED,
        queuedAt: new Date(),
        startedAt: null,
      }),
    ).rejects.toThrow();
  });
  it('returns 75% for completed outcomes, counts automatic runs by owner, excludes end boundary and payloads', async () => {
    const workflow = await prisma.workflow.create({
      data: { name: 'Metrics', ownerId: clientId },
    });
    const version = await prisma.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        versionNumber: 1,
        publishedById: clientId,
        definition: { secret: 'CLIENT_PAYLOAD_MARKER' },
      },
    });
    const time = new Date('2026-11-01T17:00:00Z');
    await prisma.execution.createMany({
      data: [
        'SUCCESS',
        'SUCCESS',
        'SUCCESS',
        'FAILED',
        'CANCELLED',
        'CANCELLED',
        'RUNNING',
      ].map((status) => ({
        workflowId: workflow.id,
        workflowVersionId: version.id,
        triggerType: 'WEBHOOK' as const,
        status: status as 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'RUNNING',
        queuedAt: time,
        context: { secret: 'CLIENT_PAYLOAD_MARKER' },
      })),
    });
    await prisma.execution.create({
      data: {
        workflowId: workflow.id,
        workflowVersionId: version.id,
        triggerType: 'WEBHOOK',
        status: 'SUCCESS',
        queuedAt: new Date('2026-11-02T17:00:00Z'),
      },
    });
    await prisma.execution.updateMany({
      where: { workflowId: workflow.id, status: 'FAILED' },
      data: { errorCode: 'CLIENT_PAYLOAD_MARKER' },
    });
    const response = await request(server())
      .get('/api/admin/dashboard')
      .auth(adminToken, { type: 'bearer' })
      .query({
        from: '2026-11-01T17:00:00Z',
        to: '2026-11-02T17:00:00Z',
        timezone: 'Asia/Ho_Chi_Minh',
      })
      .expect(200);
    expect(dataOf<DashboardResult>(response).successRate).toBe(75);
    expect(dataOf<DashboardResult>(response).executions.SUCCESS).toBe(3);
    expect(dataOf<DashboardResult>(response).errors).toEqual([
      { code: 'UNCLASSIFIED_ERROR', count: 1 },
    ]);
    expect(
      dataOf<DashboardResult>(response).trend.every(
        (row: { day: string }) => row.day === '2026-11-02',
      ),
    ).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(
      'CLIENT_PAYLOAD_MARKER',
    );
    const user = await request(server())
      .get(`/api/admin/users/${clientId}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(
      dataOf<{ counts: { executions: number } }>(user).counts.executions,
    ).toBe(8);
    const empty = await request(server())
      .get('/api/admin/dashboard')
      .auth(adminToken, { type: 'bearer' })
      .query({ from: '2000-01-01T00:00:00Z', to: '2000-01-02T00:00:00Z' })
      .expect(200);
    expect(dataOf<DashboardResult>(empty).successRate).toBeNull();
  });
  it('serializes suspension with concurrent enqueue and queued claim on the owner row', async () => {
    const manager = app.get(AccountAdministrationPort);
    const owner = await prisma.user.create({
      data: { email: 'race@example.test', name: 'Race', passwordHash: 'hash' },
    });
    const workflow = await prisma.workflow.create({
      data: { name: 'Race', ownerId: owner.id },
    });
    const version = await prisma.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        versionNumber: 1,
        publishedById: owner.id,
        definition: { nodes: [], edges: [] },
      },
    });
    const repository = new PrismaExecutionRepository(prisma);
    const input = {
      workflowId: workflow.id,
      workflowVersionId: version.id,
      triggeredById: null,
      triggerType: TriggerType.WEBHOOK,
      status: ExecutionStatus.QUEUED as const,
      queuedAt: new Date(),
      startedAt: null,
    };
    const outcomes = await Promise.allSettled([
      manager.change({
        actorId: adminId,
        targetId: owner.id,
        expectedRevision: 0,
        isActive: false,
        reason: 'Suspend concurrent enqueue',
      }),
      repository.createExecution(input),
    ]);
    expect(outcomes[0].status).toBe('fulfilled');
    const enqueue = outcomes[1];
    if (enqueue.status === 'fulfilled') {
      expect(
        await repository.claimQueuedExecution(enqueue.value, new Date()),
      ).toBe(false);
      expect(
        (
          await prisma.execution.findUniqueOrThrow({
            where: { id: enqueue.value },
          })
        ).status,
      ).toBe('CANCELLED');
    }
    await manager.change({
      actorId: adminId,
      targetId: owner.id,
      expectedRevision: 1,
      isActive: true,
      reason: 'Restore owner for claim race',
    });
    const id = await repository.createExecution(input);
    const [claimed] = await Promise.all([
      repository.claimQueuedExecution(id, new Date()),
      manager.change({
        actorId: adminId,
        targetId: owner.id,
        expectedRevision: 2,
        isActive: false,
        reason: 'Suspend concurrent worker claim',
      }),
    ]);
    const execution = await prisma.execution.findUniqueOrThrow({
      where: { id },
    });
    expect(execution.status).toBe(claimed ? 'RUNNING' : 'CANCELLED');
    if (!claimed) {
      expect(execution.startedAt).toBeNull();
      expect(execution.cancellationReason).toBe('OWNER_SUSPENDED');
    }
  });
  it('creates a local Admin once with audit, skips production, and preserves later account changes', async () => {
    const previous = process.env.NODE_ENV;
    try {
      await prisma.user.updateMany({
        where: { role: 'ADMIN' },
        data: { isActive: false },
      });
      process.env.NODE_ENV = 'production';
      expect(await seedDevelopmentAdmin(prisma)).toBeNull();
      expect(
        await prisma.user.count({ where: { email: DEVELOPMENT_ADMIN_EMAIL } }),
      ).toBe(0);
      process.env.NODE_ENV = 'development';
      await Promise.all([
        seedDevelopmentAdmin(prisma),
        seedDevelopmentAdmin(prisma),
      ]);
      const admin = await prisma.user.findUniqueOrThrow({
        where: { email: DEVELOPMENT_ADMIN_EMAIL },
      });
      expect(admin.role).toBe('ADMIN');
      expect(admin.isActive).toBe(true);
      expect(
        await bcrypt.compare(DEVELOPMENT_ADMIN_PASSWORD, admin.passwordHash),
      ).toBe(true);
      expect(
        await prisma.adminAuditEvent.count({
          where: {
            targetId: admin.id,
            action: 'ADMIN_BOOTSTRAPPED',
            actorType: 'SYSTEM',
          },
        }),
      ).toBe(1);
      await request(server())
        .post('/api/auth/login')
        .send({
          email: DEVELOPMENT_ADMIN_EMAIL,
          password: DEVELOPMENT_ADMIN_PASSWORD,
        })
        .expect(200);
      await prisma.user.update({
        where: { id: admin.id },
        data: {
          role: 'CLIENT',
          isActive: false,
          passwordHash: 'changed-hash',
          revision: 3,
          sessionVersion: 3,
        },
      });
      await seedDevelopmentAdmin(prisma);
      const preserved = await prisma.user.findUniqueOrThrow({
        where: { id: admin.id },
      });
      expect(preserved.role).toBe('CLIENT');
      expect(preserved.isActive).toBe(false);
      expect(preserved.passwordHash).toBe('changed-hash');
      expect(preserved.revision).toBe(3);
      expect(preserved.sessionVersion).toBe(3);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });
});
