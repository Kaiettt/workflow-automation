Status: resolved
Type: task

## Objective
Add the "Publish" button to the frontend workflow designer.

## Tasks
1. Update `frontend/src/features/workflow/services/workflow.service.ts` with `publishWorkflow`.
2. Add Publish button in `DesignerLayout`.
3. Implement `handlePublish` in `DesignerPage`.
4. Render validation errors when publish fails.
5. Write React Testing Library tests first (TDD).
