/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaModule } from '@app/database';
import { PrismaService } from '@app/database/prisma/prisma.service';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import { ConnectorModule } from '@app/connector';
import { ExecutionModule } from '@app/execution';
import { NodeLibraryModule } from '@app/node-library';
import { LlmProviderRegistry } from '../../../libs/execution/src/application/services/llm-provider.registry';
import {
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmProvider,
} from '../../../libs/execution/src/application/ports/llm-provider.port';

// Saves a real API key through the HTTP API (encrypted in Postgres) and runs an
// LLM workflow with it. Only the vendor call is replaced, so nothing leaves the machine.
class RecordingProvider implements LlmProvider {
  readonly requests: LlmGenerateRequest[] = [];
  constructor(readonly key: string) {}

  generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    this.requests.push(request);
    return Promise.resolve({
      text: `answer to: ${request.prompt}`,
      usage: { inputTokens: 3, outputTokens: 2 },
    });
  }
}

describe('LLM node (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const openai = new RecordingProvider('openai');
  const anthropic = new RecordingProvider('anthropic');

  const ownerId = randomUUID();
  const apiKey = `sk-e2e-${randomUUID().replace(/-/g, '')}`;
  const workflowIds: string[] = [];
  const credentialIds: string[] = [];
  let previousEncryptionKey: string | undefined;

  const getServer = () =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  async function saveKey(connectorKey: string, name: string, key = apiKey) {
    const res = await request(getServer())
      .post(`/api/connectors/${connectorKey}/credentials`)
      .send({ name, api_key: key })
      .expect(201);
    credentialIds.push(res.body.data.id);
    return res.body.data as { id: string; connectorKey: string; name: string };
  }

  async function runWorkflow(config: Record<string, unknown>) {
    const workflow = await prisma.workflow.create({
      data: { name: `e2e llm ${randomUUID()}`, ownerId },
    });
    workflowIds.push(workflow.id);
    const version = await prisma.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        versionNumber: 1,
        publishedById: ownerId,
        definition: {
          nodes: [
            {
              id: 't',
              type: 'trigger.manual',
              data: { key: 'trigger.manual', name: 'Start', config: {} },
            },
            {
              id: 'l',
              type: 'ai.llm.generate',
              data: {
                key: 'ai.llm.generate',
                name: 'Ask AI',
                config: { model: 'test-model', prompt: 'Say hi', ...config },
              },
            },
          ],
          edges: [{ id: 'e1', source: 't', target: 'l' }],
        },
      },
    });
    const res = await request(getServer())
      .post('/api/executions')
      .send({ workflow_version_id: version.id })
      .expect(201);
    return res.body.data as {
      status: string;
      nodeLogs: Array<{
        status: string;
        output: any;
        errorMessage: string | null;
      }>;
    };
  }

  beforeAll(async () => {
    previousEncryptionKey = process.env['ENCRYPTION_KEY'];
    process.env['ENCRYPTION_KEY'] = randomBytes(32).toString('hex');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PrismaModule,
        ConnectorModule,
        NodeLibraryModule,
        ExecutionModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: ownerId, email: 'e2e-llm@flowpilot.local' };
          return true;
        },
      })
      .overrideProvider(LlmProviderRegistry)
      .useValue(new LlmProviderRegistry([openai, anthropic]))
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `e2e-llm-${ownerId}@flowpilot.local`,
        passwordHash: 'dummy',
        name: 'E2E LLM',
      },
    });
  });

  afterAll(async () => {
    await prisma.execution.deleteMany({
      where: { workflowId: { in: workflowIds } },
    });
    await prisma.workflowVersion.deleteMany({
      where: { workflowId: { in: workflowIds } },
    });
    await prisma.workflow.deleteMany({ where: { id: { in: workflowIds } } });
    await prisma.connectorCredential.deleteMany({
      where: { id: { in: credentialIds } },
    });
    await prisma.user.delete({ where: { id: ownerId } });
    await app.close();
    if (previousEncryptionKey === undefined)
      delete process.env['ENCRYPTION_KEY'];
    else process.env['ENCRYPTION_KEY'] = previousEncryptionKey;
  });

  describe('credentials API', () => {
    it('saves an API key encrypted and never returns it', async () => {
      const saved = await saveKey('openai', 'My OpenAI');

      expect(saved).toMatchObject({
        connectorKey: 'openai',
        name: 'My OpenAI',
      });
      expect(JSON.stringify(saved)).not.toContain(apiKey);

      const row = await prisma.connectorCredential.findUniqueOrThrow({
        where: { id: saved.id },
      });
      expect(row.ownerId).toBe(ownerId);
      expect(row.encryptedSecret).not.toContain(apiKey);
    });

    it('lists only my credentials of the requested connector', async () => {
      const mine = await saveKey('openai', 'Listed');
      const other = await saveKey('anthropic', 'Other vendor');

      const res = await request(getServer())
        .get('/api/connectors/openai/credentials')
        .expect(200);

      const ids = res.body.data.map((c: { id: string }) => c.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(other.id);
      expect(JSON.stringify(res.body)).not.toContain(apiKey);
      expect(Object.keys(res.body.data[0]).sort()).toEqual([
        'connectorKey',
        'createdAt',
        'id',
        'name',
      ]);
    });

    it('rejects bad requests', async () => {
      await request(getServer())
        .post('/api/connectors/openai/credentials')
        .send({ name: 'no key' })
        .expect(400);
      await request(getServer())
        .post('/api/connectors/openai/credentials')
        .send({ api_key: 'k' })
        .expect(400);
      await request(getServer())
        .post('/api/connectors/google/credentials')
        .send({ name: 'oauth connector', api_key: 'k' })
        .expect(400);
      await request(getServer())
        .post('/api/connectors/does-not-exist/credentials')
        .send({ name: 'n', api_key: 'k' })
        .expect(404);
      await request(getServer())
        .get('/api/connectors/does-not-exist/credentials')
        .expect(404);
    });
  });

  describe('running the node', () => {
    it('decrypts the saved key and uses it for the chosen provider', async () => {
      const saved = await saveKey('openai', 'Used by workflow');

      const result = await runWorkflow({
        provider: 'openai',
        credential_id: saved.id,
      });

      expect(result.status).toBe('SUCCESS');
      expect(openai.requests.at(-1)).toMatchObject({
        apiKey,
        model: 'test-model',
        prompt: 'Say hi',
        outputFormat: 'text',
        maxTokens: 1024,
      });
      expect(result.nodeLogs[1].output).toEqual([
        {
          json: {
            text: 'answer to: Say hi',
            model: 'test-model',
            usage: { input_tokens: 3, output_tokens: 2 },
          },
          pairedItem: 0,
        },
      ]);
      expect(JSON.stringify(result)).not.toContain(apiKey);
    });

    it('refuses a credential saved for another provider', async () => {
      const saved = await saveKey('anthropic', 'Wrong vendor');
      const calls = openai.requests.length;

      const result = await runWorkflow({
        provider: 'openai',
        credential_id: saved.id,
      });

      expect(result.status).toBe('FAILED');
      expect(result.nodeLogs[1].errorMessage).toContain('"openai" connector');
      expect(openai.requests).toHaveLength(calls);
    });

    it("refuses another user's credential", async () => {
      const stranger = await prisma.user.create({
        data: {
          id: randomUUID(),
          email: `e2e-llm-stranger-${randomUUID()}@flowpilot.local`,
          passwordHash: 'dummy',
          name: 'Stranger',
        },
      });
      const connector = await prisma.connector.findUniqueOrThrow({
        where: { key: 'openai' },
      });
      const foreign = await prisma.connectorCredential.create({
        data: {
          connectorId: connector.id,
          ownerId: stranger.id,
          name: 'not mine',
          encryptedSecret: 'irrelevant',
        },
      });

      try {
        const result = await runWorkflow({
          provider: 'openai',
          credential_id: foreign.id,
        });
        expect(result.status).toBe('FAILED');
        expect(result.nodeLogs[1].errorMessage).toContain('does not belong');
      } finally {
        await prisma.connectorCredential.delete({ where: { id: foreign.id } });
        await prisma.user.delete({ where: { id: stranger.id } });
      }
    });
  });
});
