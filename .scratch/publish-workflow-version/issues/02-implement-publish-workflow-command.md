Status: resolved
Type: task

## Objective
Implement the `PublishWorkflowCommand` and its handler (`PublishWorkflowHandler`).

## Tasks
1. Create `libs/designer/src/application/commands/publish-workflow.handler.ts`.
2. Implement validation logic inside the handler (exactly 1 trigger, >= 1 action, no disconnected nodes).
3. Update `libs/designer/src/application/commands/save-draft.handler.ts` to clear `validationErrors` to `null` on save.
4. Write failing tests first before implementing the logic (TDD). Test the handler logic directly or wait for the HTTP API seam.
