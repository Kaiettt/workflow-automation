/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
// Messenger end to end with a real HTTP server, Postgres, Redis and BullMQ.
// Only Facebook is replaced (META_GRAPH_API). Everything is configured the way
// a user does it in the UI: credential with their own App ID / Secret →
// Connect (OAuth2) → pick a Page → publish → activate.
import { createHmac } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DesignerModule } from '@app/designer';
import { PrismaModule } from '@app/database';
import { PrismaService } from '@app/database/prisma/prisma.service';
import { ExecutionModule } from '@app/execution';
import { TriggersModule } from '@app/triggers';
import { ConnectorModule } from '@app/connector';
import { IntegrationsModule } from '@app/integrations';
import { META_GRAPH_API } from '@app/apps';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import { FakeMetaGraph } from '@test/support/apps/fake-meta-graph';

describe('Messenger trigger and send (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const graph = new FakeMetaGraph();
  const ownerId = '00000000-0000-0000-0000-000000000000';
  // A fresh Meta App and Page every run, so earlier runs do not interfere.
  const run = Date.now();
  const appId = `app-${run}`;
  const appSecret = `secret-${run}`;
  const pageId = `page-${run}`;
  const previousEnv = { ...process.env };
  const handshakes: Array<{ status: number; text: string }> = [];

  const server = () =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  const postSigned = (path: string, body: unknown, secret = appSecret) => {
    const raw = JSON.stringify(body);
    return request(server())
      .post(path)
      .set('Content-Type', 'application/json')
      .set(
        'X-Hub-Signature-256',
        `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`,
      )
      .send(raw);
  };

  const customerMessage = (mid: string, text: string, extra = {}) => ({
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
            message: { mid, text, ...extra },
          },
        ],
      },
    ],
  });

  async function createCredential(
    name: string,
    clientId: string,
    secret: string,
  ) {
    const res = await request(server())
      .post('/api/connectors/facebookMessengerOAuth2/credentials')
      .send({ name, secret: { client_id: clientId, client_secret: secret } })
      .expect(201);
    return res.body.data.id as string;
  }

  async function connect(credentialId: string) {
    const auth = await request(server())
      .get('/api/oauth2/auth')
      .query({ credentialId })
      .expect(200);
    const url = new URL(auth.body.url as string);
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost/api/oauth2/callback',
    );
    const state = url.searchParams.get('state');
    const callback = await request(server())
      .get('/api/oauth2/callback')
      .query({ code: 'fb-code', state })
      .expect(200);
    expect(callback.text).toContain('"status":"success"');
    // The state works once.
    await request(server())
      .get('/api/oauth2/callback')
      .query({ code: 'fb-code', state })
      .expect(400);
  }

  async function chatWorkflow(
    name: string,
    credentialId: string,
    keywords: string,
    replyText: string,
  ) {
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
                key: 'messenger.trigger',
                name: 'Messenger Trigger',
                config: {
                  credential_id: credentialId,
                  page_id: pageId,
                  keywords,
                },
              },
            },
            {
              id: 'reply',
              type: 'actionNode',
              data: {
                key: 'messenger.sendMessage',
                name: 'Reply',
                // recipient_id keeps its default: the trigger's sender_id.
                config: {
                  credential_id: credentialId,
                  page_id: pageId,
                  recipient_id: '{{$node["Messenger Trigger"].json.sender_id}}',
                  text: replyText,
                },
              },
            },
          ],
          edges: [{ id: 'e1', source: 'chat', target: 'reply' }],
        },
      })
      .expect(200);
    await request(server())
      .post(`/api/workflows/${workflowId}/versions`)
      .expect(201);
    return workflowId;
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
    process.env['PUBLIC_BASE_URL'] = 'http://localhost';
    graph.pages = [
      { id: pageId, name: 'Shop E2E', accessToken: `EAApage${run}` },
    ];
    // Like Meta: verify the callback URL while the subscription is created.
    graph.onSubscribeApp = async ({ callbackUrl, verifyToken }) => {
      const res = await request(server())
        .get(new URL(callbackUrl).pathname)
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': verifyToken,
          'hub.challenge': 'challenge-1',
        });
      handshakes.push({ status: res.status, text: res.text });
      if (res.status !== 200) throw new Error('Callback verification failed');
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PrismaModule,
        DesignerModule,
        ExecutionModule,
        TriggersModule,
        ConnectorModule,
        IntegrationsModule,
      ],
    })
      .overrideProvider(META_GRAPH_API)
      .useValue(graph)
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

  it('registers the catalog of the package at startup', async () => {
    const nodeTypes = await prisma.nodeTypeDefinition.findMany({
      where: {
        key: {
          in: [
            'messenger.trigger',
            'messenger.sendMessage',
            'messenger.senderAction',
            'webhook.trigger',
          ],
        },
      },
    });
    expect(nodeTypes.map((n) => n.key).sort()).toEqual([
      'messenger.sendMessage',
      'messenger.senderAction',
      'messenger.trigger',
      'webhook.trigger',
    ]);
    const connectors = await request(server())
      .get('/api/connectors')
      .expect(200);
    expect(
      connectors.body.data.find(
        (c: { key: string }) => c.key === 'facebookMessengerOAuth2',
      ),
    ).toMatchObject({
      authType: 'OAUTH2',
      oauth2: { redirectUrl: 'http://localhost/api/oauth2/callback' },
    });
  });

  it('connects, activates, runs every matching workflow and replies through the Page', async () => {
    const credentialId = await createCredential('Shop app', appId, appSecret);
    await connect(credentialId);

    const pages = await request(server())
      .post('/api/node-types/messenger.trigger/options/page_id')
      .send({ credentialId })
      .expect(200);
    expect(pages.body.data).toEqual([{ value: pageId, label: 'Shop E2E' }]);

    const everything = await chatWorkflow(
      'Default bot e2e',
      credentialId,
      '',
      'Cảm ơn bạn đã nhắn: {{$node["Messenger Trigger"].json.text}}',
    );
    const prices = await chatWorkflow(
      'Price bot e2e',
      credentialId,
      'giá, bảng giá',
      'Bảng giá ở đây ạ',
    );

    await request(server())
      .post(`/api/workflows/${everything}/activate`)
      .expect(200);
    await request(server())
      .post(`/api/workflows/${prices}/activate`)
      .expect(200);

    // One subscription for the Meta App, verified with the endpoint's token.
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { scopeKey: `credential:${credentialId}` },
    });
    const path = `/api/webhooks/${endpoint!.id}`;
    expect(graph.appSubscriptions.get(appId)).toMatchObject({
      callbackUrl: `http://localhost${path}`,
      appToken: `${appId}|${appSecret}`,
    });
    expect(handshakes).toEqual([{ status: 200, text: 'challenge-1' }]);
    expect(graph.calls).toContain(`subscribePage ${pageId} EAApage${run}`);

    await request(server())
      .post(path)
      .send(customerMessage('m_unsigned', 'hi'))
      .expect(401);

    const priceRun = await postSigned(
      path,
      customerMessage(`m_${run}_1`, 'Cho xin BẢNG GIA'),
    ).expect(200);
    expect(priceRun.body.data.started).toHaveLength(2);
    const greetRun = await postSigned(
      path,
      customerMessage(`m_${run}_2`, 'Xin chào'),
    ).expect(200);
    expect(greetRun.body.data.started).toHaveLength(1);

    const executions = await Promise.all(
      [...priceRun.body.data.started, ...greetRun.body.data.started].map(
        (id: string) => finished(id),
      ),
    );
    for (const execution of executions) {
      expect(execution.status).toBe('SUCCESS');
      expect(execution.nodeLogs.map((log) => log.nodeKey)).toEqual([
        'messenger.trigger',
        'messenger.sendMessage',
      ]);
    }
    // Runs are processed in parallel: order is not fixed.
    expect(graph.sent).toHaveLength(3);
    expect(graph.sent).toEqual(
      expect.arrayContaining([
        {
          pageAccessToken: `EAApage${run}`,
          recipientId: 'customer-42',
          message: { text: 'Bảng giá ở đây ạ' },
        },
        {
          pageAccessToken: `EAApage${run}`,
          recipientId: 'customer-42',
          message: { text: 'Cảm ơn bạn đã nhắn: Cho xin BẢNG GIA' },
        },
        {
          pageAccessToken: `EAApage${run}`,
          recipientId: 'customer-42',
          message: { text: 'Cảm ơn bạn đã nhắn: Xin chào' },
        },
      ]),
    );

    // Re-delivery and the Page's own echo start nothing.
    const repeat = await postSigned(
      path,
      customerMessage(`m_${run}_2`, 'Xin chào'),
    ).expect(200);
    expect(repeat.body.data).toEqual({ started: [], ignored: 1 });
    const echo = await postSigned(
      path,
      customerMessage(`m_${run}_echo`, 'bot', { is_echo: true }),
    ).expect(200);
    expect(echo.body.data).toEqual({ started: [], ignored: 0 });
    await new Promise((resolve) => setTimeout(resolve, 200));

    // The subscription is removed with the last active workflow.
    await request(server())
      .post(`/api/workflows/${everything}/deactivate`)
      .expect(200);
    expect(graph.appSubscriptions.has(appId)).toBe(true);
    await request(server())
      .post(`/api/workflows/${prices}/deactivate`)
      .expect(200);
    expect(graph.appSubscriptions.has(appId)).toBe(false);
    expect(graph.calls).toContain(`unsubscribePage ${pageId}`);
  });

  it('answers a tap on a button with typing and quick replies, and ignores typed messages', async () => {
    const credentialId = await createCredential(
      'Buttons app',
      `${appId}-c`,
      'secret-c',
    );
    await connect(credentialId);

    const created = await request(server())
      .post('/api/workflows')
      .send({ name: 'Buttons bot e2e', ownerId })
      .expect(201);
    const workflowId = created.body.data.id as string;
    const common = { credential_id: credentialId, page_id: pageId };
    const recipient = '{{$node["Messenger Trigger"].json.sender_id}}';
    await request(server())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({
        definition: {
          nodes: [
            {
              id: 'chat',
              type: 'triggerNode',
              data: {
                key: 'messenger.trigger',
                name: 'Messenger Trigger',
                config: { ...common, events: 'postback', keywords: 'price' },
              },
            },
            {
              id: 'typing',
              type: 'actionNode',
              data: {
                key: 'messenger.senderAction',
                name: 'Typing',
                config: {
                  ...common,
                  recipient_id: recipient,
                  action: 'typing_on',
                },
              },
            },
            {
              id: 'reply',
              type: 'actionNode',
              data: {
                key: 'messenger.sendMessage',
                name: 'Reply',
                config: {
                  ...common,
                  recipient_id: recipient,
                  message_type: 'quick_replies',
                  text: 'Bạn muốn xem gì?',
                  quick_replies: [
                    { title: 'Áo', payload: 'SHIRTS' },
                    {
                      title: 'Quần',
                      payload: '{{$node["Messenger Trigger"].json.payload}}_2',
                    },
                  ],
                },
              },
            },
          ],
          edges: [
            { id: 'e1', source: 'chat', target: 'typing' },
            { id: 'e2', source: 'typing', target: 'reply' },
          ],
        },
      })
      .expect(200);
    await request(server())
      .post(`/api/workflows/${workflowId}/versions`)
      .expect(201);
    await request(server())
      .post(`/api/workflows/${workflowId}/activate`)
      .expect(200);

    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { scopeKey: `credential:${credentialId}` },
    });
    const path = `/api/webhooks/${endpoint!.id}`;
    // The app and the Page are subscribed to button clicks as well.
    expect(graph.appSubscriptions.get(`${appId}-c`)?.fields).toContain(
      'messaging_postbacks',
    );
    expect(graph.pageApps.get(pageId)?.get(`${appId}-c`)).toContain(
      'messaging_postbacks',
    );

    const typed = await postSigned(
      path,
      customerMessage(`m_${run}_typed`, 'price please'),
      'secret-c',
    ).expect(200);
    expect(typed.body.data.started).toEqual([]);

    const tap = await postSigned(
      path,
      {
        object: 'page',
        entry: [
          {
            id: pageId,
            messaging: [
              {
                sender: { id: 'customer-77' },
                timestamp: Date.now(),
                postback: {
                  mid: `pb_${run}`,
                  title: 'Xem giá',
                  payload: 'PRICE_LIST',
                },
              },
            ],
          },
        ],
      },
      'secret-c',
    ).expect(200);
    expect(tap.body.data.started).toHaveLength(1);

    const execution = await finished(tap.body.data.started[0] as string);
    expect(execution.status).toBe('SUCCESS');
    expect(execution.nodeLogs.map((log) => log.nodeKey)).toEqual([
      'messenger.trigger',
      'messenger.senderAction',
      'messenger.sendMessage',
    ]);
    expect(graph.actions).toContainEqual({
      pageAccessToken: `EAApage${run}`,
      recipientId: 'customer-77',
      action: 'typing_on',
    });
    expect(graph.sent).toContainEqual({
      pageAccessToken: `EAApage${run}`,
      recipientId: 'customer-77',
      message: {
        text: 'Bạn muốn xem gì?',
        quick_replies: [
          { content_type: 'text', title: 'Áo', payload: 'SHIRTS' },
          { content_type: 'text', title: 'Quần', payload: 'PRICE_LIST_2' },
        ],
      },
    });

    await request(server())
      .post(`/api/workflows/${workflowId}/deactivate`)
      .expect(200);
  });

  it('stays off with the reason when Meta refuses the subscription', async () => {
    const credentialId = await createCredential(
      'Broken app',
      `${appId}-b`,
      'secret-b',
    );
    await connect(credentialId);
    const workflowId = await chatWorkflow(
      'Refused bot e2e',
      credentialId,
      '',
      'x',
    );
    graph.subscribeFailure = new Error('(#100) Invalid callback URL');

    const refused = await request(server())
      .post(`/api/workflows/${workflowId}/activate`)
      .expect(400);
    expect(refused.body.message).toBe(
      '"Messenger Trigger": (#100) Invalid callback URL',
    );
    const state = await request(server())
      .get(`/api/workflows/${workflowId}/activation`)
      .expect(200);
    expect(state.body.data.active).toBe(false);
    expect(await prisma.workflowTrigger.count({ where: { workflowId } })).toBe(
      0,
    );
  });
});
