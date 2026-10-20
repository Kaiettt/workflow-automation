# Backend Tasks: Workflow Publish Validation

## Phase 1: Validation model and graph checks
- [x] Define the validation issue contract (`ValidationIssue`, `ValidationReport`)
- [x] Add graph traversal logic for detecting trigger and action nodes
- [x] Ensure every action is reachable from at least one trigger
- [x] Reject publish when validation fails

## Phase 2: Config schema validation
- [x] Use node schema definitions from `mvp-node-schemas.ts`
- [x] Validate required config fields for each node type
- [x] Include node and field context in schema validation issues

## Phase 3: Publish command and persistence
- [x] Update `PublishWorkflowCommand` to validate the draft before version creation
- [x] Persist structured validation issues in `workflow_drafts.validationErrors`
- [x] Prevent version creation when validation fails
- [x] Ensure successful publishing creates a version and updates the workflow's current version
- [x] Clear stale validation errors when a subsequent draft is saved

## Phase 4: Backend tests
- [x] Add a test for a workflow with no trigger
- [x] Add a test for a workflow with no action
- [x] Add a test for an action unreachable from every trigger
- [x] Add a test for a missing required configSchema field
- [x] Add an integration test verifying valid publish creates a version
- [x] Verify invalid publish persists issues and creates no version

## Definition of done
- [x] Publish is rejected for invalid workflow graphs
- [x] Validation enforces trigger-to-action reachability
- [x] Required fields are validated from configSchema
- [x] Validation issues are returned and persisted in a structured format
- [x] A valid workflow publishes successfully