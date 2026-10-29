/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
// Messenger end to end with a real HTTP server, Postgres, Redis and BullMQ.
// Only the call to Facebook is replaced: a signed message posted to the webhook
// must produce a reply from the Page through the fake client.
import { createHmac } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DesignerModule } from '@app/designer';
import { PrismaModule } from '@app/database';
import { PrismaService } from '@app/database/prisma/prisma.service';
import { ExecutionModule, MESSENGER_CLIENT } from '@app/execution';
import { TriggersModule } from '@app/triggers';
import { ConnectorModule } from '@app/connector';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import {
  MessengerClient,
  MessengerSendRequest,
} from '@app/execution/application/ports/messenger-client.port';

const APP_SECRET = 'e2e-meta-app-secret';
const VERIFY_TOKEN = 'e2e-verify-token';

class FakeMessenger implements MessengerClient {
  sent: MessengerSendRequest[] = [];
  sendText(request: MessengerSendRequest) {
    this.sent.push(request);
    return Promise.resolve({ messageId: `mid.reply.${this.sent.length}` });
  }
}

describe('Messenger trigger (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const messenger = new FakeMessenger();
  const ownerId = '00000000-0000-0000-0000-000000000000';
  // Pages stay bound to earlier runs' workflows: use a fresh one every run.
  const pageId = `page-${Date.now()}`;
  const previousEnv = { ...process.env };

  const server = () =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  const sign = (raw: string) =>
    `sha256=${createHmac('sha256', APP_SECRET).update(raw).digest('hex')}`;

  const postSigned = (body: unknown) => {
    const raw = JSON.stringify(body);
    return request(server())
      .post('/api/webhooks/messenger')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sign(raw))
      .send(raw);
  };

  const customerMessage = (
    mid: string,
    extra: Record<string, unknown> = {},
  ) => ({
    object: 'page',
    entry: [
      {
        id: pageId,
        time: Date.now(),
        messaging: [
          {
            sender: { id: 'customer-42' },
            recipient: { id: pageId },
            timestamp: Date.now(),
            message: { mid, text: 'Shop ơi còn size M không?', ...extra },
          },
        ],
      },
    ],
  });

  async function createWorkflow(name: string, credentialId: string) {
    const created = await request(server())
      .post('/api/workflows')
      .send({ name, ownerId })
      .expect(201);
    const workflowId = created.body.data.id as string;
    await request(server())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({
        definition: {
          nodes: [
            {
              id: 'chat',
              type: 'triggerNode',
              data: {
                key: 'trigger.messenger.message',
                name: 'Messenger Trigger',
                config: { credential_id: credentialId },
              },
            },
            {
              id: 'reply',
              type: 'actionNode',
              data: {
                key: 'integration.messenger.send',
                name: 'Reply',
                config: {
                  credential_id: credentialId,
                  recipient_id: '{{$json.sender_id}}',
                  text: 'Cảm ơn bạn, shop trả lời ngay: {{$json.text}}',
                },
              },
            },
          ],
          edges: [{ id: 'e1', source: 'chat', target: 'reply' }],
        },
      })
      .expect(200);
    return workflowId;
  }

  async function waitForListener(workflowId: string) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const row = await prisma.workflowTrigger.findFirst({
        where: { workflowId, isActive: true },
      });
      if (row) return row;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Messenger trigger was never registered');
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
    process.env['META_APP_SECRET'] = APP_SECRET;
    process.env['META_VERIFY_TOKEN'] = VERIFY_TOKEN;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PrismaModule,
        DesignerModule,
        ExecutionModule,
        TriggersModule,
        ConnectorModule,
      ],
    })
      .overrideProvider(MESSENGER_CLIENT)
      .useValue(messenger)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: ownerId, email: 'messenger-e2e@flowpilot.local' };
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
        email: 'messenger-e2e@flowpilot.local',
        passwordHash: 'dummy',
        name: 'Messenger E2E User',
      },
    });
  });

  afterAll(async () => {
    process.env = previousEnv;
    await app.close();
  });

  it('answers the Meta verification challenge only with the right token', async () => {
    const ok = await request(server())
      .get('/api/webhooks/messenger')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': VERIFY_TOKEN,
        'hub.challenge': '12345',
      })
      .expect(200);
    expect(ok.text).toBe('12345');

    await request(server())
      .get('/api/webhooks/messenger')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong',
        'hub.challenge': '12345',
      })
      .expect(403);
  });

  it('replies to a customer message from the connected Page', async () => {
    const credential = await request(server())
      .post('/api/connectors/messenger/credentials')
      .send({
        name: 'Shop test Page',
        secret: { page_id: pageId, page_access_token: 'EAAe2etokenvalue' },
      })
      .expect(201);
    expect(JSON.stringify(credential.body)).not.toContain('EAAe2etokenvalue');
    const credentialId = credential.body.data.id as string;

    const workflowId = await createWorkflow('Messenger bot e2e', credentialId);
    await request(server())
      .post(`/api/workflows/${workflowId}/versions`)
      .expect(201);
    const listener = await waitForListener(workflowId);
    expect(listener).toMatchObject({
      channel: 'MESSENGER',
      routingKey: pageId,
    });

    // Unsigned or wrongly signed calls never start anything.
    await request(server())
      .post('/api/webhooks/messenger')
      .send(customerMessage('m_unsigned'))
      .expect(401);

    const res = await postSigned(customerMessage(`m_${Date.now()}`)).expect(
      200,
    );
    expect(res.body.data.started).toHaveLength(1);
    const execution = await finished(res.body.data.started[0] as string);

    expect(execution.status).toBe('SUCCESS');
    expect(execution.triggerType).toBe('WEBHOOK');
    expect(execution.nodeLogs.map((log) => log.nodeKey)).toEqual([
      'trigger.messenger.message',
      'integration.messenger.send',
    ]);
    expect(messenger.sent).toEqual([
      {
        pageAccessToken: 'EAAe2etokenvalue',
        recipientId: 'customer-42',
        text: 'Cảm ơn bạn, shop trả lời ngay: Shop ơi còn size M không?',
      },
    ]);

    // Meta re-delivering the same message, or echoing the Page reply,
    // does not start another run.
    const sameMid = customerMessage('m_repeat');
    await postSigned(sameMid).expect(200);
    const repeat = await postSigned(sameMid).expect(200);
    expect(repeat.body.data).toEqual({ started: [], ignored: 1 });
    const echo = await postSigned(
      customerMessage('m_echo', { is_echo: true }),
    ).expect(200);
    expect(echo.body.data).toEqual({ started: [], ignored: 0 });

    // A second workflow cannot take the same Page.
    const rival = await createWorkflow('Rival bot e2e', credentialId);
    const blocked = await request(server())
      .post(`/api/workflows/${rival}/versions`)
      .expect(400);
    expect(blocked.body.issues).toEqual([
      expect.objectContaining({
        code: 'CHANNEL_ALREADY_BOUND',
        nodeId: 'chat',
      }),
    ]);
    expect(blocked.body.issues[0].message).toContain('Messenger bot e2e');
  });
});
