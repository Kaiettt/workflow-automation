import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';

export class DeleteWorkflowCommand {
  constructor(
    public readonly workflowId: string,
    public readonly ownerId: string,
  ) {}
}

@CommandHandler(DeleteWorkflowCommand)
export class DeleteWorkflowHandler implements ICommandHandler<DeleteWorkflowCommand> {
  constructor(private readonly workflowRepo: WorkflowRepository) {}

  async execute(command: DeleteWorkflowCommand): Promise<void> {
    const workflow = await this.workflowRepo.findById(command.workflowId);
    if (!workflow || workflow.ownerId !== command.ownerId) {
      throw new NotFoundException('Workflow not found.');
    }
    await this.workflowRepo.delete(command.workflowId);
  }
}
