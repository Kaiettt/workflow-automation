import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { WorkflowDraft } from '../../domain/entities/workflow-draft.entity';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { WorkflowDraftRepository } from '../../domain/repositories/workflow-draft.repository';

export class SaveDraftCommand {
  constructor(
    public readonly workflowId: string,
    public readonly definition: Record<string, any>,
  ) {}
}

@CommandHandler(SaveDraftCommand)
export class SaveDraftHandler implements ICommandHandler<SaveDraftCommand> {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly workflowDraftRepo: WorkflowDraftRepository,
  ) {}

  async execute(command: SaveDraftCommand): Promise<string> {
    const { workflowId, definition } = command;

    const existing = await this.workflowRepo.findById(workflowId);
    if (!existing) {
      throw new NotFoundException(`Workflow with ID ${workflowId} not found.`);
    }

    const draft = WorkflowDraft.create(workflowId, definition);
    draft.validationErrors = null; // Clear previous validation errors
    await this.workflowDraftRepo.upsert(draft);

    return workflowId;
  }
}
