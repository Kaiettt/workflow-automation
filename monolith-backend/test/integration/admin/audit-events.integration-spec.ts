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
import { ConnectorPolicyPort } from '@app/connector/application/ports/connector-policy.port';
import { PrismaConnectorPolicyRepository } from '@app/connector/infrastructure/persistence/prisma-connector-policy.repository';
import { ChangeConnectorPolicyHandler } from '@app/connector/application/commands/change-connector-policy.command';

const testClient = (url: string) =>
  new PrismaClient({
    datasources: { db: { url } },
    log: [{ emit: 'event', level: 'query' }],
  });
function dataOf<T>(response: request.Response): T {
  return (response.body as { data: T }).data;
}
jest.setTimeout(120000);
describe('Admin audit events — real JWT and isolated PostgreSQL', () => {
  let app: INestApplication | undefined;
  let prisma: ReturnType<typeof testClient>;
  let control: PrismaClient | undefined;
  let databaseName = '';
  let created = false;
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
    databaseName = 'g7_audit_test_' + randomUUID().replaceAll('-', '');
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
        ChangeConnectorPolicyHandler,
        {
          provide: ConnectorPolicyPort,
          useClass: PrismaConnectorPolicyRepository,
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    const admin = await prisma.user.create({
      data: {
        email: 'admin@g7.test',
        name: 'Admin',
        role: 'ADMIN',
        passwordHash: 'unused',
      },
    });
    const client = await prisma.user.create({
      data: {
        email: 'client@g7.test',
        name: 'Client',
        role: 'CLIENT',
        passwordHash: 'unused',
      },
    });
    adminId = admin.id;
    const jwt = app.get(JwtService);
    adminToken = jwt.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      sessionVersion: admin.sessionVersion,
    });
    clientToken = jwt.sign({
      sub: client.id,
      email: client.email,
      role: client.role,
      sessionVersion: client.sessionVersion,
    });
  });
  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    if (
      control &&
      created &&
      /^g7_audit_test_[a-f0-9]{32}$/.test(databaseName)
    ) {
      await control.$executeRaw`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${databaseName} AND pid <> pg_backend_pid()`;
      await control.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    }
    await control?.$disconnect();
  });
  const range = { from: '2026-11-01T00:00:00Z', to: '2026-11-02T00:00:00Z' };
  it('BDD-AL-01/02/04: filters and paginates metadata using current actor/target names', async () => {
    const target = await prisma.user.create({
      data: { email: 'target@g7.test', name: 'Target', passwordHash: 'unused' },
    });
    const event = await prisma.adminAuditEvent.create({
      data: {
        actorType: 'ADMIN',
        actorId: adminId,
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: target.id,
        reason: 'Maintenance window',
        before: { isActive: true },
        after: { isActive: false },
        createdAt: new Date(range.from),
      },
    });
    const response = await request(server())
      .get('/api/admin/audit-events')
      .auth(adminToken, { type: 'bearer' })
      .query({
        ...range,
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: target.id,
        pageSize: 1,
      })
      .expect(200);
    expect(
      dataOf<{
        items: { id: string; actorName: string; targetName: string }[];
        total: number;
      }>(response),
    ).toMatchObject({
      items: [
        {
          id: event.id,
          actorName: 'Admin',
          actorEmail: 'admin@g7.test',
          targetName: 'Target',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 1,
    });
    expect(
      dataOf<{ items: Record<string, unknown>[] }>(response).items[0],
    ).not.toHaveProperty('before');
    expect(
      dataOf<{ items: Record<string, unknown>[] }>(response).items[0],
    ).not.toHaveProperty('after');
  });
  it('BDD-AL-04/05/09: projects historical snapshots and preserves SYSTEM events without target metadata', async () => {
    const event = await prisma.adminAuditEvent.create({
      data: {
        actorType: 'SYSTEM',
        actorId: null,
        action: 'ADMIN_BOOTSTRAPPED',
        targetType: 'USER',
        targetId: randomUUID(),
        reason: 'Initial Admin bootstrap',
        before: {},
        after: { role: 'ADMIN', isActive: true, secret: 'PRIVATE_SENTINEL' },
        createdAt: new Date(range.from),
      },
    });
    const response = await request(server())
      .get('/api/admin/audit-events/' + event.id)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(dataOf<unknown>(response)).toMatchObject({
      actorType: 'SYSTEM',
      actorId: null,
      actorName: null,
      actorEmail: null,
      targetName: null,
      before: {},
      after: { role: 'ADMIN', isActive: true },
    });
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_SENTINEL');
    expect(
      dataOf<{ after: Record<string, unknown> }>(response).after,
    ).not.toHaveProperty('secret');
  });
  it('BDD-AL-01/02: applies half-open boundaries and stable order across pages without loading snapshots', async () => {
    const targetId = randomUUID();
    for (const id of [
      '00000000-0000-4000-8000-000000000001',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
    ]) {
      await prisma.adminAuditEvent.create({
        data: {
          id,
          actorType: 'ADMIN',
          actorId: adminId,
          action: 'USER_REACTIVATED',
          targetType: 'USER',
          targetId,
          reason: 'Restore account access',
          before: { secret: 'PRIVATE_SENTINEL' },
          after: { isActive: true },
          createdAt: new Date(range.from),
        },
      });
    }
    await prisma.adminAuditEvent.create({
      data: {
        actorType: 'ADMIN',
        action: 'USER_REACTIVATED',
        targetType: 'USER',
        targetId,
        reason: 'Excluded end boundary',
        before: {},
        after: {},
        createdAt: new Date(range.to),
      },
    });
    queries.length = 0;
    const first = await request(server())
      .get('/api/admin/audit-events')
      .auth(adminToken, { type: 'bearer' })
      .query({ ...range, targetId, pageSize: 1 })
      .expect(200);
    const second = await request(server())
      .get('/api/admin/audit-events')
      .auth(adminToken, { type: 'bearer' })
      .query({ ...range, targetId, pageSize: 1, page: 2 })
      .expect(200);
    expect(dataOf<unknown>(first)).toMatchObject({
      items: [{ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }],
      total: 2,
    });
    expect(dataOf<unknown>(second)).toMatchObject({
      items: [{ id: '00000000-0000-4000-8000-000000000001' }],
      total: 2,
    });
    expect(queries.join('\n')).not.toMatch(
      /"(?:before|after|definition|encrypted_secret)"/,
    );
    expect(JSON.stringify(first.body)).not.toContain('PRIVATE_SENTINEL');
  });
  it('BDD-AL-04/05/09: supports six actions, legacy missing fields, current metadata and unknown records safely', async () => {
    const node = await prisma.nodeTypeDefinition.create({
      data: {
        key: 'logic.g7.test',
        displayName: 'Policy node',
        category: 'LOGIC',
        configSchema: {},
      },
    });
    const cases = [
      {
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        before: { role: 'CLIENT', isActive: true },
        after: { isActive: false, role: 'CLIENT' },
      },
      {
        action: 'USER_REACTIVATED',
        targetType: 'USER',
        before: { isActive: false },
        after: { isActive: true },
      },
      {
        action: 'USER_ROLE_CHANGED',
        targetType: 'USER',
        before: { role: 'CLIENT' },
        after: { role: 'ADMIN' },
      },
      {
        action: 'ADMIN_BOOTSTRAPPED',
        targetType: 'USER',
        before: { role: 'CLIENT', isActive: true },
        after: { role: 'ADMIN', isActive: true },
      },
      {
        action: 'CONNECTOR_POLICY_CHANGED',
        targetType: 'CONNECTOR',
        before: { allowNewCredentials: true, revision: 0 },
        after: { allowNewCredentials: false, revision: 1 },
      },
      {
        action: 'NODE_TYPE_STATUS_CHANGED',
        targetType: 'NODE_TYPE',
        before: {
          isCatalogVisible: true,
          isExecutionAllowed: true,
          revision: 0,
        },
        after: {
          isCatalogVisible: false,
          isExecutionAllowed: null,
          revision: 1,
        },
      },
    ];
    for (const item of cases) {
      const event = await prisma.adminAuditEvent.create({
        data: {
          ...item,
          actorType: 'ADMIN',
          actorId: adminId,
          targetId: item.targetType === 'NODE_TYPE' ? node.id : randomUUID(),
          reason: 'Audit projection test',
          before: {
            ...item.before,
            key: 'PRIVATE_SENTINEL',
            token: 'PRIVATE_SENTINEL',
          },
          after: { ...item.after, credential: 'PRIVATE_SENTINEL' },
        },
      });
      const response = await request(server())
        .get('/api/admin/audit-events/' + event.id)
        .auth(adminToken, { type: 'bearer' })
        .expect(200);
      expect(
        dataOf<{ before: unknown; after: unknown }>(response),
      ).toMatchObject({
        action: item.action,
        before: item.before,
        after: item.after,
      });
      expect(JSON.stringify(response.body)).not.toContain('PRIVATE_SENTINEL');
      if (item.targetType === 'NODE_TYPE')
        expect(dataOf<{ targetName: string }>(response).targetName).toBe(
          'Policy node',
        );
    }
    const unknown = await prisma.adminAuditEvent.create({
      data: {
        actorType: 'PRIVATE_SENTINEL',
        actorId: randomUUID(),
        action: 'PRIVATE_SENTINEL',
        targetType: 'PRIVATE_SENTINEL',
        targetId: randomUUID(),
        reason: 'Unsupported historical record',
        before: { role: 'PRIVATE_SENTINEL' },
        after: { isActive: 'PRIVATE_SENTINEL' },
      },
    });
    const response = await request(server())
      .get('/api/admin/audit-events/' + unknown.id)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(dataOf<unknown>(response)).toMatchObject({
      actorType: 'UNKNOWN',
      actorName: null,
      targetType: 'UNKNOWN',
      action: 'UNKNOWN_ACTION',
      before: {},
      after: {},
    });
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_SENTINEL');
  });
  it('BDD-AL-05: rejects wrong scalar types even in fields with supported names', async () => {
    const event = await prisma.adminAuditEvent.create({
      data: {
        actorType: 'ADMIN',
        actorId: adminId,
        action: 'USER_ROLE_CHANGED',
        targetType: 'USER',
        targetId: randomUUID(),
        reason: 'Historical scalar validation',
        before: { role: null, isActive: false, revision: false },
        after: {
          role: 'PRIVATE_SENTINEL',
          isActive: 'PRIVATE_SENTINEL',
          revision: -1,
        },
      },
    });
    const response = await request(server())
      .get('/api/admin/audit-events/' + event.id)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    const detail = dataOf<{ before: unknown; after: unknown }>(response);
    expect(detail.before).toEqual({ role: null, isActive: false });
    expect(detail.after).toEqual({});
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_SENTINEL');
  });
  it('BDD-AL-08/10: connector mutations write audit atomically, exclude no-op/stale requests and roll back audit failures', async () => {
    const connector = await prisma.connector.create({
      data: {
        key: 'g7.connector',
        name: 'Audit connector',
        authType: 'NONE',
        configSchema: {},
      },
    });
    const endpoint =
      '/api/admin/connectors/' + connector.id + '/credential-policy';
    await request(server())
      .patch(endpoint)
      .auth(adminToken, { type: 'bearer' })
      .send({
        allowNewCredentials: false,
        expectedRevision: 0,
        reason: 'Pause new credentials',
      })
      .expect(200);
    const list = await request(server())
      .get('/api/admin/audit-events')
      .auth(adminToken, { type: 'bearer' })
      .query({ targetId: connector.id })
      .expect(200);
    const audit = dataOf<{ items: { id: string }[]; total: number }>(list);
    expect(audit.total).toBe(1);
    const detail = await request(server())
      .get('/api/admin/audit-events/' + audit.items[0].id)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(dataOf<unknown>(detail)).toMatchObject({
      action: 'CONNECTOR_POLICY_CHANGED',
      targetName: 'Audit connector',
      before: { allowNewCredentials: true, revision: 0 },
      after: { allowNewCredentials: false, revision: 1 },
    });
    await request(server())
      .patch(endpoint)
      .auth(adminToken, { type: 'bearer' })
      .send({
        allowNewCredentials: false,
        expectedRevision: 1,
        reason: 'Keep current policy',
      })
      .expect(200);
    await request(server())
      .patch(endpoint)
      .auth(adminToken, { type: 'bearer' })
      .send({
        allowNewCredentials: false,
        expectedRevision: 0,
        reason: 'Stale policy request',
      })
      .expect(409);
    await request(server())
      .patch(endpoint)
      .auth(clientToken, { type: 'bearer' })
      .send({
        allowNewCredentials: true,
        expectedRevision: 1,
        reason: 'Unauthorized policy request',
      })
      .expect(403);
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION g7_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason = 'G7 reject audit' THEN RAISE EXCEPTION 'test audit rejection'; END IF; RETURN NEW; END $$`,
    );
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER g7_reject_audit BEFORE INSERT ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION g7_reject_audit()',
    );
    try {
      await request(server())
        .patch(endpoint)
        .auth(adminToken, { type: 'bearer' })
        .send({
          allowNewCredentials: true,
          expectedRevision: 1,
          reason: 'G7 reject audit',
        })
        .expect(500);
      const policy = await request(server())
        .get('/api/admin/connectors/' + connector.id)
        .auth(adminToken, { type: 'bearer' })
        .expect(200);
      expect(dataOf<unknown>(policy)).toMatchObject({
        allowNewCredentials: false,
        revision: 1,
      });
      const remaining = await request(server())
        .get('/api/admin/audit-events')
        .auth(adminToken, { type: 'bearer' })
        .query({ targetId: connector.id })
        .expect(200);
      expect(dataOf<{ total: number }>(remaining).total).toBe(1);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER g7_reject_audit ON admin_audit_events',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION g7_reject_audit()');
    }
  });
  it('BDD-AL-07/11: protects reads, current sessions and exposes no audit mutation endpoints', async () => {
    const event = await prisma.adminAuditEvent.create({
      data: {
        actorType: 'SYSTEM',
        action: 'ADMIN_BOOTSTRAPPED',
        targetType: 'USER',
        targetId: randomUUID(),
        reason: 'Initial account creation',
        before: {},
        after: {},
      },
    });
    for (const endpoint of [
      '/api/admin/audit-events',
      '/api/admin/audit-events/' + event.id,
    ]) {
      await request(server()).get(endpoint).expect(401);
      await request(server())
        .get(endpoint)
        .auth(clientToken, { type: 'bearer' })
        .expect(403);
      await request(server())
        .post(endpoint)
        .auth(adminToken, { type: 'bearer' })
        .send({ reason: 'Tamper attempt' })
        .expect(404);
      await request(server())
        .put(endpoint)
        .auth(adminToken, { type: 'bearer' })
        .send({ reason: 'Tamper attempt' })
        .expect(404);
      await request(server())
        .patch(endpoint)
        .auth(adminToken, { type: 'bearer' })
        .send({ reason: 'Tamper attempt' })
        .expect(404);
      await request(server())
        .delete(endpoint)
        .auth(adminToken, { type: 'bearer' })
        .expect(404);
    }
    await request(server())
      .get('/api/admin/audit-events/' + randomUUID())
      .auth(adminToken, { type: 'bearer' })
      .expect(404);
    const subject = await prisma.user.create({
      data: {
        email: 'revoked@g7.test',
        name: 'Revoked Admin',
        role: 'ADMIN',
        passwordHash: 'unused',
      },
    });
    if (!app) throw new Error('Test application not initialized');
    const token = app.get(JwtService).sign({
      sub: subject.id,
      email: subject.email,
      role: subject.role,
      sessionVersion: subject.sessionVersion,
    });
    await prisma.user.update({
      where: { id: subject.id },
      data: { role: 'CLIENT' },
    });
    for (const endpoint of [
      '/api/admin/audit-events',
      '/api/admin/audit-events/' + event.id,
    ])
      await request(server())
        .get(endpoint)
        .auth(token, { type: 'bearer' })
        .expect(403);
    await prisma.user.update({
      where: { id: subject.id },
      data: { role: 'ADMIN', sessionVersion: { increment: 1 } },
    });
    for (const endpoint of [
      '/api/admin/audit-events',
      '/api/admin/audit-events/' + event.id,
    ])
      await request(server())
        .get(endpoint)
        .auth(token, { type: 'bearer' })
        .expect(401);
  });
});
