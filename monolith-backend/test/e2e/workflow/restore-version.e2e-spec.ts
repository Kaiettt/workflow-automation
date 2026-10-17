/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DesignerModule } from '@app/designer';
import { PrismaModule } from '@app/database';
import { PrismaService } from '@app/database/prisma/prisma.service';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';

describe('Workflow Version Restore (e2e)', () => {
  let app: INestApplication;

  const getServer = () =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, DesignerModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: '00000000-0000-0000-0000-000000000000',
            email: 'test-restore@flowpilot.local',
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const prisma = app.get(PrismaService);
    await prisma.user.upsert({
      where: { id: '00000000-0000-0000-0000-000000000000' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000000',
        email: 'test-restore@flowpilot.local',
        passwordHash: 'dummy',
        name: 'Test Restore User',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should restore version with OVERWRITE, PUBLISH_THEN_RESTORE, and BACKUP_THEN_RESTORE strategies', async () => {
    // 1. Create a workflow
    const createRes = await request(getServer())
      .post('/api/workflows')
      .send({
        name: 'Restore Test Workflow',
        ownerId: '00000000-0000-0000-0000-000000000000',
      })
      .expect(201);

    const workflowId = createRes.body.data.id;

    // 2. Save draft for Version 1 (1 trigger, 1 action)
    const v1Definition = {
      nodes: [
        { id: 'trigger-1', type: 'trigger.manual', data: { name: 'Manual' } },
        { id: 'action-1', type: 'action.slack', data: { name: 'Slack V1' } },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }],
    };

    await request(getServer())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({ definition: v1Definition })
      .expect(200);

    // Publish Version 1
    const pub1Res = await request(getServer())
      .post(`/api/workflows/${workflowId}/versions`)
      .send()
      .expect(201);

    const v1Id = pub1Res.body.data.versionId;
    expect(pub1Res.body.data.versionNumber).toBe(1);

    // 3. Save draft for Version 2 (1 trigger, 2 actions)
    const v2Definition = {
      nodes: [
        { id: 'trigger-1', type: 'trigger.manual', data: { name: 'Manual' } },
        { id: 'action-1', type: 'action.slack', data: { name: 'Slack V1' } },
        { id: 'action-2', type: 'action.email', data: { name: 'Email V2' } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'action-1' },
        { id: 'e2', source: 'action-1', target: 'action-2' },
      ],
    };

    await request(getServer())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({ definition: v2Definition })
      .expect(200);

    // Publish Version 2
    const pub2Res = await request(getServer())
      .post(`/api/workflows/${workflowId}/versions`)
      .send()
      .expect(201);

    const v2Id = pub2Res.body.data.versionId;
    expect(pub2Res.body.data.versionNumber).toBe(2);

    // 4. Verify GET /api/workflows/:id/versions lists both versions
    const versionsRes = await request(getServer())
      .get(`/api/workflows/${workflowId}/versions`)
      .expect(200);

    expect(versionsRes.body.data).toHaveLength(2);
    expect(versionsRes.body.data[0].versionNumber).toBe(2);
    expect(versionsRes.body.data[1].versionNumber).toBe(1);

    // 5. Test Draft Status: update draft with unpublished change
    await request(getServer())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({
        definition: {
          nodes: [
            ...v2Definition.nodes,
            {
              id: 'action-3',
              type: 'action.custom',
              data: { name: 'Unpublished' },
            },
          ],
          edges: v2Definition.edges,
        },
      })
      .expect(200);

    const statusRes = await request(getServer())
      .get(`/api/workflows/${workflowId}/draft/status`)
      .expect(200);

    expect(statusRes.body.data.hasUnpublishedChanges).toBe(true);
    expect(statusRes.body.data.currentPublishedVersion.versionNumber).toBe(2);

    // 6. Test Strategy 1: OVERWRITE -> Restore Version 1
    const restoreOverwriteRes = await request(getServer())
      .post(`/api/workflows/${workflowId}/versions/${v1Id}/restore`)
      .send({ strategy: 'OVERWRITE' })
      .expect(200);

    expect(restoreOverwriteRes.body.data.restoredVersionNumber).toBe(1);
    expect(restoreOverwriteRes.body.data.strategyUsed).toBe('OVERWRITE');

    // Verify current draft now has Version 1 nodes
    const draftAfterOverwrite = await request(getServer())
      .get(`/api/workflows/${workflowId}/draft`)
      .expect(200);

    expect(draftAfterOverwrite.body.data.definition.nodes).toHaveLength(2);
    expect(draftAfterOverwrite.body.data.definition.nodes[1].data.name).toBe(
      'Slack V1',
    );

    // 7. Test Strategy 2: PUBLISH_THEN_RESTORE
    // First, modify draft to have draft edits
    await request(getServer())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({
        definition: {
          nodes: [
            ...v2Definition.nodes,
            {
              id: 'action-auto-pub',
              type: 'action.log',
              data: { name: 'To be published v3' },
            },
          ],
          edges: v2Definition.edges,
        },
      })
      .expect(200);

    const restorePubRes = await request(getServer())
      .post(`/api/workflows/${workflowId}/versions/${v1Id}/restore`)
      .send({
        strategy: 'PUBLISH_THEN_RESTORE',
      })
      .expect(200);

    expect(restorePubRes.body.data.strategyUsed).toBe('PUBLISH_THEN_RESTORE');
    expect(restorePubRes.body.data.newPublishedVersionNumber).toBe(3);

    // Verify that Version 3 was indeed created
    const versionsAfterPubRestore = await request(getServer())
      .get(`/api/workflows/${workflowId}/versions`)
      .expect(200);

    expect(versionsAfterPubRestore.body.data).toHaveLength(3);
    expect(versionsAfterPubRestore.body.data[0].versionNumber).toBe(3);

    // And verify current draft was set to Version 1
    const draftAfterPubRestore = await request(getServer())
      .get(`/api/workflows/${workflowId}/draft`)
      .expect(200);

    expect(draftAfterPubRestore.body.data.definition.nodes).toHaveLength(2);

    // 8. Test Strategy 3: BACKUP_THEN_RESTORE
    // Modify draft again
    await request(getServer())
      .put(`/api/workflows/${workflowId}/draft`)
      .send({
        definition: {
          nodes: [
            {
              id: 'trigger-1',
              type: 'trigger.manual',
              data: { name: 'Backup Idea' },
            },
            {
              id: 'action-special',
              type: 'action.idea',
              data: { name: 'Valuable Draft' },
            },
          ],
          edges: [],
        },
      })
      .expect(200);

    const restoreBackupRes = await request(getServer())
      .post(`/api/workflows/${workflowId}/versions/${v2Id}/restore`)
      .send({
        strategy: 'BACKUP_THEN_RESTORE',
        backupWorkflowName: 'My Special Backup Workflow',
      })
      .expect(200);

    expect(restoreBackupRes.body.data.strategyUsed).toBe('BACKUP_THEN_RESTORE');
    expect(restoreBackupRes.body.data.backupWorkflowId).toBeDefined();

    // Verify backup workflow draft has the "Backup Idea" definition
    const backupDraftRes = await request(getServer())
      .get(
        `/api/workflows/${restoreBackupRes.body.data.backupWorkflowId}/draft`,
      )
      .expect(200);

    expect(backupDraftRes.body.data.definition.nodes[0].data.name).toBe(
      'Backup Idea',
    );

    // Verify current workflow draft has Version 2 definition
    const currentDraftAfterBackup = await request(getServer())
      .get(`/api/workflows/${workflowId}/draft`)
      .expect(200);

    expect(currentDraftAfterBackup.body.data.definition.nodes).toHaveLength(3);
  });
});
