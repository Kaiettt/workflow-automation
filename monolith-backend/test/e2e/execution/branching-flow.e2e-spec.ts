/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
// Real HTTP, Postgres, Redis and BullMQ worker: a workflow with a Switch is
// saved with its output connections, published and run; only the branch the
// message matches runs, the other ones are logged as skipped.
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DesignerModule } from '@app/designer';
import { PrismaModule } from '@app/database';
import { PrismaService } from '@app/database/prisma/prisma.service';
import { ExecutionModule } from '@app/execution';
import { TriggersModule } from '@app/triggers';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';

describe('Branching workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ownerId = '00000000-0000-0000-0000-000000000001';

  const server = () =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  const setNode = (id: string, name: string, reply: string) => ({
    id,
    type: 'actionNode',
    data: {
      key: 'data.set',
      name,
      config: { fields: [{ name: 'reply', value: reply }] },
    },
  });

  const definition = {
    nodes: [
      {
        id: 'hook',
        type: 'triggerNode',
        data: { key: 'webhook.trigger', name: 'Incoming', config: {} },
      },
      {
        id: 'route',
        type: 'actionNode',
        data: {
          key: 'logic.switch',
          name: 'Route',
          config: {
            rules: [
              {
                id: 'price',
                label: 'Price',
                conditions: [
                  {
                    value1: '{{$json.body.text}}',
                    operator: 'contains',
                    value2: 'giá',
                  },
                ],
              },
            ],
          },
        },
      },
      setNode('priceReply', 'Price reply', 'Bảng giá ở đây ạ'),
      setNode('otherReply', 'Other reply', 'Bạn nói: {{$json.body.text}}'),
    ],
    edges: [
      { id: 'e1', source: 'hook', target: 'route' },
      {
        id: 'e2',
        source: 'route',
        sourceHandle: 'out:rule_price',
        target: 'priceReply',
      },
      {
        id: 'e3',
        source: 'route',
        sourceHandle: 'out:fallback',
        target: 'otherReply',
      },
    ],
  };

  async function finished(executionId: string) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
        include: { nodeLogs: true },
      });
      if (execution && execution.status !== 'RUNNING') return execution;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`execution ${executionId} did not finish`);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, DesignerModule, ExecutionModule, TriggersModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: ownerId, email: 'branching-e2e@flowpilot.local' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.upsert({
      where: { id: ownerId },
      update: {},
      create: {
        id: ownerId,
        email: 'branching-e2e@flowpilot.local',
        passwordHash: 'dummy',
        name: 'Branching E2E User',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs only the branch a message matches', async () => {
    const created = await request(server())
      .post('/api/workflows')
      .send({ name: 'Branching e2e', ownerId })
      .expect(201);
    const workflowId = created.body.data.id as string;

    await request(server())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({ definition })
      .expect(200);
    const published = await request(server())
      .post(`/api/workflows/${workflowId}/versions`)
      .expect(201);
    expect(published.body.data.versionId).toBeDefined();
    await request(server())
      .post(`/api/workflows/${workflowId}/activate`)
      .expect(200);

    const hooks = await request(server())
      .get(`/api/workflows/${workflowId}/webhooks`)
      .expect(200);
    const path = new URL(hooks.body.data[0].url as string).pathname;

    const price = await request(server())
      .post(path)
      .send({ text: 'Cho xin bảng GIÁ' })
      .expect(202);
    const other = await request(server())
      .post(path)
      .send({ text: 'xin chào' })
      .expect(202);

    const priceRun = await finished(price.body.data.started[0] as string);
    const otherRun = await finished(other.body.data.started[0] as string);
    const status = (run: typeof priceRun, nodeId: string) =>
      run.nodeLogs.find((log) => log.nodeId === nodeId)?.status;
    const output = (run: typeof priceRun, nodeId: string) =>
      (
        run.nodeLogs.find((log) => log.nodeId === nodeId)?.output as Array<{
          json: Record<string, unknown>;
        }>
      )?.[0]?.json.reply;

    expect(priceRun.status).toBe('SUCCESS');
    expect(status(priceRun, 'priceReply')).toBe('SUCCESS');
    expect(output(priceRun, 'priceReply')).toBe('Bảng giá ở đây ạ');
    expect(status(priceRun, 'otherReply')).toBe('SKIPPED');

    expect(otherRun.status).toBe('SUCCESS');
    expect(status(otherRun, 'priceReply')).toBe('SKIPPED');
    expect(output(otherRun, 'otherReply')).toBe('Bạn nói: xin chào');
  });

  it('refuses to publish a connection from a deleted rule', async () => {
    const created = await request(server())
      .post('/api/workflows')
      .send({ name: 'Branching dangling e2e', ownerId })
      .expect(201);
    const workflowId = created.body.data.id as string;
    const dangling = {
      ...definition,
      edges: [
        ...definition.edges.slice(0, 1),
        {
          id: 'e2',
          source: 'route',
          sourceHandle: 'out:rule_gone',
          target: 'priceReply',
        },
        definition.edges[2],
      ],
    };
    await request(server())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({ definition: dangling })
      .expect(200);

    const res = await request(server())
      .post(`/api/workflows/${workflowId}/versions`)
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('UNKNOWN_OUTPUT');
  });
});
