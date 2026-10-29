import {
  NewWorkflowTrigger,
  TriggerChannel,
  WorkflowTrigger,
} from './workflow-trigger';

export interface StoredCredential {
  connectorKey: string;
  secret: Record<string, unknown>;
}

export abstract class WorkflowTriggerRepository {
  abstract findActive(
    channel: TriggerChannel,
    routingKey: string,
  ): Promise<WorkflowTrigger | null>;
  // Every row of the workflow, active or not (to reuse webhook tokens).
  abstract findByWorkflow(workflowId: string): Promise<WorkflowTrigger[]>;
  // In one transaction: deactivate the workflow's listeners, add the new ones.
  abstract replaceActive(
    workflowId: string,
    workflowVersionId: string,
    triggers: NewWorkflowTrigger[],
  ): Promise<void>;
  abstract findWorkflowOwnerId(workflowId: string): Promise<string | null>;
  abstract findWorkflowName(workflowId: string): Promise<string | null>;
  // Decrypted credential if it exists and belongs to `ownerId`, else null.
  abstract findCredential(
    credentialId: string,
    ownerId: string,
  ): Promise<StoredCredential | null>;
}
