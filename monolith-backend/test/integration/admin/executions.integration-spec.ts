import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '@app/database';
import { UserRepository } from '@app/auth/domain/repositories/user.repository';
import { PrismaUserRepository } from '@app/auth/infrastructure/persistence/prisma-user.repository';
import { JwtStrategy } from '@app/auth/infrastructure/strategies/jwt.strategy';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@app/auth/infrastructure/guards/roles.guard';
import { AdminController } from '@app/admin/presentation/admin.controller';
import { AdminMutationFieldsGuard } from '@app/admin/presentation/admin-mutation-fields.guard';
import { AdminReadHandler } from '@app/admin/application/admin-read.query';
import { AdminReadPort } from '@app/admin/application/admin-read.port';
import { PrismaAdminRead } from '@app/admin/infrastructure/prisma-admin-read';

const testClient = (url: string) =>
  new PrismaClient({
    datasources: { db: { url } },
    log: [{ emit: 'event', level: 'query' }],
  });
function dataOf<T>(response: request.Response): T {
  return (response.body as { data: T }).data;
}
jest.setTimeout(120000);
describe('Admin executions — real JWT and isolated PostgreSQL', () => {
  let app: INestApplication | undefined;
  let prisma: ReturnType<typeof testClient>;
  let control: PrismaClient | undefined;
  let databaseName = '';
  let created = false;
  let ownerId: string;
  let adminId: string;
  let adminToken: string;
  let clientToken: string;
  const queries: string[] = [];
  const server = (): Server => {
    if (!app) throw new Error('Test application not initialized');
    return app.getHttpServer() as Server;
  };
  beforeAll(async () => {
    try {
      process.loadEnvFile();
    } catch {
      /* CI supplies environment directly. */
    }
    const sourceUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!sourceUrl)
      throw new Error('TEST_DATABASE_URL or DATABASE_URL is required');
    control = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
    databaseName = 'g6_executions_test_' + randomUUID().replaceAll('-', '');
    await control.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    const testUrl = new URL(sourceUrl);
    testUrl.pathname = '/' + databaseName;
    const deploy = spawnSync(
      process.execPath,
      [
        resolve('node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        resolve('prisma/schema.prisma'),
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: testUrl.toString() },
      },
    );
    if (deploy.status !== 0)
      throw new Error(
        'Isolated migration failed: ' +
          deploy.stderr.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '<REDACTED>'),
      );
    prisma = testClient(testUrl.toString());
    prisma.$on('query', (event) => queries.push(event.query));
    const module = await Test.createTestingModule({
      imports: [
        CqrsModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret:
            process.env.JWT_SECRET ||
            'flowpilot-secret-key-for-jwt-signing-minimum-32-chars',
        }),
      ],
      controllers: [AdminController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        AdminMutationFieldsGuard,
        { provide: UserRepository, useClass: PrismaUserRepository },
        AdminReadHandler,
        { provide: AdminReadPort, useClass: PrismaAdminRead },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    const admin = await prisma.user.create({
      data: {
        email: 'admin@g6.test',
        name: 'Admin',
        role: 'ADMIN',
        passwordHash: 'unused',
      },
    });
    const owner = await prisma.user.create({
      data: {
        email: 'owner@g6.test',
        name: 'Owner',
        role: 'CLIENT',
        passwordHash: 'unused',
      },
    });
    adminId = admin.id;
    ownerId = owner.id;
    const jwt = app.get(JwtService);
    adminToken = jwt.sign({
      sub: admin.id,
      role: admin.role,
      email: admin.email,
      sessionVersion: admin.sessionVersion,
    });
    clientToken = jwt.sign({
      sub: owner.id,
      role: owner.role,
      email: owner.email,
      sessionVersion: owner.sessionVersion,
    });
  });
  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    if (
      control &&
      created &&
      /^g6_executions_test_[a-f0-9]{32}$/.test(databaseName)
    ) {
      await control.$executeRaw`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${databaseName} AND pid <> pg_backend_pid()`;
      await control.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    }
    await control?.$disconnect();
  });
  const range = { from: '2026-11-01T00:00:00Z', to: '2026-11-02T00:00:00Z' };
  async function fixture(owner = ownerId) {
    const workflow = await prisma.workflow.create({
      data: { name: 'G6 workflow', ownerId: owner },
    });
    const version = await prisma.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        versionNumber: 3,
        publishedById: owner,
        definition: { prompt: 'PRIVATE_SENTINEL' },
      },
    });
    return { workflowId: workflow.id, workflowVersionId: version.id };
  }
  it('BDD-EM-01/05: filters automatic executions by workflow owner with server pagination', async () => {
    const reference = await fixture();
    const matched = await prisma.execution.create({
      data: {
        ...reference,
        triggerType: 'WEBHOOK',
        status: 'FAILED',
        triggeredById: null,
        queuedAt: new Date(range.from),
        context: { secret: 'PRIVATE_SENTINEL' },
      },
    });
    await prisma.execution.create({
      data: {
        ...(await fixture(adminId)),
        triggerType: 'WEBHOOK',
        status: 'FAILED',
        queuedAt: new Date(range.from),
      },
    });
    const response = await request(server())
      .get('/api/admin/executions')
      .auth(adminToken, { type: 'bearer' })
      .query({
        ...range,
        ownerId,
        workflowId: reference.workflowId,
        executionId: matched.id,
        status: 'FAILED',
        triggerType: 'WEBHOOK',
        page: 1,
        pageSize: 1,
      })
      .expect(200);
    expect(
      dataOf<{
        items: {
          id: string;
          ownerId: string;
          versionId: string;
          versionNumber: number;
        }[];
        total: number;
        page: number;
        pageSize: number;
      }>(response),
    ).toEqual({
      items: [
        expect.objectContaining({
          id: matched.id,
          ownerId,
          versionId: reference.workflowVersionId,
          versionNumber: 3,
        }),
      ],
      total: 1,
      page: 1,
      pageSize: 1,
    });
  });
  it('BDD-EM-04/06: returns safe detail, stored retries and nullable timing without querying private columns', async () => {
    const reference = await fixture();
    const execution = await prisma.execution.create({
      data: {
        ...reference,
        triggerType: 'WEBHOOK',
        status: 'FAILED',
        queuedAt: new Date(range.from),
        context: { prompt: 'PRIVATE_SENTINEL' },
        errorCode: 'PRIVATE_SENTINEL',
      },
    });
    await prisma.executionNodeLog.create({
      data: {
        executionId: execution.id,
        nodeId: 'later',
        nodeKey: 'integration.http',
        status: 'TIMEOUT',
        retryCount: 3,
        startedAt: new Date('2026-11-01T01:00:00Z'),
        input: { token: 'PRIVATE_SENTINEL' },
        output: { message: 'PRIVATE_SENTINEL' },
        errorMessage: 'PRIVATE_SENTINEL',
        errorStack: 'PRIVATE_SENTINEL',
        errorCode: 'PRIVATE_SENTINEL',
      },
    });
    await prisma.executionNodeLog.create({
      data: {
        executionId: execution.id,
        nodeId: 'earlier',
        nodeKey: 'trigger.webhook',
        status: 'SUCCESS',
        durationMs: 0,
        startedAt: new Date(range.from),
        finishedAt: new Date(range.from),
      },
    });
    queries.length = 0;
    const response = await request(server())
      .get('/api/admin/executions/' + execution.id)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(
      dataOf<{
        errorCode: string;
        startedAt: null;
        durationMs: null;
        nodeLogs: { nodeId: string }[];
      }>(response),
    ).toMatchObject({
      versionId: reference.workflowVersionId,
      errorCode: 'UNCLASSIFIED_ERROR',
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      nodeLogs: [
        {
          nodeId: 'earlier',
          status: 'SUCCESS',
          durationMs: 0,
          errorCode: null,
        },
        {
          nodeId: 'later',
          status: 'TIMEOUT',
          retryCount: 3,
          finishedAt: null,
          durationMs: null,
          errorCode: 'UNCLASSIFIED_ERROR',
        },
      ],
    });
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_SENTINEL');
    expect(queries.some((sql) => sql.includes('execution_node_logs'))).toBe(
      true,
    );
    expect(queries.join('\n')).not.toMatch(
      /"(?:input|output|context|definition|error_message|error_stack)"/,
    );
  });
  it('BDD-EM-01/02/04: applies half-open boundaries and stable ordering across pages with safe list projection', async () => {
    const reference = await fixture();
    const firstId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const secondId = '00000000-0000-4000-8000-000000000001';
    for (const id of [secondId, firstId]) {
      await prisma.execution.create({
        data: {
          ...reference,
          id,
          triggerType: 'SCHEDULE',
          status: 'SUCCESS',
          queuedAt: new Date(range.from),
          errorCode: 'PRIVATE_SENTINEL',
          context: { secret: 'PRIVATE_SENTINEL' },
        },
      });
    }
    await prisma.execution.create({
      data: {
        ...reference,
        triggerType: 'SCHEDULE',
        queuedAt: new Date(range.to),
      },
    });
    queries.length = 0;
    const page1 = await request(server())
      .get('/api/admin/executions')
      .auth(adminToken, { type: 'bearer' })
      .query({ ...range, workflowId: reference.workflowId, pageSize: 1 })
      .expect(200);
    const page2 = await request(server())
      .get('/api/admin/executions')
      .auth(adminToken, { type: 'bearer' })
      .query({
        ...range,
        workflowId: reference.workflowId,
        page: 2,
        pageSize: 1,
      })
      .expect(200);
    expect(
      dataOf<{ items: { id: string }[]; total: number }>(page1),
    ).toMatchObject({ items: [{ id: firstId, errorCode: null }], total: 2 });
    expect(
      dataOf<{ items: { id: string }[]; total: number }>(page2),
    ).toMatchObject({ items: [{ id: secondId }], total: 2 });
    expect(JSON.stringify(page1.body)).not.toContain('PRIVATE_SENTINEL');
    expect(queries.join('\n')).not.toMatch(
      /"(?:input|output|context|definition|error_message|error_stack)"/,
    );
    const excluded = await request(server())
      .get('/api/admin/executions')
      .auth(adminToken, { type: 'bearer' })
      .query({
        ...range,
        workflowId: reference.workflowId,
        triggerType: 'MANUAL',
      })
      .expect(200);
    expect(dataOf<{ items: unknown[]; total: number }>(excluded)).toMatchObject(
      { items: [], total: 0 },
    );
  });
  it('BDD-EM-06/09: preserves queued timing, safe cancellation reasons and not-found semantics', async () => {
    const reference = await fixture();
    const queued = await prisma.execution.create({
      data: {
        ...reference,
        triggerType: 'MANUAL',
        status: 'QUEUED',
        queuedAt: new Date('2000-01-01T00:00:00Z'),
      },
    });
    const response = await request(server())
      .get('/api/admin/executions/' + queued.id)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(dataOf<unknown>(response)).toMatchObject({
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      errorCode: null,
      nodeLogs: [],
    });
    for (const reason of ['OWNER_SUSPENDED', 'PRIVATE_SENTINEL']) {
      await prisma.execution.update({
        where: { id: queued.id },
        data: { status: 'CANCELLED', cancellationReason: reason },
      });
      const cancelled = await request(server())
        .get('/api/admin/executions/' + queued.id)
        .auth(adminToken, { type: 'bearer' })
        .expect(200);
      expect(
        dataOf<{ cancellationReason: string }>(cancelled).cancellationReason,
      ).toBe(
        reason === 'OWNER_SUSPENDED'
          ? 'OWNER_SUSPENDED'
          : 'UNCLASSIFIED_REASON',
      );
      expect(JSON.stringify(cancelled.body)).not.toContain('PRIVATE_SENTINEL');
    }
    await request(server())
      .get('/api/admin/executions/' + randomUUID())
      .auth(adminToken, { type: 'bearer' })
      .expect(404);
  });
  it('BDD-EM-08: protects both endpoints and rechecks current role and session', async () => {
    const id = randomUUID();
    for (const endpoint of [
      '/api/admin/executions',
      '/api/admin/executions/' + id,
    ]) {
      await request(server()).get(endpoint).expect(401);
      await request(server())
        .get(endpoint)
        .auth(clientToken, { type: 'bearer' })
        .expect(403);
    }
    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'CLIENT' },
    });
    for (const endpoint of [
      '/api/admin/executions',
      '/api/admin/executions/' + id,
    ]) {
      await request(server())
        .get(endpoint)
        .auth(adminToken, { type: 'bearer' })
        .expect(403);
    }
    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'ADMIN', sessionVersion: { increment: 1 } },
    });
    for (const endpoint of [
      '/api/admin/executions',
      '/api/admin/executions/' + id,
    ]) {
      await request(server())
        .get(endpoint)
        .auth(adminToken, { type: 'bearer' })
        .expect(401);
    }
  });
});
