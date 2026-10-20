/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../apps/api/src/app.module';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';

describe('Publish Workflow (e2e)', () => {
  let app: INestApplication;

  const getServer = () =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  const userId = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: userId, email: 'test-publish@flowpilot.local' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject publish if workflow draft has no trigger', async () => {
    // 1. Create a workflow
    const createRes = await request(getServer())
      .post('/api/workflows')
      .send({ name: 'Test Workflow', ownerId: userId })
      .expect(201);

    const workflowId = createRes.body.data.id;

    // 2. Save a draft with NO trigger node
    await request(getServer())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({
        definition: {
          nodes: [
            {
              id: 'node-1',
              type: 'action.slack',
              data: { config: { channel: '#general' } },
            },
          ],
          edges: [],
        },
      })
      .expect(200);

    // 3. Attempt to publish and expect a 400 Bad Request with validation errors
    const publishRes = await request(getServer())
      .post(`/api/workflows/${workflowId}/versions`)
      .send()
      .expect(400);

    expect(publishRes.body.issues).toContainEqual(
      expect.objectContaining({ code: 'NO_TRIGGER', severity: 'error' }),
    );

    // 4. Verify that the draft now contains the validation errors
    const draftRes = await request(getServer())
      .get(`/api/workflows/${workflowId}/draft`)
      .expect(200);

    expect(draftRes.body.data.validationErrors.issues).toContainEqual(
      expect.objectContaining({ code: 'NO_TRIGGER' }),
    );
  });

  it('should reject publish if workflow draft has no action', async () => {
    const createRes = await request(getServer())
      .post('/api/workflows')
      .send({ name: 'Trigger Only Workflow', ownerId: userId })
      .expect(201);

    const workflowId = createRes.body.data.id;

    await request(getServer())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({
        definition: {
          nodes: [
            {
              id: 'trigger-1',
              type: 'trigger.manual',
              data: { config: {} },
            },
          ],
          edges: [],
        },
      })
      .expect(200);

    const publishRes = await request(getServer())
      .post(`/api/workflows/${workflowId}/versions`)
      .send()
      .expect(400);

    expect(publishRes.body.issues).toContainEqual(
      expect.objectContaining({
        code: 'NO_ACTION',
        severity: 'error',
      }),
    );

    const draftRes = await request(getServer())
      .get(`/api/workflows/${workflowId}/draft`)
      .expect(200);

    expect(draftRes.body.data.validationErrors.issues).toContainEqual(
      expect.objectContaining({ code: 'NO_ACTION' }),
    );
  });

  it('should reject publish if an action is unreachable from every trigger', async () => {
    const createRes = await request(getServer())
      .post('/api/workflows')
      .send({ name: 'Unreachable Action Workflow', ownerId: userId })
      .expect(201);

    const workflowId = createRes.body.data.id;

    await request(getServer())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({
        definition: {
          nodes: [
            {
              id: 'trigger-1',
              type: 'trigger.manual',
              data: { config: {} },
            },
            {
              id: 'action-1',
              type: 'integration.gmail.send',
              data: {
                config: {
                  credential_id: 'credential-1',
                  to: 'person@example.com',
                  subject: 'Hello',
                  body: 'Hello from the workflow',
                },
              },
            },
          ],
          edges: [],
        },
      })
      .expect(200);

    const publishRes = await request(getServer())
      .post(`/api/workflows/${workflowId}/versions`)
      .send()
      .expect(400);

    expect(publishRes.body.issues).toContainEqual(
      expect.objectContaining({
        code: 'ACTION_UNREACHABLE',
        nodeId: 'action-1',
      }),
    );
  });

  it('should reject publish if a node is missing a required config field', async () => {
    const createRes = await request(getServer())
      .post('/api/workflows')
      .send({ name: 'Missing Config Workflow', ownerId: userId })
      .expect(201);

    const workflowId = createRes.body.data.id;

    await request(getServer())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({
        definition: {
          nodes: [
            {
              id: 'trigger-1',
              type: 'trigger.manual',
              data: { config: {} },
            },
            {
              id: 'action-1',
              type: 'integration.gmail.send',
              data: {
                config: {
                  credential_id: 'credential-1',
                  to: 'person@example.com',
                  subject: 'Hello',
                },
              },
            },
          ],
          edges: [{ id: 'edge-1', source: 'trigger-1', target: 'action-1' }],
        },
      })
      .expect(200);

    const publishRes = await request(getServer())
      .post(`/api/workflows/${workflowId}/versions`)
      .send()
      .expect(400);

    expect(publishRes.body.issues).toContainEqual(
      expect.objectContaining({
        code: 'REQUIRED_FIELD_MISSING',
        nodeId: 'action-1',
        field: 'body',
      }),
    );
  });

  it('should publish a corrected draft as the first version after validation fails', async () => {
    const createRes = await request(getServer())
      .post('/api/workflows')
      .send({ name: 'Corrected Workflow', ownerId: userId })
      .expect(201);

    const workflowId = createRes.body.data.id;

    await request(getServer())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({
        definition: {
          nodes: [
            {
              id: 'trigger-1',
              type: 'trigger.manual',
              data: { config: {} },
            },
          ],
          edges: [],
        },
      })
      .expect(200);

    await request(getServer())
      .post(`/api/workflows/${workflowId}/versions`)
      .send()
      .expect(400);

    await request(getServer())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({
        definition: {
          nodes: [
            {
              id: 'trigger-1',
              type: 'trigger.manual',
              data: { config: {} },
            },
            {
              id: 'action-1',
              type: 'integration.gmail.send',
              data: {
                config: {
                  credential_id: 'credential-1',
                  to: 'person@example.com',
                  subject: 'Hello',
                  body: 'Hello from the workflow',
                },
              },
            },
          ],
          edges: [{ id: 'edge-1', source: 'trigger-1', target: 'action-1' }],
        },
      })
      .expect(200);

    const publishRes = await request(getServer())
      .post(`/api/workflows/${workflowId}/versions`)
      .send()
      .expect(201);

    expect(publishRes.body.data.versionNumber).toBe(1);

    const draftRes = await request(getServer())
      .get(`/api/workflows/${workflowId}/draft`)
      .expect(200);

    expect(draftRes.body.data.validationErrors).toBeNull();
  });
});
