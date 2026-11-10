import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { WorkflowVersionRepository } from '../../domain/repositories/workflow-version.repository';
import { WorkflowVersionSummaryDto } from '../dtos/workflow-queries.dto';

export class GetWorkflowVersionsQuery {
  constructor(public readonly workflowId: string) {}
}

@QueryHandler(GetWorkflowVersionsQuery)
export class GetWorkflowVersionsHandler implements IQueryHandler<
  GetWorkflowVersionsQuery,
  WorkflowVersionSummaryDto[]
> {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly workflowVersionRepo: WorkflowVersionRepository,
  ) {}

  async execute(
    query: GetWorkflowVersionsQuery,
  ): Promise<WorkflowVersionSummaryDto[]> {
    const workflow = await this.workflowRepo.findById(query.workflowId);
    if (!workflow) {
      throw new NotFoundException(
        `Workflow with ID ${query.workflowId} not found.`,
      );
    }

    const versions = await this.workflowVersionRepo.findByWorkflowId(
      query.workflowId,
    );

    return versions.map((v) => ({
      id: v.id,
      workflowId: v.workflowId,
      versionNumber: v.versionNumber,
      publishedAt: v.publishedAt,
      publishedById: v.publishedById,
    }));
  }
}
