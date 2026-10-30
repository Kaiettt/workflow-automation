/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
// Real HTTP, Postgres, Redis and BullMQ worker: a webhook workflow that loads
// the conversation of a sender and saves each turn, so the second message of
// the same sender finds the first one, and another sender does not.
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DesignerModule } from '@app/designer';
import { PrismaModule } from '@app/database';
import { PrismaService } from '@app/database/prisma/prisma.service';
import { ExecutionModule } from '@app/execution';
import { TriggersModule } from '@app/triggers';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';

describe('Chat memory (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ownerId = '00000000-0000-0000-0000-000000000002';
  const run = Date.now();

  const server = () =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  const memoryNode = (id: string, name: string, config: object) => ({
    id,
    type: 'actionNode',
    data: {
      key: 'memory.chat',
      name,
      config: { session_key: '{{$json.body.user}}', ...config },
    },
  });

  const definition = {
    nodes: [
      {
        id: 'hook',
        type: 'triggerNode',
        data: { key: 'webhook.trigger', name: 'Incoming', config: {} },
      },
      memoryNode('load', 'Load history', { mode: 'load' }),
      memoryNode('save', 'Save turn', {
        mode: 'save',
        user_message: '{{$node["Incoming"].json.body.text}}',
        assistant_message: 'ok',
      }),
    ],
    edges: [
      { id: 'e1', source: 'hook', target: 'load' },
      { id: 'e2', source: 'load', target: 'save' },
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
          req.user = { id: ownerId, email: 'memory-e2e@flowpilot.local' };
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
        email: 'memory-e2e@flowpilot.local',
        passwordHash: 'dummy',
        name: 'Memory E2E User',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('remembers what a sender said earlier, and only for that sender', async () => {
    const created = await request(server())
      .post('/api/workflows')
      .send({ name: 'Chat memory e2e', ownerId })
      .expect(201);
    const workflowId = created.body.data.id as string;
    await request(server())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({ definition })
      .expect(200);
    await request(server())
      .post(`/api/workflows/${workflowId}/versions`)
      .expect(201);
    await request(server())
      .post(`/api/workflows/${workflowId}/activate`)
      .expect(200);
    const hooks = await request(server())
      .get(`/api/workflows/${workflowId}/webhooks`)
      .expect(200);
    const path = new URL(hooks.body.data[0].url as string).pathname;

    const say = async (user: string, text: string) => {
      const res = await request(server())
        .post(path)
        .send({ user, text })
        .expect(202);
      return finished(res.body.data.started[0] as string);
    };
    const historyOf = (execution: Awaited<ReturnType<typeof finished>>) =>
      (
        execution.nodeLogs.find((log) => log.nodeId === 'load')
          ?.output as Array<{
          json: {
            history: Array<{ role: string; content: string }>;
            history_text: string;
          };
        }>
      )[0].json;

    const alice = `alice-${run}`;
    const first = await say(alice, 'Giá bao nhiêu?');
    expect(first.status).toBe('SUCCESS');
    expect(historyOf(first).history).toEqual([]);

    const second = await say(alice, 'Còn màu nào?');
    expect(second.status).toBe('SUCCESS');
    expect(historyOf(second).history).toEqual([
      { role: 'user', content: 'Giá bao nhiêu?' },
      { role: 'assistant', content: 'ok' },
    ]);
    expect(historyOf(second).history_text).toBe(
      'Khách: Giá bao nhiêu?\nBot: ok',
    );

    const bob = await say(`bob-${run}`, 'Xin chào');
    expect(historyOf(bob).history).toEqual([]);
  });
});
