/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { WorkflowRepository } from '@app/designer/domain/repositories/workflow.repository';
import { WorkflowVersionRepository } from '@app/designer/domain/repositories/workflow-version.repository';
import { Workflow } from '@app/designer/domain/entities/workflow.entity';
import { WorkflowVersion } from '@app/designer/domain/entities/workflow-version.entity';
import { WorkflowStatus } from '@app/designer/domain/enums/workflow-status.enum';
import {
  GetWorkflowsQuery,
  GetWorkflowsHandler,
} from '@app/designer/application/queries/get-workflows.query';
import {
  GetWorkflowVersionsQuery,
  GetWorkflowVersionsHandler,
} from '@app/designer/application/queries/get-workflow-versions.query';
import {
  GetWorkflowVersionQuery,
  GetWorkflowVersionHandler,
} from '@app/designer/application/queries/get-workflow-version.query';

describe('Workflow Queries Handlers', () => {
  let workflowRepo: jest.Mocked<WorkflowRepository>;
  let workflowVersionRepo: jest.Mocked<WorkflowVersionRepository>;

  beforeEach(() => {
    workflowRepo = {
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<WorkflowRepository>;

    workflowVersionRepo = {
      findById: jest.fn(),
      findByWorkflowId: jest.fn(),
      findLatestByWorkflowId: jest.fn(),
      save: jest.fn(),
    };
  });

  describe('GetWorkflowsHandler', () => {
    it('returns mapped workflow summaries for owner', async () => {
      const now = new Date();
      const mockWorkflows = [
        new Workflow(
          'wf-1',
          'Workflow 1',
          'owner-1',
          WorkflowStatus.DRAFT,
          null,
          null,
          now,
          now,
          false,
        ),
      ];
      workflowRepo.findByOwnerId.mockResolvedValue(mockWorkflows);

      const handler = new GetWorkflowsHandler(workflowRepo);
      const result = await handler.execute(new GetWorkflowsQuery('owner-1'));

      expect(workflowRepo.findByOwnerId).toHaveBeenCalledWith('owner-1');
      expect(result).toEqual([
        {
          id: 'wf-1',
          name: 'Workflow 1',
          status: WorkflowStatus.DRAFT,
          active: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    });
  });

  describe('GetWorkflowVersionsHandler', () => {
    it('throws NotFoundException when workflow does not exist', async () => {
      workflowRepo.findById.mockResolvedValue(null);

      const handler = new GetWorkflowVersionsHandler(
        workflowRepo,
        workflowVersionRepo,
      );

      await expect(
        handler.execute(new GetWorkflowVersionsQuery('wf-missing')),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns list of version summaries when workflow exists', async () => {
      const now = new Date();
      workflowRepo.findById.mockResolvedValue(
        new Workflow('wf-1', 'Workflow 1', 'owner-1', WorkflowStatus.PUBLISHED),
      );
      workflowVersionRepo.findByWorkflowId.mockResolvedValue([
        new WorkflowVersion('v-1', 'wf-1', 1, {}, 'owner-1', now, now),
      ]);

      const handler = new GetWorkflowVersionsHandler(
        workflowRepo,
        workflowVersionRepo,
      );
      const result = await handler.execute(
        new GetWorkflowVersionsQuery('wf-1'),
      );

      expect(result).toEqual([
        {
          id: 'v-1',
          workflowId: 'wf-1',
          versionNumber: 1,
          publishedAt: now,
          publishedById: 'owner-1',
        },
      ]);
    });
  });

  describe('GetWorkflowVersionHandler', () => {
    it('throws NotFoundException when workflow does not exist', async () => {
      workflowRepo.findById.mockResolvedValue(null);

      const handler = new GetWorkflowVersionHandler(
        workflowRepo,
        workflowVersionRepo,
      );

      await expect(
        handler.execute(new GetWorkflowVersionQuery('wf-missing', 'v-1')),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when version does not belong to workflow', async () => {
      workflowRepo.findById.mockResolvedValue(
        new Workflow('wf-1', 'Workflow 1', 'owner-1', WorkflowStatus.PUBLISHED),
      );
      workflowVersionRepo.findById.mockResolvedValue(
        new WorkflowVersion(
          'v-other',
          'wf-other',
          1,
          {},
          'owner-1',
          new Date(),
        ),
      );

      const handler = new GetWorkflowVersionHandler(
        workflowRepo,
        workflowVersionRepo,
      );

      await expect(
        handler.execute(new GetWorkflowVersionQuery('wf-1', 'v-other')),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns version detail DTO when found', async () => {
      const now = new Date();
      workflowRepo.findById.mockResolvedValue(
        new Workflow('wf-1', 'Workflow 1', 'owner-1', WorkflowStatus.PUBLISHED),
      );
      workflowVersionRepo.findById.mockResolvedValue(
        new WorkflowVersion(
          'v-1',
          'wf-1',
          1,
          { nodes: [], edges: [] },
          'owner-1',
          now,
          now,
        ),
      );

      const handler = new GetWorkflowVersionHandler(
        workflowRepo,
        workflowVersionRepo,
      );
      const result = await handler.execute(
        new GetWorkflowVersionQuery('wf-1', 'v-1'),
      );

      expect(result).toEqual({
        id: 'v-1',
        workflowId: 'wf-1',
        versionNumber: 1,
        definition: { nodes: [], edges: [] },
        publishedById: 'owner-1',
        publishedAt: now,
        createdAt: now,
      });
    });
  });
});
