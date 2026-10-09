Status: resolved
Type: task

## Objective
Expose the publish command via HTTP.

## Tasks
1. Add `POST /workflows/:id/versions` in `libs/designer/src/presentation/http/workflows.controller.ts`.
2. Map HTTP request to `PublishWorkflowCommand`.
3. Handle 400 validation error responses.
4. Write an e2e/integration test for this seam.
