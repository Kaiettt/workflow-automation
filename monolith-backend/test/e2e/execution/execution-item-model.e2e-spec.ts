/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { PrismaModule } from '@app/database';
import { PrismaService } from '@app/database/prisma/prisma.service';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import { ExecutionModule } from '@app/execution';
import { NodeLibraryModule } from '@app/node-library';
import { NodeCatalogPort } from '@app/execution/application/ports/node-catalog.port';

// Runs real workflows through POST /api/executions against the real module wiring
// and database. Only nodes that need no external service are used.
describe('Execution item model (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ownerId = randomUUID();
  const workflowIds: string[] = [];

  const getServer = () =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  async function publish(definition: unknown): Promise<string> {
    const workflow = await prisma.workflow.create({
      data: { name: `e2e item model ${randomUUID()}`, ownerId },
    });
    workflowIds.push(workflow.id);
    const version = await prisma.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        versionNumber: 1,
        definition: definition as object,
        publishedById: ownerId,
      },
    });
    return version.id;
  }

  async function run(definition: unknown) {
    const versionId = await publish(definition);
    const res = await request(getServer())
      .post('/api/executions')
      .send({ workflow_version_id: versionId })
      .expect(201);
    return res.body.data as {
      status: string;
      nodeLogs: Array<{
        nodeKey: string;
        status: string;
        input: unknown;
        output: any;
        errorMessage: string | null;
      }>;
    };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, NodeLibraryModule, ExecutionModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: ownerId, email: 'e2e-item-model@flowpilot.local' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `e2e-item-model-${ownerId}@flowpilot.local`,
        passwordHash: 'dummy',
        name: 'E2E Item Model',
      },
    });
  });

  afterAll(async () => {
    // Remove everything this suite created so the shared dev database stays clean.
    await prisma.execution.deleteMany({
      where: { workflowId: { in: workflowIds } },
    });
    await prisma.workflowVersion.deleteMany({
      where: { workflowId: { in: workflowIds } },
    });
    await prisma.workflow.deleteMany({ where: { id: { in: workflowIds } } });
    await prisma.user.delete({ where: { id: ownerId } });
    await app.close();
  });

  it('reads node config schemas from the catalog through the node-library query', async () => {
    const catalog = app.get(NodeCatalogPort, { strict: false });
    const schemas = await catalog.getConfigSchemas([
      'integration.gmail.send',
      'logic.filter',
      'does.not.exist',
    ]);

    expect([...schemas.keys()].sort()).toEqual([
      'integration.gmail.send',
      'logic.filter',
    ]);
    const gmail = schemas.get('integration.gmail.send') as any;
    expect(gmail.properties.to.default).toBe('{{$json.email}}');
    expect(gmail.properties.subject['x-allowExpression']).toBe(true);
  });

  it('runs a workflow made of items: trigger -> aggregate -> aggregate', async () => {
    const result = await run({
      nodes: [
        {
          id: 't',
          type: 'trigger.manual',
          data: { key: 'trigger.manual', name: 'Start', config: {} },
        },
        {
          id: 'a1',
          type: 'data.aggregate',
          data: {
            key: 'data.aggregate',
            name: 'First',
            config: { field: 'rows' },
          },
        },
        {
          id: 'a2',
          type: 'data.aggregate',
          data: { key: 'data.aggregate', name: 'Second', config: {} },
        },
      ],
      edges: [
        { id: 'e1', source: 't', target: 'a1' },
        { id: 'e2', source: 'a1', target: 'a2' },
      ],
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.nodeLogs.map((log) => log.nodeKey)).toEqual([
      'trigger.manual',
      'data.aggregate',
      'data.aggregate',
    ]);
    expect(result.nodeLogs[0].output).toEqual([{ json: {} }]);
    expect(result.nodeLogs[1].output).toEqual([{ json: { rows: [{}] } }]);
    // Second uses the default field name from its config.
    expect(result.nodeLogs[2].output).toEqual([
      { json: { items: [{ rows: [{}] }] } },
    ]);
  });

  it('records a failed node with its reason and stops the run', async () => {
    const result = await run({
      nodes: [
        {
          id: 't',
          type: 'trigger.manual',
          data: { key: 'trigger.manual', name: 'Start', config: {} },
        },
        {
          id: 'g',
          type: 'integration.gmail.send',
          data: {
            key: 'integration.gmail.send',
            name: 'Send',
            config: { credential_id: 'not-a-uuid', subject: 's', body: 'b' },
          },
        },
        {
          id: 'a',
          type: 'data.aggregate',
          data: { key: 'data.aggregate', name: 'After', config: {} },
        },
      ],
      edges: [
        { id: 'e1', source: 't', target: 'g' },
        { id: 'e2', source: 'g', target: 'a' },
      ],
    });

    expect(result.status).toBe('FAILED');
    expect(result.nodeLogs).toHaveLength(2);
    expect(result.nodeLogs[1].status).toBe('FAILED');
    expect(result.nodeLogs[1].errorMessage).toContain('Invalid credential ID');
  });

  it('rejects a credential that does not exist for the caller', async () => {
    const result = await run({
      nodes: [
        {
          id: 't',
          type: 'trigger.manual',
          data: { key: 'trigger.manual', name: 'Start', config: {} },
        },
        {
          id: 'g',
          type: 'integration.gmail.send',
          data: {
            key: 'integration.gmail.send',
            name: 'Send',
            config: { credential_id: randomUUID(), subject: 's', body: 'b' },
          },
        },
      ],
      edges: [{ id: 'e1', source: 't', target: 'g' }],
    });

    expect(result.status).toBe('FAILED');
    expect(result.nodeLogs[1].errorMessage).toContain(
      'credential was not found',
    );
  });
});
