# Backend Tasks: Workflow Publish Validation

## Phase 1: Validation model and graph checks
- [x] Define the validation issue contract (`PublishValidationIssue`, `PublishValidationReport`)
- [x] Resolve catalog keys using `node.data.key` (with fallback to `node.type`)
- [x] Classify trigger nodes (`TRIGGER`) and non-trigger operational nodes (`LOGIC`, `DATA_PROCESSING`, `INTEGRATION`, `AI`)
- [x] Add graph traversal logic to ensure every action/processing node is reachable from at least one trigger
- [x] Reject publish when validation fails with structured issues

## Phase 2: Config schema validation
- [x] Query node catalog schemas via `GetNodeConfigSchemasQuery`
- [x] Validate required config fields from `configSchema.required` for each node
- [x] Flag `UNKNOWN_NODE_TYPE` if node key is not in catalog
- [x] Flag `REQUIRED_FIELD_MISSING` with node and field context if required property is missing/empty

## Phase 3: Publish command and persistence
- [x] Update `PublishWorkflowCommand` to validate draft before version creation
- [x] Persist structured validation issues in `workflow_drafts.validationErrors`
- [x] Prevent version creation when validation fails
- [x] Ensure successful publishing creates a version and updates `workflow.currentVersionId`
- [x] Clear validation errors when publish succeeds

## Phase 4: Unit & E2E Tests (TDD)
- [x] Add unit test suite in `test/unit/designer/application/commands/publish-workflow.handler.spec.ts`
- [x] Test full valid workflow draft from `definition-saved.json` succeeds
- [x] Test workflow with no trigger fails with `NO_TRIGGER`
- [x] Test workflow with no action fails with `NO_ACTION`
- [x] Test action unreachable from trigger fails with `ACTION_UNREACHABLE`
- [x] Test missing required config field fails with `REQUIRED_FIELD_MISSING`
- [x] Test unknown node catalog key fails with `UNKNOWN_NODE_TYPE`

## Definition of Done
- [x] Publish is rejected for invalid workflow graphs
- [x] Validation enforces trigger-to-action reachability
- [x] Required fields are validated against `configSchema`
- [x] Validation issues are returned and persisted in structured format
- [x] Valid workflow draft (`definition-saved.json`) publishes successfully