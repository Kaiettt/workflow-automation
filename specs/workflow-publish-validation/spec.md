# Feature Specification: Workflow Publish Validation

## 1. Context
When a user publishes a workflow from the designer, the system must validate the draft before creating a new immutable workflow version. The goal is to ensure the workflow is both structurally valid and executable in practice.

This feature is required to prevent publishing broken workflows such as drafts without a trigger, drafts that are disconnected, or drafts whose required node configuration is incomplete.

## 2. Problem Statement
The current workflow publish flow is too permissive if it only checks that a workflow exists and contains a draft. A workflow may still be invalid even when the draft is non-empty.

We need validation before publish to ensure:
- the workflow and draft exist
- the workflow contains trigger and action nodes
- all action nodes are reachable from a trigger in the graph
- every node satisfies its required config schema
- the user receives clear validation feedback in the UI

## 3. Goals
### Primary goals
- block publish when the workflow draft is invalid
- ensure the workflow graph is runnable from trigger to action
- ensure required node fields are present based on configSchema
- return user-friendly errors for frontend rendering

### Non-goals
- full runtime execution simulation
- variable-level expression validation beyond configSchema
- deep semantic validation of external integrations or credential availability

## 4. In-Scope Requirements

### Backend validation requirements
1. Workflow with the given ID must exist.
2. Workflow draft must exist and must not be empty.
3. The workflow must contain at least one trigger node.
4. The workflow must contain at least one action node.
5. Every action node must be reachable from at least one trigger node through the graph.
6. If a trigger-to-action path does not exist, publish must fail.
7. Every node must satisfy its required fields as defined by its configSchema.
8. The system must persist validation errors on the draft so they can be surfaced to the frontend.

### Frontend requirements
9. After a failed publish attempt, the UI must show user-friendly validation messages.
10. Validation messages should be actionable enough for the user to know which node or field needs fixing.
11. The publish button should remain blocked until the workflow is valid.

## 5. Business Rules
### Rule 1: Workflow existence
A publish request is rejected if the workflow ID does not exist.

### Rule 2: Draft existence
A publish request is rejected if the draft is missing or empty.

### Rule 3: Trigger requirement
The graph must contain at least one trigger node.

### Rule 4: Action requirement
The graph must contain at least one action node.

### Rule 5: Reachability requirement
This is the key rule for the feature:
- a trigger-to-action path must exist
- at least one valid path from a trigger to each required action must exist

If an action is disconnected from all triggers, it is not publishable.

### Rule 6: Config schema requirement
Each node must include all required fields defined by its configSchema. This validation is based on the node schema definitions and is not duplicated with separate ad hoc logic.

### Rule 7: Validation error persistence
When validation fails, the draft should store the validation issue so the UI can fetch and display it.

## 6. Validation Behavior
The publish validator should evaluate the workflow graph in this order:
1. workflow existence
2. draft existence and non-empty check
3. trigger check
4. action check
5. graph reachability check (trigger to action)
6. configSchema validation for each node
7. return validation errors

If any step fails, publish is rejected and no new workflow version is created.

## 7. Expected Error Examples
Examples of validation failures:
- "Workflow was not found."
- "Workflow draft is empty or missing."
- "Workflow must contain at least one trigger node."
- "Workflow must contain at least one action node."
- "Action node X is not reachable from any trigger node."
- "Node Y is missing required field Z according to configSchema."

## 8. Acceptance Criteria
### Backend acceptance criteria
- When the workflow does not exist, publish returns a not found error.
- When the draft is missing or empty, publish returns a bad request error.
- When there is no trigger, publish fails.
- When there is no action, publish fails.
- When an action is disconnected from the trigger graph, publish fails.
- When a node is missing required configSchema fields, publish fails.
- When validation succeeds, a new workflow version is created and assigned as the current version.

### Frontend acceptance criteria
- The UI renders a readable validation error summary after a failed publish.
- Errors identify the node or field that needs attention.
- The user can understand what to fix without reading backend logs.

## 9. References
- `monolith-backend/prisma/mvp-node-schemas.ts`
- `specs/mvp-execution/4-execution/definition.json`
- `monolith-backend/libs/designer/src/application/commands/publish-workflow.command.ts`

## 10. Definition of Done
The feature is complete when:
- backend publish validation covers the required graph and schema checks
- frontend displays a clear, user-friendly error state
- validation errors are persisted on the draft when publish fails
- the workflow cannot be published until it is valid