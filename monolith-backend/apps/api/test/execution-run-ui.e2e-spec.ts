/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DesignerModule } from '@app/designer';
import { PrismaModule } from '@app/database';
import { PrismaService } from '@app/database/prisma/prisma.service';

describe('Feature 4.4 - Workflow Versions & Execution Run API (e2e)', () => {
  let app: INestApplication;
  const ownerId = '00000000-0000-0000-0000-000000000000';

  const getServer = () =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, DesignerModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const prisma = app.get(PrismaService);
    await prisma.user.upsert({
      where: { id: ownerId },
      update: {},
      create: {
        id: ownerId,
        email: 'test-run-ui@flowpilot.local',
        passwordHash: 'dummy',
        name: 'Test Run UI User',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should list workflows, get version list, get version detail, and handle 404s', async () => {
    // 1. Create a workflow
    const createRes = await request(getServer())
      .post('/api/workflows')
      .send({
        name: '4.4 Test Workflow',
        ownerId,
      })
      .expect(201);

    const workflowId = createRes.body.data.id;
    expect(workflowId).toBeDefined();

    // 2. GET /api/workflows -> should include the created workflow
    const listRes = await request(getServer())
      .get('/api/workflows')
      .expect(200);

    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    const found = listRes.body.data.find(
      (w: { id: string }) => w.id === workflowId,
    );
    expect(found).toBeDefined();
    expect(found.name).toBe('4.4 Test Workflow');

    // 3. Save draft and publish version 1
    const v1Definition = {
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger.manual',
          data: { key: 'trigger.manual', name: 'Start' },
        },
        {
          id: 'filter-1',
          type: 'logic.filter',
          data: { key: 'logic.filter', name: 'Filter' },
        },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'filter-1' }],
    };

    await request(getServer())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({ definition: v1Definition })
      .expect(200);

    const publishV1Res = await request(getServer())
      .post(`/api/workflows/${workflowId}/versions`)
      .expect(201);

    const v1Id = publishV1Res.body.data.versionId;
    expect(publishV1Res.body.data.versionNumber).toBe(1);

    // 4. Save draft and publish version 2
    const v2Definition = {
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger.manual',
          data: { key: 'trigger.manual', name: 'Start' },
        },
        {
          id: 'filter-1',
          type: 'logic.filter',
          data: { key: 'logic.filter', name: 'Filter V2' },
        },
        {
          id: 'gmail-1',
          type: 'integration.gmail.send',
          data: { key: 'integration.gmail.send', name: 'Gmail' },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'filter-1' },
        { id: 'e2', source: 'filter-1', target: 'gmail-1' },
      ],
    };

    await request(getServer())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({ definition: v2Definition })
      .expect(200);

    const publishV2Res = await request(getServer())
      .post(`/api/workflows/${workflowId}/versions`)
      .expect(201);

    const v2Id = publishV2Res.body.data.versionId;
    expect(publishV2Res.body.data.versionNumber).toBe(2);

    // 5. GET /api/workflows/:id/versions -> newest version first (v2 then v1)
    const versionsRes = await request(getServer())
      .get(`/api/workflows/${workflowId}/versions`)
      .expect(200);

    expect(versionsRes.body.success).toBe(true);
    expect(versionsRes.body.data.length).toBe(2);
    expect(versionsRes.body.data[0].versionNumber).toBe(2);
    expect(versionsRes.body.data[0].id).toBe(v2Id);
    expect(versionsRes.body.data[1].versionNumber).toBe(1);
    expect(versionsRes.body.data[1].id).toBe(v1Id);

    // 6. GET /api/workflows/:id/versions/:versionId -> version detail with definition matching snapshot
    const v2DetailRes = await request(getServer())
      .get(`/api/workflows/${workflowId}/versions/${v2Id}`)
      .expect(200);

    expect(v2DetailRes.body.success).toBe(true);
    expect(v2DetailRes.body.data.id).toBe(v2Id);
    expect(v2DetailRes.body.data.versionNumber).toBe(2);
    expect(v2DetailRes.body.data.definition.nodes).toHaveLength(3);
    expect(v2DetailRes.body.data.definition.edges).toHaveLength(2);

    const v1DetailRes = await request(getServer())
      .get(`/api/workflows/${workflowId}/versions/${v1Id}`)
      .expect(200);

    expect(v1DetailRes.body.data.versionNumber).toBe(1);
    expect(v1DetailRes.body.data.definition.nodes).toHaveLength(2);

    // 7. Error cases (404)
    // Unknown version ID
    await request(getServer())
      .get(
        `/api/workflows/${workflowId}/versions/00000000-0000-0000-0000-000000000999`,
      )
      .expect(404);

    // Unknown workflow ID for versions list
    await request(getServer())
      .get('/api/workflows/00000000-0000-0000-0000-000000000999/versions')
      .expect(404);

    // Unknown workflow ID for version detail
    await request(getServer())
      .get(
        `/api/workflows/00000000-0000-0000-0000-000000000999/versions/${v1Id}`,
      )
      .expect(404);
  });
});
