import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { WorkflowVersionRepository } from '../../domain/repositories/workflow-version.repository';
import { WorkflowVersionDetailDto } from '../dtos/workflow-queries.dto';

export class GetWorkflowVersionQuery {
  constructor(
    public readonly workflowId: string,
    public readonly versionId: string,
  ) {}
}

@QueryHandler(GetWorkflowVersionQuery)
export class GetWorkflowVersionHandler implements IQueryHandler<
  GetWorkflowVersionQuery,
  WorkflowVersionDetailDto
> {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly workflowVersionRepo: WorkflowVersionRepository,
  ) {}

  async execute(
    query: GetWorkflowVersionQuery,
  ): Promise<WorkflowVersionDetailDto> {
    const workflow = await this.workflowRepo.findById(query.workflowId);
    if (!workflow) {
      throw new NotFoundException(
        `Workflow with ID ${query.workflowId} not found.`,
      );
    }

    const version = await this.workflowVersionRepo.findById(query.versionId);
    if (!version || version.workflowId !== query.workflowId) {
      throw new NotFoundException(
        `Version with ID ${query.versionId} not found.`,
      );
    }

    return {
      id: version.id,
      workflowId: version.workflowId,
      versionNumber: version.versionNumber,
      definition: version.definition,
      publishedById: version.publishedById,
      publishedAt: version.publishedAt,
      createdAt: version.createdAt,
    };
  }
}
