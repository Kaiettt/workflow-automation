import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CqrsModule, QueryBus } from '@nestjs/cqrs';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaClient, WorkflowStatus } from '@prisma/client';
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
import type {
  NodeTypeAdminDetail,
  NodeTypeAdminPage,
} from '@app/admin/application/node-type-admin.types';
import {
  NodeTypePolicyPort,
  ChangeNodeTypeStatusHandler,
} from '@app/node-library';
import { PrismaNodeTypePolicyRepository } from '@app/node-library/infrastructure/persistence/prisma-node-type-policy.repository';
import { NodeTypeDefinitionRepository } from '@app/node-library/domain/repositories/node-type-definition.repository';
import { PrismaNodeTypeDefinitionRepository } from '@app/node-library/infrastructure/persistence/prisma-node-type-definition.repository';
import { NodeTypesController } from '@app/node-library/presentation/http/node-types.controller';
import { GetNodeTypesHandler } from '@app/node-library/application/queries/get-node-types.query';
import { GetNodeMetadataHandler } from '@app/node-library/application/queries/get-node-metadata.query';
import { GetNodeConfigSchemasHandler } from '@app/node-library/application/queries/get-node-config-schemas.query';
import { PackageCatalogSync } from '@app/node-library/infrastructure/package-catalog.sync';
import { PackageRegistry } from '@app/apps';
import { createMessengerPackage } from '@app/apps/messenger/messenger.package';
import { FakeMetaGraph } from '@test/support/apps/fake-meta-graph';
import { PrismaExecutionRepository } from '@app/execution/infrastructure/persistence/prisma-execution.repository';
import { NodeRunner } from '@app/execution/application/services/node-runner';
import { NodeExecutionObserver } from '@app/execution/application/services/node-execution-observer';
import { WorkflowEngine } from '@app/execution/application/services/workflow-engine';
import { NodeCatalogAdapter } from '@app/execution/infrastructure/adapters/node-catalog.adapter';
import {
  ExecutionStatus,
  TriggerType,
} from '@app/execution/domain/constants/execution.constants';

import { WorkflowDraftsController } from '@app/designer/presentation/http/workflow-drafts.controller';
import { SaveDraftHandler } from '@app/designer/application/commands/save-draft.command';
import { GetWorkflowDraftHandler } from '@app/designer/application/queries/get-workflow-draft.query';
import { WorkflowOwnershipGuard } from '@app/designer/infrastructure/workflow-ownership.guard';
import { WorkflowRepository } from '@app/designer/domain/repositories/workflow.repository';
import { WorkflowDraftRepository } from '@app/designer/domain/repositories/workflow-draft.repository';
import { PrismaWorkflowRepository } from '@app/designer/infrastructure/persistence/prisma-workflow.repository';
import { PrismaWorkflowDraftRepository } from '@app/designer/infrastructure/persistence/prisma-workflow-draft.repository';

