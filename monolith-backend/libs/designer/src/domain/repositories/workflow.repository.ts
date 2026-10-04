import { Workflow } from '../entities/workflow.entity';

export abstract class WorkflowRepository {
  abstract findById(id: string): Promise<Workflow | null>;
  abstract findByOwnerId(ownerId: string): Promise<Workflow[]>;
  abstract create(workflow: Workflow): Promise<string>;
  abstract update(workflow: Workflow): Promise<void>;
}
