import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Workflow } from '../../domain/entities/workflow.entity';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { WorkflowDraftRepository } from '../../domain/repositories/workflow-draft.repository';
import { WorkflowDraft } from '../../domain/entities/workflow-draft.entity';

export class CreateWorkflowCommand {
  constructor(
    public readonly name: string,
    public readonly ownerId: string,
  ) { }
}

@CommandHandler(CreateWorkflowCommand)
export class CreateWorkflowHandler implements ICommandHandler<CreateWorkflowCommand> {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly workflowDraftRepo: WorkflowDraftRepository,
  ) { }

  async execute(command: CreateWorkflowCommand): Promise<string> {
    const workflow = Workflow.create({
      name: command.name,
      ownerId: command.ownerId,
    });
    const workflowId = await this.workflowRepo.create(workflow);

    // Automatically create an empty draft for the new workflow
    const emptyDraft = WorkflowDraft.create(workflowId, { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });
    await this.workflowDraftRepo.upsert(emptyDraft);

    return workflowId;
  }
}
