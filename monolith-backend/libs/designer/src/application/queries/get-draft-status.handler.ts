/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { WorkflowDraftRepository } from '../../domain/repositories/workflow-draft.repository';
import { WorkflowVersionRepository } from '../../domain/repositories/workflow-version.repository';

export class GetDraftStatusQuery {
  constructor(public readonly workflowId: string) {}
}

export interface DraftStatusResult {
  workflowId: string;
  hasDraft: boolean;
  hasUnpublishedChanges: boolean;
  currentPublishedVersion: {
    id: string;
    versionNumber: number;
    publishedAt: string;
  } | null;
  draftUpdatedAt: string | null;
}

@QueryHandler(GetDraftStatusQuery)
export class GetDraftStatusHandler implements IQueryHandler<GetDraftStatusQuery> {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly workflowDraftRepo: WorkflowDraftRepository,
    private readonly workflowVersionRepo: WorkflowVersionRepository,
  ) {}

  async execute(query: GetDraftStatusQuery): Promise<DraftStatusResult> {
    const { workflowId } = query;

    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${workflowId} not found.`);
    }

    const draft = await this.workflowDraftRepo.findById(workflowId);
    let currentPublishedVersion: {
      id: string;
      versionNumber: number;
      publishedAt: string;
    } | null = null;

    let targetVersionDef: any = null;

    if (workflow.currentVersionId) {
      const currentVer = await this.workflowVersionRepo.findById(
        workflow.currentVersionId,
      );
      if (currentVer) {
        currentPublishedVersion = {
          id: currentVer.id,
          versionNumber: currentVer.versionNumber,
          publishedAt: currentVer.publishedAt.toISOString(),
        };
        targetVersionDef = currentVer.definition;
      }
    } else {
      // If no currentVersionId, check latest version if any
      const latestVer =
        await this.workflowVersionRepo.findLatestByWorkflowId(workflowId);
      if (latestVer) {
        currentPublishedVersion = {
          id: latestVer.id,
          versionNumber: latestVer.versionNumber,
          publishedAt: latestVer.publishedAt.toISOString(),
        };
        targetVersionDef = latestVer.definition;
      }
    }

    let hasUnpublishedChanges = false;
    if (draft && draft.definition) {
      if (!targetVersionDef) {
        // No published version yet. If draft has nodes, it has unpublished changes.
        const nodes = (draft.definition as any)?.nodes || [];
        hasUnpublishedChanges = nodes.length > 0;
      } else {
        // Compare definition between draft and target version
        const draftStr = JSON.stringify((draft.definition as any)?.nodes || []);
        const versionStr = JSON.stringify(targetVersionDef?.nodes || []);
        hasUnpublishedChanges = draftStr !== versionStr;
      }
    }

    return {
      workflowId,
      hasDraft: !!draft,
      hasUnpublishedChanges,
      currentPublishedVersion,
      draftUpdatedAt: draft?.updatedAt?.toISOString() || null,
    };
  }
}
