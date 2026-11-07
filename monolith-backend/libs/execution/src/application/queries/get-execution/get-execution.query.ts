import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ExecutionRepository } from '../../../domain/repositories/execution.repository';

export class GetExecutionQuery {
  constructor(
    readonly executionId: string,
    readonly ownerId: string,
  ) {}
}

@QueryHandler(GetExecutionQuery)
export class GetExecutionHandler implements IQueryHandler<GetExecutionQuery> {
  constructor(private readonly repository: ExecutionRepository) {}

  async execute(query: GetExecutionQuery): Promise<unknown> {
    const execution = await this.repository.findExecutionResultForOwner(
      query.executionId,
      query.ownerId,
    );
    if (!execution) throw new NotFoundException('Execution not found');
    return execution;
  }
}
