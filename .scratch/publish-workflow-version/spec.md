Status: ready-for-agent

## Problem Statement

Users need a way to confidently transition a draft workflow into an immutable published state so that it can be safely executed. Currently, there is no mechanism to enforce validation (like having a trigger and an action) and take a snapshot of the current draft for execution. 

## Solution

A new "Publish" capability inside the Designer. When a user clicks "Publish":
1. The backend will validate the workflow draft to ensure it has exactly 1 trigger, at least 1 action, and no disconnected nodes or empty required fields.
2. If validation fails, the UI will display the errors so the user can fix them. The errors are persisted in the draft.
3. If validation succeeds, the backend takes a snapshot of the draft and creates an immutable `WorkflowVersion` with an auto-incrementing integer version number.
4. The draft remains 1:1 with the workflow, and any subsequent edits will clear the old validation errors.

## User Stories

1. As a Business User, I want to click a "Publish" button in the workflow designer so that I can make my workflow available for execution.
2. As a Business User, I want the system to warn me if my workflow doesn't have a trigger so that I don't publish an un-runnable workflow.
3. As a Business User, I want the system to warn me if my workflow doesn't have any actions so that I don't publish a useless workflow.
4. As a Business User, I want the system to warn me if there are disconnected nodes so that I can connect them properly.
5. As a Business User, I want the system to highlight validation errors clearly on the UI so that I know exactly which nodes to fix.
6. As a Business User, I want my previous validation errors to clear as soon as I edit the draft again so that I know I can re-attempt publishing.
7. As an Admin, I want published workflows to be immutable and versioned (1, 2, 3) so that executions are always tied to a predictable snapshot of the graph.

## Implementation Decisions

- **Database Schema**: We are adhering strictly to the `docs/schema/schema.md`. The `workflow_drafts` table remains 1:1 with `workflows`. The `workflow_versions` table is used to store the immutable snapshots (using an integer `versionNumber`).
- **Validation Logic**: Handled at the application layer inside a new `PublishWorkflowCommand`. Validation checks for exactly one node with `type` starting with `trigger.`, at least one node where `type` doesn't start with `trigger.`, and no disconnected nodes.
- **Persistence of Errors**: If publish fails, the backend will return a 400 response with the errors, and save these errors into the `validationErrors` field of the `WorkflowDraft` record.
- **Draft Auto-save Update**: When the `SaveDraftCommand` runs (which handles autosaves on every user change), it will explicitly set `validationErrors` to `null` to ensure old publish errors don't stick around.
- **Frontend Changes**: A "Publish" button is added to the `DesignerLayout`. The `DesignerPage` will manage the publish state, invoking the new API endpoint and handling success/error states (via toasts and node highlighting).

## Testing Decisions

- **Testing Seam**: The fewest number of seams is ideal. We will test at the highest possible seams.
- **Backend Testing**: Integration tests on `POST /workflows/:id/versions` and `PUT /workflows/:id/draft`. This checks the `PublishWorkflowHandler` and `SaveDraftHandler` end-to-end, validating database states and API responses without mocking the CQRS command bus or internal services.
- **Frontend Testing**: React Testing Library will be used on `DesignerPage.tsx` to mount the designer, simulate the "Publish" button click, and assert that validation errors are rendered or success toasts appear.

## Out of Scope

- Executing the published workflow (handled by the Execution Engine).
- Reverting/rolling back to a previous workflow version from the UI.
- Complex data transformations or expression language validation within node properties (only required fields are checked).

## Further Notes

- The `WorkflowVersion` repository will need to be created if it doesn't already exist.
