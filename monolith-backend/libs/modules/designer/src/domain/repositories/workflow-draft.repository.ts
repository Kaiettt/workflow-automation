import { WorkflowDraft } from '../entities/workflow-draft.entity';

export abstract class WorkflowDraftRepository {
  abstract upsert(draft: WorkflowDraft): Promise<void>;
}
