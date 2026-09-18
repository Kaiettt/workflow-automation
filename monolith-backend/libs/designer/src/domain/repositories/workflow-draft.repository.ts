import { WorkflowDraft } from '../entities/workflow-draft.entity';

export abstract class WorkflowDraftRepository {
  abstract findById(workflowId: string): Promise<WorkflowDraft | null>;
  abstract upsert(draft: WorkflowDraft): Promise<void>;
}
