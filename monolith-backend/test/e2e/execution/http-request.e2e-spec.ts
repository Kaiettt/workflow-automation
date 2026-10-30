/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
// Real HTTP, Postgres, Redis and BullMQ worker: a webhook workflow calls a web
// API with a bearer credential, and the same call to an internal address is
// refused unless private addresses are allowed.
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DesignerModule } from '@app/designer';
import { PrismaModule } from '@app/database';
import { PrismaService } from '@app/database/prisma/prisma.service';
import { ExecutionModule } from '@app/execution';
import { TriggersModule } from '@app/triggers';
import { ConnectorModule } from '@app/connector';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';

describe('HTTP Request node (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let api: http.Server;
  let apiUrl = '';
  const received: Array<{
    method: string;
    url: string;
    authorization?: string;
    body: string;
  }> = [];
  const ownerId = '00000000-0000-0000-0000-000000000003';
  const previousEnv = { ...process.env };

  const server = () =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

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

  async function activeWorkflow(name: string, credentialId: string) {
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
              id: 'hook',
              type: 'triggerNode',
              data: { key: 'webhook.trigger', name: 'Incoming', config: {} },
            },
            {
              id: 'call',
              type: 'actionNode',
              data: {
                key: 'http.request',
                name: 'Call API',
                config: {
                  method: 'POST',
                  url: `${apiUrl}/orders/{{$json.body.order_id}}`,
                  authentication: 'httpBearerAuth',
                  credential_id: credentialId,
                  query: [{ name: 'source', value: 'flowpilot' }],
                  body_type: 'json',
                  body: '{"customer": "{{$json.body.name}}"}',
                },
              },
            },
          ],
          edges: [{ id: 'e1', source: 'hook', target: 'call' }],
        },
      })
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
    return new URL(hooks.body.data[0].url as string).pathname;
  }

  beforeAll(async () => {
    api = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        received.push({
          method: req.method ?? '',
          url: req.url ?? '',
          authorization: req.headers.authorization,
          body: Buffer.concat(chunks).toString(),
        });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"state":"shipped"}');
      });
    });
    await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', resolve));
    apiUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PrismaModule,
        DesignerModule,
        ExecutionModule,
        TriggersModule,
        ConnectorModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: ownerId, email: 'http-e2e@flowpilot.local' };
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
        email: 'http-e2e@flowpilot.local',
        passwordHash: 'dummy',
        name: 'HTTP E2E User',
      },
    });
  });

  afterAll(async () => {
    process.env = previousEnv;
    await app.close();
    await new Promise((resolve) => api.close(resolve));
  });

  it('registers the node and its credential types at startup', async () => {
    const node = await prisma.nodeTypeDefinition.findUnique({
      where: { key: 'http.request' },
    });
    expect(node).toMatchObject({ isActive: true, category: 'INTEGRATION' });
    const connectors = await request(server())
      .get('/api/connectors')
      .expect(200);
    const keys = (connectors.body.data as Array<{ key: string }>).map(
      (c) => c.key,
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        'httpHeaderAuth',
        'httpBearerAuth',
        'httpBasicAuth',
      ]),
    );
  });

  it('calls the API with the credential and passes its answer on', async () => {
    process.env['HTTP_REQUEST_ALLOW_PRIVATE'] = 'true';
    const credential = await request(server())
      .post('/api/connectors/httpBearerAuth/credentials')
      .send({ name: 'Orders API', secret: { token: 'tok-e2e' } })
      .expect(201);
    const path = await activeWorkflow(
      'HTTP e2e',
      credential.body.data.id as string,
    );

    const res = await request(server())
      .post(path)
      .send({ order_id: 'A-5', name: 'An' })
      .expect(202);
    const execution = await finished(res.body.data.started[0] as string);

    expect(execution.status).toBe('SUCCESS');
    expect(received[received.length - 1]).toEqual({
      method: 'POST',
      url: '/orders/A-5?source=flowpilot',
      authorization: 'Bearer tok-e2e',
      body: '{"customer":"An"}',
    });
    const output = execution.nodeLogs.find((log) => log.nodeId === 'call')
      ?.output as Array<{ json: Record<string, unknown> }>;
    expect(output[0].json).toMatchObject({
      status: 200,
      ok: true,
      body: { state: 'shipped' },
    });
    expect(JSON.stringify(execution.nodeLogs)).not.toContain('tok-e2e');
  });

  it('refuses to call an internal address unless that is allowed', async () => {
    process.env['HTTP_REQUEST_ALLOW_PRIVATE'] = 'false';
    const credential = await request(server())
      .post('/api/connectors/httpBearerAuth/credentials')
      .send({ name: 'Orders API 2', secret: { token: 'tok-e2e-2' } })
      .expect(201);
    const path = await activeWorkflow(
      'HTTP blocked e2e',
      credential.body.data.id as string,
    );
    const before = received.length;

    const res = await request(server())
      .post(path)
      .send({ order_id: 'A-6', name: 'Bình' })
      .expect(202);
    const execution = await finished(res.body.data.started[0] as string);

    expect(execution.status).toBe('FAILED');
    expect(
      execution.nodeLogs.find((log) => log.nodeId === 'call')?.errorMessage,
    ).toContain('private or internal address');
    expect(received).toHaveLength(before);
  });
});
