import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ExecutionHistoryPage } from '../../../domain/models/execution.types';
import { ExecutionRepository } from '../../../domain/repositories/execution.repository';

export class ListExecutionsQuery {
  constructor(
    readonly workflowId: string,
    readonly ownerId: string,
    readonly workflowVersionId: string | undefined,
    readonly cursor: string | undefined,
    readonly limit: number,
  ) {}
}

@QueryHandler(ListExecutionsQuery)
export class ListExecutionsHandler implements IQueryHandler<ListExecutionsQuery> {
  constructor(private readonly repository: ExecutionRepository) {}

  execute(query: ListExecutionsQuery): Promise<ExecutionHistoryPage> {
    return this.repository.listExecutionHistoryForOwner({
      workflowId: query.workflowId,
      ownerId: query.ownerId,
      workflowVersionId: query.workflowVersionId,
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}
