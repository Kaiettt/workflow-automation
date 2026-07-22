import { WorkflowDraft as PrismaWorkflowDraft } from '@prisma/client';
import { WorkflowDraft } from '../../../domain/entities/workflow-draft.entity';

export class WorkflowDraftMapper {
  static toDomain(prismaDraft: PrismaWorkflowDraft): WorkflowDraft {
    return new WorkflowDraft(
      prismaDraft.workflowId,
      prismaDraft.definition as Record<string, any>,
      prismaDraft.validationErrors as Record<string, any> | null,
      prismaDraft.lockedById,
      prismaDraft.lockedAt,
      prismaDraft.updatedAt,
    );
  }
}
