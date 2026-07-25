import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { WorkflowDraftRepository } from '../../domain/repositories/workflow-draft.repository';
import { WorkflowDraft } from '../../domain/entities/workflow-draft.entity';

export class GetWorkflowDraftQuery {
  constructor(public readonly workflowId: string) {}
}

@QueryHandler(GetWorkflowDraftQuery)
export class GetWorkflowDraftHandler implements IQueryHandler<GetWorkflowDraftQuery> {
  constructor(private readonly workflowDraftRepo: WorkflowDraftRepository) {}

  async execute(query: GetWorkflowDraftQuery): Promise<WorkflowDraft> {
    const draft = await this.workflowDraftRepo.findById(query.workflowId);
    if (!draft) {
      throw new NotFoundException(`Draft for workflow ID ${query.workflowId} not found.`);
    }
    return draft;
  }
}
