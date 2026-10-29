import { randomUUID } from 'crypto';
import { WorkflowStatus } from '../enums/workflow-status.enum';

export class Workflow {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly ownerId: string,
    public readonly status: WorkflowStatus,
    public readonly description?: string | null,
    public currentVersionId?: string | null,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    // The Active switch; changed only by the triggers module.
    public readonly active: boolean = false,
  ) {}

  static create(props: {
    id?: string;
    name: string;
    ownerId: string;
  }): Workflow {
    return new Workflow(
      props.id || randomUUID(),
      props.name,
      props.ownerId,
      WorkflowStatus.DRAFT,
    );
  }
}
