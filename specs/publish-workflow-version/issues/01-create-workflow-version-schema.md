Status: resolved
Type: task

## Objective
Implement the `WorkflowVersion` entity, update `Workflow` and `WorkflowDraft` entities, and create the corresponding repositories as defined in the `docs/schema/schema.md` and `spec.md`.

## Tasks
1. Create `WorkflowVersion` entity (`libs/designer/src/domain/entities/workflow-version.entity.ts`).
2. Create `WorkflowVersionRepository` interface (`libs/designer/src/domain/repositories/workflow-version.repository.ts`).
3. Update `Workflow` entity (`libs/designer/src/domain/entities/workflow.entity.ts`) to add `currentVersionId`.
4. Update `WorkflowDraft` entity (`libs/designer/src/domain/entities/workflow-draft.entity.ts`) to add `validationErrors`.
