# Feature Specification: Workflow Publish Validation

## 1. Context
When a user publishes a workflow from the designer, the system must validate the draft before creating a new immutable workflow version snapshot. The goal is to ensure the workflow is both structurally valid and executable in practice.

This feature prevents publishing broken workflows such as drafts without a trigger, drafts without executable steps, disconnected/unreachable nodes, or nodes with incomplete required configurations.

## 2. Problem Statement & Canvas Data Model
In the FlowPilot designer, workflow drafts are constructed using React Flow:
- `node.type`: Specifies the React Flow canvas rendering component (e.g., `'triggerNode'`, `'actionNode'`).
- `node.data.key`: Represents the actual domain catalog key (e.g., `'trigger.manual'`, `'integration.google_sheet.readRows'`, `'logic.filter'`, `'data.aggregate'`, `'ai.llm.generate'`, `'integration.gmail.send'`).
- `node.data.config`: Contains user-configured property values for the node.

Node types belong to categories defined in the catalog:
- `TRIGGER`: e.g., `trigger.manual`
- `LOGIC`: e.g., `logic.filter`
- `DATA_PROCESSING`: e.g., `data.aggregate`
- `INTEGRATION`: e.g., `integration.google_sheet.readRows`, `integration.gmail.send`
- `AI`: e.g., `ai.llm.generate`

Validation must properly resolve domain catalog keys, query the catalog for `category` and `configSchema`, and ensure the draft is completely valid before publishing.

## 3. Goals
### Primary goals
- Block workflow publishing when the draft definition is invalid.
- Properly resolve node types via `node.data.key` (with legacy fallback to `node.type` for mock tests).
- Ensure the workflow has at least one valid trigger node.
- Ensure the workflow has at least one action/processing node across all non-trigger categories (`LOGIC`, `DATA_PROCESSING`, `INTEGRATION`, `AI`).
- Ensure every action/processing node is reachable from at least one trigger node via directed edges.
- Validate that all required fields specified by each node type's `configSchema` are provided with non-empty values.
- Store structured validation issues on the draft for frontend display and return HTTP 400 with details.

### Non-goals
- Full execution simulation with external service API calls.
- Deep runtime expression evaluation beyond static configuration schema validation.

## 4. In-Scope Requirements
### Backend validation requirements
1. **Workflow & Draft Existence**: Workflow and workflow draft must exist and draft definition cannot be empty.
2. **Catalog Key Resolution**: Resolve the catalog key from `node.data.key` (or fallback to `node.type` if `node.data.key` is omitted).
3. **Trigger Requirement**: The graph must contain at least one trigger node (`category === 'TRIGGER'` or `node.type === 'triggerNode'`).
4. **Action Requirement**: The graph must contain at least one non-trigger action/processing node (`category !== 'TRIGGER'`).
5. **Node Catalog Verification**: Every node in the graph must exist in the node type catalog (`NodeTypeDefinition`).
6. **Config Schema Validation**: For each node, verify that all fields listed in `configSchema.required` exist in `node.data.config` and are not null, undefined, or empty strings.
7. **Graph Reachability**: Every non-trigger action node must be reachable from at least one trigger node via directed edges.
8. **Validation Issue Persistence**: On validation failure, persist issues in `workflow_drafts.validationErrors` and throw HTTP 400 with the structured issues. On success, clear any existing draft validation errors and create a new immutable `WorkflowVersion`.

## 5. Validation Rules & Issue Codes
| Code | Severity | Trigger Condition |
| :--- | :--- | :--- |
| `NO_TRIGGER` | `error` | Workflow draft contains 0 trigger nodes |
| `NO_ACTION` | `error` | Workflow draft contains 0 non-trigger action/processing nodes |
| `UNKNOWN_NODE_TYPE` | `error` | Node catalog key is not found in `NodeTypeDefinition` catalog |
| `REQUIRED_FIELD_MISSING` | `error` | A field listed in `configSchema.required` is missing, null, or empty string |
| `ACTION_UNREACHABLE` | `error` | An action/processing node cannot be reached from any trigger node |

## 6. Acceptance Criteria
- Valid workflow drafts (such as `definition-saved.json`) publish successfully into a new `WorkflowVersion` snapshot and set `currentVersionId`.
- Drafts missing a trigger fail with `NO_TRIGGER`.
- Drafts with only a trigger fail with `NO_ACTION`.
- Drafts with unconfigured required fields fail with `REQUIRED_FIELD_MISSING` indicating `nodeId` and `field`.
- Drafts with orphaned/unreachable actions fail with `ACTION_UNREACHABLE` indicating `nodeId`.
- Drafts with unknown node keys fail with `UNKNOWN_NODE_TYPE`.
- Stored validation errors are cleared when a valid workflow is successfully published.