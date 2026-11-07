import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { Workflow } from '../../domain/entities/workflow.entity';

export class RenameWorkflowCommand {
  constructor(
    public readonly workflowId: string,
    public readonly ownerId: string,
    public readonly name: string,
  ) {}
}

@CommandHandler(RenameWorkflowCommand)
export class RenameWorkflowHandler implements ICommandHandler<RenameWorkflowCommand> {
  constructor(private readonly workflowRepo: WorkflowRepository) {}

  async execute(command: RenameWorkflowCommand): Promise<void> {
    const workflow = await this.workflowRepo.findById(command.workflowId);
    if (!workflow || workflow.ownerId !== command.ownerId) {
      throw new NotFoundException('Workflow not found.');
    }
    await this.workflowRepo.update(
      new Workflow(
        workflow.id,
        command.name,
        workflow.ownerId,
        workflow.status,
        workflow.description,
        workflow.currentVersionId,
        workflow.createdAt,
        workflow.updatedAt,
        workflow.active,
      ),
    );
  }
}
