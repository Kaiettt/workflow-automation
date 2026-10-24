# Design: Workflow Publish Validation

## 1. Overview
The publish validation feature sits in the designer application layer (`monolith-backend/libs/designer`) and validates a workflow draft before creating an immutable `WorkflowVersion` snapshot.

Validation is organized into three sequential layers:
1. **Existence validation**: Verifies workflow and draft exist and draft definition is non-empty.
2. **Catalog & Schema validation**: Resolves node keys via `node.data.key` (with fallback to `node.type`), fetches schemas via `GetNodeConfigSchemasQuery`, verifies catalog existence, and checks required config properties against `configSchema.required`.
3. **Graph structure & Reachability validation**: Verifies at least one trigger node exists, at least one action/processing node exists, and all action nodes are reachable from a trigger node through directed edges.

## 2. Architecture & CQRS Integration
### Application Layer
- `PublishWorkflowCommand`: Dispatched with `workflowId` and `publishedById`.
- `PublishWorkflowHandler`: Orchestrates the validation and version snapshot creation.
- `GetNodeConfigSchemasQuery`: CQRS query dispatched to `@app/node-library` to fetch catalog metadata (`key`, `category`, `configSchema`) in a single batch query.

### Domain Models
- `Workflow`: Root workflow entity. Updated with `currentVersionId` on publish success.
- `WorkflowDraft`: Stores canvas `definition` (`nodes[]`, `edges[]`) and `validationErrors`.
- `WorkflowVersion`: Immutable version record created upon passing validation.

## 3. Node Resolution & Taxonomy
### Canvas Data Structure
React Flow stores nodes on canvas as:
```json
{
  "id": "actionNode-1792220527195",
  "type": "actionNode",
  "data": {
    "key": "ai.llm.generate",
    "name": "LLM",
    "config": {
      "provider": "gemini",
      "model": "gemini-3.5-flash-lite",
      "prompt": "..."
    }
  }
}
```

### Key Resolution Helper
To support both production React Flow drafts and test fixtures:
```ts
const getNodeKey = (node: any): string | undefined => {
  if (typeof node?.data?.key === 'string' && node.data.key.length > 0) {
    return node.data.key;
  }
  if (
    typeof node?.type === 'string' &&
    node.type !== 'actionNode' &&
    node.type !== 'triggerNode'
  ) {
    return node.type;
  }
  return undefined;
};
```

### Classification
- **Triggers**: Nodes where `nodeType.category === 'TRIGGER'` or `node.type === 'triggerNode'`.
- **Actions / Processing Nodes**: Nodes where `category !== 'TRIGGER'` and `node.type !== 'triggerNode'` (covers `LOGIC`, `DATA_PROCESSING`, `INTEGRATION`, `AI`).

## 4. Graph Reachability Algorithm
1. Construct adjacency list: `adjacency: Map<string, string[]>` from `edges[].source` -> `edges[].target`.
2. Initialize `reachable: Set<string>` and queue with all trigger node IDs.
3. Traverse graph using BFS/DFS. Mark each visited node in `reachable`.
4. Iterate over all action nodes. If an action node ID is not in `reachable`, push `ACTION_UNREACHABLE` issue with `nodeId`.

## 5. Schema Validation Algorithm
1. For each node, resolve `key = getNodeKey(node)`.
2. Look up `nodeType = nodeTypesByKey.get(key)`.
3. If not found in catalog, push `UNKNOWN_NODE_TYPE`.
4. If found, inspect `schema = nodeType.configSchema as { required?: string[] }`.
5. For each `field` in `schema.required`:
   - Inspect `value = node.data?.config?.[field]`.
   - If `value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0)`, push `REQUIRED_FIELD_MISSING` with `nodeId` and `field`.

## 6. Execution & Persistence Flow
1. If `issues.length > 0`:
   - Persist `{ issues }` to `draft.validationErrors`.
   - Throw `BadRequestException({ message: 'Workflow validation failed.', issues })`.
2. If `issues.length === 0`:
   - Clear `draft.validationErrors = null`.
   - Calculate next `versionNumber`.
   - Create and persist `WorkflowVersion`.
   - Update `workflow.currentVersionId` to the newly created version ID.
   - Return `{ versionId, versionNumber }`.
