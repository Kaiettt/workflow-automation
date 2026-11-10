import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { WorkflowSummaryDto } from '../dtos/workflow-queries.dto';

export class GetWorkflowsQuery {
  constructor(public readonly ownerId: string) {}
}

@QueryHandler(GetWorkflowsQuery)
export class GetWorkflowsHandler implements IQueryHandler<
  GetWorkflowsQuery,
  WorkflowSummaryDto[]
> {
  constructor(private readonly workflowRepo: WorkflowRepository) {}

  async execute(query: GetWorkflowsQuery): Promise<WorkflowSummaryDto[]> {
    const workflows = await this.workflowRepo.findByOwnerId(query.ownerId);
    return workflows.map((w) => ({
      id: w.id,
      name: w.name,
      status: w.status,
      active: w.active,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  }
}
