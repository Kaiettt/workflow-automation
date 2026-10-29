/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
// Real HTTP, Postgres, Redis and BullMQ worker: the Webhook package's node has
// its own URL, listens only while the workflow is active, and a POST returns
// at once while the run finishes in the background.
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
        data: { key: 'webhook.trigger', name: 'Incoming', config: {} },
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

  async function saveDraft(workflowId: string, filterValue: string) {
    await request(server())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({ definition: definition(filterValue) })
      .expect(200);
  }

  async function publish(workflowId: string, filterValue: string) {
    await saveDraft(workflowId, filterValue);
    const res = await request(server())
      .post(`/api/workflows/${workflowId}/versions`)
      .expect(201);
    return res.body.data as {
      versionId: string;
      activation?: { active: boolean; error?: string };
    };
  }

  async function webhookPath(workflowId: string) {
    const res = await request(server())
      .get(`/api/workflows/${workflowId}/webhooks`)
      .expect(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ nodeId: 'hook', scope: 'node' }),
    ]);
    return new URL(res.body.data[0].url as string).pathname;
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

  async function createWorkflow(name: string) {
    const created = await request(server())
      .post('/api/workflows')
      .send({ name, ownerId })
      .expect(201);
    return created.body.data.id as string;
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

    app = moduleFixture.createNestApplication({ rawBody: true });
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

  it('has a URL before publishing and runs the active version in the background', async () => {
    const workflowId = await createWorkflow('Webhook e2e');
    await saveDraft(workflowId, 'urgent');
    const path = await webhookPath(workflowId);
    expect(path).toMatch(/^\/api\/webhooks\/[0-9a-f-]{36}$/);

    // Not active yet: nobody listens.
    await request(server()).post(path).send({ priority: 'urgent' }).expect(404);
    await request(server())
      .post(`/api/workflows/${workflowId}/activate`)
      .expect(400);

    const v1 = await publish(workflowId, 'urgent');
    expect(v1.activation).toBeUndefined(); // publishing does not turn it on
    await request(server()).post(path).send({}).expect(404);

    const activated = await request(server())
      .post(`/api/workflows/${workflowId}/activate`)
      .expect(200);
    expect(activated.body.data).toEqual({
      active: true,
      versionId: v1.versionId,
    });

    const res = await request(server())
      .post(`${path}?source=form`)
      .set('Authorization', 'Bearer should-not-be-logged')
      .send({ priority: 'urgent', email: 'kiet@gmail.com' })
      .expect(202);
    expect(res.body.data.started).toHaveLength(1);

    const execution = await finished(res.body.data.started[0] as string);
    expect(execution.status).toBe('SUCCESS');
    expect(execution.triggerType).toBe('WEBHOOK');
    expect(execution.triggeredById).toBeNull();
    expect(execution.nodeLogs.map((log) => log.nodeKey)).toEqual([
      'webhook.trigger',
      'logic.filter',
    ]);
    const filterOutput = execution.nodeLogs[1].output as Array<{
      json: { body: unknown; query: unknown; headers: Record<string, string> };
    }>;
    expect(filterOutput[0].json.body).toEqual({
      priority: 'urgent',
      email: 'kiet@gmail.com',
    });
    expect(filterOutput[0].json.query).toEqual({ source: 'form' });
    expect(filterOutput[0].json.headers.authorization).toBeUndefined();

    // Publishing while active keeps the URL and switches to the new version.
    const v2 = await publish(workflowId, 'low');
    expect(v2.activation).toEqual({ active: true });
    expect(await webhookPath(workflowId)).toBe(path);
    const second = await request(server())
      .post(path)
      .send({ priority: 'urgent' })
      .expect(202);
    const run2 = await finished(second.body.data.started[0] as string);
    expect(run2.workflowVersionId).toBe(v2.versionId);
    expect(run2.nodeLogs[1].output).toEqual([]);

    // Deactivated: the URL stops answering.
    await request(server())
      .post(`/api/workflows/${workflowId}/deactivate`)
      .expect(200);
    const state = await request(server())
      .get(`/api/workflows/${workflowId}/activation`)
      .expect(200);
    expect(state.body.data).toEqual({ active: false, versionId: null });
    await request(server()).post(path).send({}).expect(404);
  });

  it('starts a single run for retries carrying the same Idempotency-Key', async () => {
    const workflowId = await createWorkflow('Webhook idempotency e2e');
    await publish(workflowId, 'urgent');
    await request(server())
      .post(`/api/workflows/${workflowId}/activate`)
      .expect(200);
    const path = await webhookPath(workflowId);
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

    expect(first.body.data.started).toHaveLength(1);
    expect(retry.body.data).toEqual({ started: [], ignored: 1 });
    await finished(first.body.data.started[0] as string);
  });

  it('captures a test event from the draft without running it', async () => {
    const workflowId = await createWorkflow('Webhook test event e2e');
    await saveDraft(workflowId, 'urgent');
    const path = await webhookPath(workflowId);

    const listen = await request(server())
      .post(`/api/workflows/${workflowId}/nodes/hook/test-listen`)
      .expect(201);
    const listenId = listen.body.data.listenId as string;
    expect(listen.body.data.status).toBe('waiting');

    const ping = await request(server())
      .post(path)
      .send({ ping: true })
      .expect(202);
    expect(ping.body.data.started).toEqual([]);

    const outcome = await request(server())
      .get(`/api/test-events/${listenId}`)
      .expect(200);
    expect(outcome.body.data.status).toBe('received');
    expect(outcome.body.data.event.body).toEqual({ ping: true });
    expect(await prisma.execution.count({ where: { workflowId } })).toBe(0);
  });

  it('answers 404 for an unknown endpoint', async () => {
    await request(server())
      .post('/api/webhooks/not-a-uuid')
      .send({})
      .expect(404);
    await request(server())
      .post('/api/webhooks/00000000-0000-0000-0000-00000000abcd')
      .send({})
      .expect(404);
  });
});
