/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Publish Workflow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject publish if workflow draft has no trigger', async () => {
    // 1. Create a workflow
    const createRes = await request(app.getHttpServer())
      .post('/workflows')
      .send({ name: 'Test Workflow', ownerId: 'user-1' })
      .expect(201);

    const workflowId = createRes.body.data.id;

    // 2. Save a draft with NO trigger node
    await request(app.getHttpServer())
      .put(`/workflows/${workflowId}/draft`)
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
    const publishRes = await request(app.getHttpServer())
      .post(`/workflows/${workflowId}/versions`)
      .send()
      .expect(400);

    expect(publishRes.body.message).toContain(
      'Workflow must have exactly one trigger node',
    );

    // 4. Verify that the draft now contains the validation errors
    const draftRes = await request(app.getHttpServer())
      .get(`/workflows/${workflowId}/draft`)
      .expect(200);

    expect(draftRes.body.data.validationErrors).toBeDefined();
    expect(draftRes.body.data.validationErrors.message).toContain(
      'Workflow must have exactly one trigger node',
    );
  });
});