function dataOf<T>(response: request.Response): T {
  return (response.body as { data: T }).data;
}
jest.setTimeout(120000);
describe('Node types — isolated PostgreSQL, real JWT and HTTP', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let control: PrismaClient | undefined;
  let databaseName: string;
  let created = false;
  let adminId: string;
  let adminToken: string;
  let clientToken: string;
  const server = (): Server => {
    if (!app) throw new Error('Test application was not initialized');
    return app.getHttpServer() as Server;
  };
  beforeAll(async () => {
    try {
      process.loadEnvFile();
    } catch {
      /* CI may supply configuration directly. */
    }
    const sourceUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!sourceUrl)
      throw new Error('TEST_DATABASE_URL or DATABASE_URL is required');
    control = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
    databaseName = 'g5_node_types_test_' + randomUUID().replaceAll('-', '');
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
    prisma = new PrismaService({
      datasources: { db: { url: testUrl.toString() } },
    });
    const secret =
      process.env.JWT_SECRET ||
      'flowpilot-secret-key-for-jwt-signing-minimum-32-chars';
    const module = await Test.createTestingModule({
      imports: [
        CqrsModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret }),
      ],
      controllers: [
        AdminController,
        NodeTypesController,
        WorkflowDraftsController,
      ],
      providers: [
        { provide: PrismaService, useValue: prisma },
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        AdminMutationFieldsGuard,
        { provide: UserRepository, useClass: PrismaUserRepository },
        SaveDraftHandler,
        GetWorkflowDraftHandler,
        WorkflowOwnershipGuard,
        { provide: WorkflowRepository, useClass: PrismaWorkflowRepository },
        {
          provide: WorkflowDraftRepository,
          useClass: PrismaWorkflowDraftRepository,
        },
        AdminReadHandler,
        { provide: AdminReadPort, useClass: PrismaAdminRead },
        ChangeNodeTypeStatusHandler,
        {
          provide: NodeTypePolicyPort,
          useClass: PrismaNodeTypePolicyRepository,
        },
        GetNodeTypesHandler,
        GetNodeMetadataHandler,
        GetNodeConfigSchemasHandler,
        {
          provide: NodeTypeDefinitionRepository,
          useClass: PrismaNodeTypeDefinitionRepository,
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    const admin = await prisma.user.create({
      data: {
        email: 'admin@g5.test',
        name: 'Admin',
        role: 'ADMIN',
        passwordHash: 'unused',
      },
    });
    const client = await prisma.user.create({
      data: {
        email: 'client@g5.test',
        name: 'Client',
        role: 'CLIENT',
        passwordHash: 'unused',
      },
    });
    adminId = admin.id;
    const jwt = app.get(JwtService);
    adminToken = jwt.sign({
      sub: admin.id,
      role: admin.role,
      email: admin.email,
      sessionVersion: admin.sessionVersion,
    });
    clientToken = jwt.sign({
      sub: client.id,
      role: client.role,
      email: client.email,
      sessionVersion: client.sessionVersion,
    });
  });
  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    if (
      control &&
      created &&
      /^g5_node_types_test_[a-f0-9]{32}$/.test(databaseName)
    ) {
      await control.$executeRaw`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${databaseName} AND pid <> pg_backend_pid()`;
      await control.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    }
    await control?.$disconnect();
  });
  const auth = () => 'Bearer ' + adminToken;
  async function createType() {
    return prisma.nodeTypeDefinition.create({
      data: {
        key: 'logic.g5.' + randomUUID(),
        displayName: 'G5 test node',
        category: 'LOGIC',
        configSchema: { type: 'object', properties: {} },
      },
    });
  }
  async function createWorkflow(
    status: WorkflowStatus,
    keys: string[],
    historicalKeys?: string[],
  ) {
    const workflow = await prisma.workflow.create({
      data: { name: 'G5 workflow', ownerId: adminId, status },
    });
    const definition = {
      nodes: keys.map((key, index) => ({
        id: 'node-' + index,
        data: { key, config: {}, name: 'Node ' + index },
      })),
      edges: keys.length > 1 ? [{ source: 'node-0', target: 'node-1' }] : [],
    };
    await prisma.workflowDraft.create({
      data: { workflowId: workflow.id, definition },
    });
    if (historicalKeys)
      await prisma.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          versionNumber: 1,
          publishedById: adminId,
          definition: {
            nodes: historicalKeys.map((key) => ({ data: { key } })),
          },
        },
      });
    if (status !== 'DRAFT') {
      const version = await prisma.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          versionNumber: historicalKeys ? 2 : 1,
          publishedById: adminId,
          definition,
        },
      });
      await prisma.workflow.update({
        where: { id: workflow.id },
        data: { currentVersionId: version.id },
      });
      return { workflow, version };
    }
    return { workflow, version: null };
  }
  const change = (key: string, body: object) =>
    request(server())
      .patch('/api/admin/node-types/' + encodeURIComponent(key) + '/status')
      .set('Authorization', auth())
      .send(body);

  it('counts current distinct usage, excludes history/archives, bounds and sanitizes detail (BDD-NM-01)', async () => {
    const node = await createType();
    await createWorkflow('PUBLISHED', [node.key, node.key]);
    await createWorkflow('PUBLISHED', ['other'], [node.key]);
    await createWorkflow('ARCHIVED', [node.key]);
    await createWorkflow('DRAFT', [node.key, node.key]);
    const published = await createWorkflow('PUBLISHED', ['other']);
    await prisma.workflowDraft.update({
      where: { workflowId: published.workflow.id },
      data: { definition: { nodes: [{ data: { key: node.key } }] } },
    });
    const list = dataOf<NodeTypeAdminPage>(
      await request(server())
        .get('/api/admin/node-types')
        .query({
          q: node.key,
          pageSize: 1,
          category: 'LOGIC',
          sortBy: 'updatedAt',
          sortOrder: 'desc',
        })
        .set('Authorization', auth())
        .expect(200),
    );
    expect(list).toMatchObject({ total: 1, page: 1, pageSize: 1 });
    expect(list.items[0]).toMatchObject({
      publishedWorkflowCount: 1,
      draftWorkflowCount: 1,
      revision: 0,
      isCatalogVisible: true,
      isExecutionAllowed: true,
    });
    for (let i = 0; i < 11; i++) await createWorkflow('DRAFT', [node.key]);
    const detail = dataOf<NodeTypeAdminDetail>(
      await request(server())
        .get('/api/admin/node-types/' + node.key)
        .set('Authorization', auth())
        .expect(200),
    );
    expect(detail.workflows).toHaveLength(10);
    expect(Object.keys(detail.workflows[0]).sort()).toEqual([
      'id',
      'name',
      'ownerEmail',
      'status',
    ]);
    expect(detail.draftWorkflowCount).toBe(12);
  });
  it('supports connector/policy filters, literal search and stable sorting (BDD-NM-01)', async () => {
    const prefix = 'filters.' + randomUUID();
    const connector = await prisma.connector.create({
      data: {
        key: prefix,
        name: 'Filter connector',
        authType: 'NONE',
        configSchema: {},
      },
    });
    const first = await prisma.nodeTypeDefinition.create({
      data: {
        key: prefix + '.a',
        displayName: 'Equal',
        category: 'AI',
        configSchema: {},
        connectorId: connector.id,
      },
    });
    const second = await prisma.nodeTypeDefinition.create({
      data: {
        key: prefix + '.b',
        displayName: 'Equal',
        category: 'AI',
        configSchema: {},
      },
    });
    await change(first.key, {
      isCatalogVisible: false,
      isExecutionAllowed: false,
      reason: 'Filter policy test',
      expectedRevision: 0,
    }).expect(200);
    const list = async (filter: object) =>
      dataOf<NodeTypeAdminPage>(
        await request(server())
          .get('/api/admin/node-types')
          .set('Authorization', auth())
          .query({ q: prefix, ...filter })
          .expect(200),
      );
    expect(
      (
        await list({ isCatalogVisible: true, isExecutionAllowed: true })
      ).items.map((node) => node.key),
    ).toEqual([second.key]);
    expect(
      (
        await list({
          connectorId: connector.id,
          category: 'AI',
          isCatalogVisible: false,
          isExecutionAllowed: false,
        })
      ).items.map((node) => node.key),
    ).toEqual([first.key]);
    const ascending = await list({ pageSize: 1, page: 1 });
    const page2 = await list({ pageSize: 1, page: 2 });
    expect(ascending.total).toBe(2);
    expect(ascending.items[0].key).toBe(first.key);
    expect(page2.items[0].key).toBe(second.key);
    const latest = await list({ sortBy: 'updatedAt', sortOrder: 'desc' });
    expect(latest.items[0].key).toBe(first.key);
    expect((await list({ q: prefix + "%' OR true --" })).total).toBe(0);
  });
  it('updates both flags atomically, rejects stale no-op, preserves real no-op (BDD-NM-05/06/07)', async () => {
    const node = await createType();
    const body = {
      isCatalogVisible: false,
      isExecutionAllowed: false,
      reason: 'Scheduled maintenance',
      expectedRevision: 0,
    };
    await change(node.key, body).expect(200);
    const stale = await change(node.key, body).expect(409);
    expect((stale.body as { code: string }).code).toBe('STALE_REVISION');
    await change(node.key, { ...body, expectedRevision: 1 }).expect(200);
    await change(node.key, {
      isCatalogVisible: true,
      expectedRevision: 1,
      reason: 'Restore palette only',
    }).expect(200);
    const policy = await prisma.nodeTypePolicy.findUniqueOrThrow({
      where: { nodeTypeKey: node.key },
    });
    expect(policy).toMatchObject({
      isCatalogVisible: true,
      isExecutionAllowed: false,
      revision: 2,
    });
    const audits = await prisma.adminAuditEvent.findMany({
      where: { targetId: node.id },
    });
    expect(audits).toHaveLength(2);
    expect(audits[0]).toMatchObject({
      actorId: adminId,
      action: 'NODE_TYPE_STATUS_CHANGED',
      targetType: 'NODE_TYPE',
    });
  });
  it('allows one concurrent revision update and rolls back on audit failure (BDD-NM-06/08)', async () => {
    const node = await createType();
    const body = {
      isExecutionAllowed: false,
      reason: 'Concurrent update test',
      expectedRevision: 0,
    };
    const results = await Promise.all([
      change(node.key, body),
      change(node.key, body),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const rollback = await createType();
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION g5_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason = 'reject-audit-for-test' THEN RAISE EXCEPTION 'test audit rejection'; END IF; RETURN NEW; END $$`,
    );
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER g5_reject_audit BEFORE INSERT ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION g5_reject_audit()',
    );
    try {
      await change(rollback.key, {
        ...body,
        reason: 'reject-audit-for-test',
      }).expect(500);
      expect(
        await prisma.nodeTypePolicy.findUnique({
          where: { nodeTypeKey: rollback.key },
        }),
      ).toBeNull();
      expect(
        await prisma.adminAuditEvent.count({
          where: { targetId: rollback.id },
        }),
      ).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER g5_reject_audit ON admin_audit_events',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION g5_reject_audit()');
    }
  });
  it('hides palette nodes, preserves metadata/runtime compatibility, blocks runtime and survives sync (BDD-NM-02/03/04)', async () => {
    if (!app) throw new Error('Test app missing');
    const registry = new PackageRegistry([
      createMessengerPackage(new FakeMetaGraph()),
    ]);
    const sync = new PackageCatalogSync(prisma, registry);
    await sync.sync();
    const key = registry.allNodes()[0].key;
    await change(key, {
      isCatalogVisible: false,
      reason: 'Hide package node',
      expectedRevision: 0,
    }).expect(200);
    const palette = dataOf<{ key: string }[]>(
      await request(server()).get('/api/node-types').expect(200),
    );
    expect(palette.some((node) => node.key === key)).toBe(false);
    const metadata = dataOf<{ key: string; isCatalogVisible: boolean }[]>(
      await request(server())
        .get('/api/node-types/metadata')
        .query({ keys: key })
        .set('Authorization', 'Bearer ' + clientToken)
        .expect(200),
    );
    expect(metadata[0]).toMatchObject({ key, isCatalogVisible: false });
    const runtime = await createWorkflow('PUBLISHED', [key, key]);
    if (!runtime.version) throw new Error('Published version required');
    const draftResponse = await request(server())
      .get('/api/workflows/' + runtime.workflow.id + '/draft')
      .set('Authorization', auth())
      .expect(200);
    const savedDefinition = dataOf<{ definition: unknown }>(
      draftResponse,
    ).definition;
    await request(server())
      .put('/api/workflows/' + runtime.workflow.id + '/draft')
      .set('Authorization', auth())
      .send({ definition: savedDefinition })
      .expect(200);
    const repo = new PrismaExecutionRepository(prisma);
    const execute = jest.fn(() =>
      Promise.resolve([{ json: { success: true } }]),
    );
    const policy = app.get(NodeTypePolicyPort);
    const runner = NodeRunner.create(
      repo,
      [{ key, runMode: 'once', parseConfig: (raw) => raw, execute }],
      undefined,
      policy,
    );
    const engine = new WorkflowEngine(
      repo,
      new NodeCatalogAdapter(app.get(QueryBus)),
      runner,
      new NodeExecutionObserver(repo),
    );
    const version = {
      id: runtime.version.id,
      workflowId: runtime.workflow.id,
      workflowOwnerId: adminId,
      definition: runtime.version.definition,
    };
    const startedAt = new Date();
    const input = {
      version,
      triggerType: TriggerType.MANUAL,
      triggeredById: adminId,
      triggerItems: [],
    };
    const firstId = await engine.createExecution(input, startedAt);
    expect(await engine.run(firstId, version, [], startedAt)).toBe(
      ExecutionStatus.SUCCESS,
    );
    await change(key, {
      isExecutionAllowed: false,
      reason: 'Disable runtime node',
      expectedRevision: 1,
    }).expect(200);
    execute.mockClear();
    const secondId = await engine.createExecution(input, new Date());
    expect(await engine.run(secondId, version, [], new Date())).toBe(
      ExecutionStatus.FAILED,
    );
    expect(execute).not.toHaveBeenCalled();
    expect(
      await prisma.executionNodeLog.findFirst({
        where: { executionId: secondId },
      }),
    ).toMatchObject({ status: 'FAILED', errorCode: 'NODE_TYPE_DISABLED' });
    await sync.sync();
    expect(await policy.isExecutionAllowed(key)).toBe(false);
    expect(
      await prisma.nodeTypePolicy.findUnique({ where: { nodeTypeKey: key } }),
    ).toMatchObject({
      isCatalogVisible: false,
      isExecutionAllowed: false,
      revision: 2,
    });
  });
  it('enforces real JWT roles, raw field whitelist, boolean and revision input (BDD-NM-09)', async () => {
    const node = await createType();
    await request(server()).get('/api/admin/node-types').expect(401);
    await request(server())
      .get('/api/admin/node-types')
      .set('Authorization', 'Bearer ' + clientToken)
      .expect(403);
    const valid = {
      isCatalogVisible: false,
      reason: 'Input validation test',
      expectedRevision: 0,
    };
    for (const invalid of [
      { ...valid, isCatalogVisible: null },
      { ...valid, expectedRevision: -1 },
      { ...valid, adminId },
      { reason: valid.reason, expectedRevision: 0 },
    ])
      await change(node.key, invalid).expect(400);
    await request(server())
      .get('/api/admin/node-types')
      .query({ pageSize: 101 })
      .set('Authorization', auth())
      .expect(400);
    await change('missing-key', valid).expect(404);
    expect(
      await prisma.nodeTypePolicy.findUnique({
        where: { nodeTypeKey: node.key },
      }),
    ).toBeNull();
  });
});
