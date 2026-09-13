import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Workflow } from '../../domain/entities/workflow.entity';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';

export class CreateWorkflowCommand {
  constructor(
    public readonly name: string,
    public readonly ownerId: string,
  ) {}
}

@CommandHandler(CreateWorkflowCommand)
export class CreateWorkflowHandler implements ICommandHandler<CreateWorkflowCommand> {
  constructor(private readonly workflowRepo: WorkflowRepository) {}

  async execute(command: CreateWorkflowCommand): Promise<string> {
    const workflow = Workflow.create({
      name: command.name,
      ownerId: command.ownerId,
    });
    console.log('good');
    // Create workflow doesn't create the draft. The draft will be created when saved or fetched.
    // We should create a draft with empty definition if required.
    // The prompt says "create sucesffullt before user can interact with anything".
    const workflowId = await this.workflowRepo.create(workflow);
    return workflowId;
  }
}
