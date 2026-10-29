/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
// Real HTTP, Postgres, Redis and BullMQ worker: a POST to the webhook URL must
// return at once and the run must finish in the background.
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DesignerModule } from '@app/designer';
import { PrismaModule } from '@app/database';
import { PrismaService } from '@app/database/prisma/prisma.service';
import { ExecutionModule } from '@app/execution';
import { TriggersModule } from '@app/triggers';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';

describe('Webhook trigger (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ownerId = '00000000-0000-0000-0000-000000000000';

  const server = () =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  const definition = (filterValue: string) => ({
    nodes: [
      {
        id: 'hook',
        type: 'triggerNode',
        data: { key: 'trigger.webhook', name: 'Incoming', config: {} },
      },
      {
        id: 'filter',
        type: 'actionNode',
        data: {
          key: 'logic.filter',
          name: 'Urgent only',
          config: {
            field: 'body.priority',
            operator: 'equals',
            value: filterValue,
          },
        },
      },
    ],
    edges: [{ id: 'e1', source: 'hook', target: 'filter' }],
  });

  async function publish(workflowId: string, filterValue: string) {
    await request(server())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({ definition: definition(filterValue) })
      .expect(200);
    const res = await request(server())
      .post(`/api/workflows/${workflowId}/versions`)
      .expect(201);
    return res.body.data.versionId as string;
  }

  // The trigger listeners are stored by an event handler after publish.
  async function webhookUrl(workflowId: string, versionId: string) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const res = await request(server())
        .get(`/api/workflows/${workflowId}/triggers`)
        .expect(200);
      const active = await prisma.workflowTrigger.findFirst({
        where: { workflowId, isActive: true },
      });
      if (active?.workflowVersionId === versionId && res.body.data[0]) {
        return new URL(res.body.data[0].webhookUrl as string).pathname;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('webhook trigger was never registered');
  }

  async function finished(executionId: string) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
        include: { nodeLogs: { orderBy: { startedAt: 'asc' } } },
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
          req.user = { id: ownerId, email: 'webhook-e2e@flowpilot.local' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.upsert({
      where: { id: ownerId },
      update: {},
      create: {
        id: ownerId,
        email: 'webhook-e2e@flowpilot.local',
        passwordHash: 'dummy',
        name: 'Webhook E2E User',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs the published version in the background when the URL is called', async () => {
    const created = await request(server())
      .post('/api/workflows')
      .send({ name: 'Webhook e2e', ownerId })
      .expect(201);
    const workflowId = created.body.data.id as string;

    const v1 = await publish(workflowId, 'urgent');
    const path = await webhookUrl(workflowId, v1);

    const res = await request(server())
      .post(`${path}?source=form`)
      .set('Authorization', 'Bearer should-not-be-logged')
      .send({ priority: 'urgent', email: 'kiet@gmail.com' })
      .expect(202);
    expect(res.body.data.duplicate).toBe(false);

    const execution = await finished(res.body.data.executionId as string);
    expect(execution.status).toBe('SUCCESS');
    expect(execution.triggerType).toBe('WEBHOOK');
    expect(execution.triggeredById).toBeNull();
    expect(execution.workflowVersionId).toBe(v1);
    expect(execution.nodeLogs.map((log) => log.nodeKey)).toEqual([
      'trigger.webhook',
      'logic.filter',
    ]);
    const filterOutput = execution.nodeLogs[1].output as Array<{
      json: { body: unknown; query: unknown; headers: Record<string, string> };
    }>;
    expect(filterOutput).toHaveLength(1);
    expect(filterOutput[0].json.body).toEqual({
      priority: 'urgent',
      email: 'kiet@gmail.com',
    });
    expect(filterOutput[0].json.query).toEqual({ source: 'form' });
    expect(filterOutput[0].json.headers.authorization).toBeUndefined();

    // Re-publishing keeps the URL; the next call runs the new version.
    const v2 = await publish(workflowId, 'low');
    expect(await webhookUrl(workflowId, v2)).toBe(path);
    const second = await request(server())
      .post(path)
      .send({ priority: 'urgent' })
      .expect(202);
    const run2 = await finished(second.body.data.executionId as string);
    expect(run2.workflowVersionId).toBe(v2);
    expect(run2.nodeLogs[1].output).toEqual([]);
  });

  it('starts a single run for retries carrying the same Idempotency-Key', async () => {
    const created = await request(server())
      .post('/api/workflows')
      .send({ name: 'Webhook idempotency e2e', ownerId })
      .expect(201);
    const workflowId = created.body.data.id as string;
    const path = await webhookUrl(
      workflowId,
      await publish(workflowId, 'urgent'),
    );
    const key = `order-${Date.now()}`;

    const first = await request(server())
      .post(path)
      .set('Idempotency-Key', key)
      .send({ priority: 'urgent' })
      .expect(202);
    const retry = await request(server())
      .post(path)
      .set('Idempotency-Key', key)
      .send({ priority: 'urgent' })
      .expect(202);

    expect(first.body.data.duplicate).toBe(false);
    expect(retry.body.data).toEqual({ executionId: null, duplicate: true });
    await finished(first.body.data.executionId as string);
  });

  it('answers 404 for an unknown webhook token', async () => {
    await request(server())
      .post('/api/webhooks/w/not-a-real-token')
      .send({})
      .expect(404);
  });
});
