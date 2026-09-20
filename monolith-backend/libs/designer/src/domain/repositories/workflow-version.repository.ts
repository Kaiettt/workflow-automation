import { WorkflowVersion } from '../entities/workflow-version.entity';

export abstract class WorkflowVersionRepository {
  abstract findById(id: string): Promise<WorkflowVersion | null>;
  abstract findByWorkflowId(workflowId: string): Promise<WorkflowVersion[]>;
  abstract findLatestByWorkflowId(
    workflowId: string,
  ): Promise<WorkflowVersion | null>;
  abstract save(version: WorkflowVersion): Promise<void>;
}
