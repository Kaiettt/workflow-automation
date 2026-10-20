# Design: Workflow Publish Validation

## 1. Overview
The publish validation feature sits in the designer application layer and validates the workflow draft before creating an immutable version snapshot.

The validation is split into three layers:
1. existence validation
2. graph validation
3. node schema validation

This keeps the logic testable, easy to extend, and aligned with the existing CQRS architecture.

## 2. Architecture
### Domain layer
- `Workflow`: workflow metadata
- `WorkflowDraft`: draft definition and validation error metadata
- `WorkflowVersion`: published immutable snapshot

### Application layer
- `PublishWorkflowCommand`
- `PublishWorkflowHandler`

The handler will perform these steps:
- load workflow by ID
- load draft by workflow ID
- reject empty or missing draft
- validate node graph structure
- validate node configSchema values
- if valid, create version and update workflow current version
- if invalid, store validation errors and reject with 400

### Infrastructure layer
- `WorkflowRepository`
- `WorkflowDraftRepository`
- `WorkflowVersionRepository`

The validation logic is implemented in the application layer; repositories remain responsible for persistence only.

## 3. Validation model
Use a structured validation object so the frontend can show precise errors.

```ts
export type ValidationIssue = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  nodeId?: string;
  field?: string;
};

export type ValidationReport = {
  isValid: boolean;
  issues: ValidationIssue[];
};
```

Example issues:
- missing action node
- missing trigger node
- action unreachable from any trigger
- required config field missing

## 4. Graph validation algorithm
### Inputs
- `nodes[]`
- `edges[]`

### Rules
- if workflow not found -> invalid
- if draft missing/empty -> invalid
- if no trigger nodes -> invalid
- if no action nodes -> invalid
- build adjacency map from edges
- mark nodes reachable from each trigger
- ensure every action node is reachable from at least one trigger

### Pseudocode
```ts
const triggers = nodes.filter(node => node.type?.startsWith('trigger'));
const actions = nodes.filter(node => node.type?.startsWith('action'));

if (triggers.length === 0) {
  issues.push({ code: 'NO_TRIGGER', message: 'Workflow must contain at least one trigger node.' });
}

if (actions.length === 0) {
  issues.push({ code: 'NO_ACTION', message: 'Workflow must contain at least one action node.' });
}

const adjacency = new Map<string, string[]>();
for (const edge of edges) {
  adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
}

const reachable = new Set<string>();
for (const trigger of triggers) {
  const stack = [trigger.id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }
}

for (const action of actions) {
  if (!reachable.has(action.id)) {
    issues.push({
      code: 'ACTION_UNREACHABLE',
      message: `Action node ${action.data?.name ?? action.id} is not reachable from any trigger node.`,
      nodeId: action.id,
    });
  }
}
```

## 5. Schema validation
This part reuses the node schema definitions in `mvp-node-schemas.ts`.

For each node:
- look up the schema by node type
- compare required fields against the node config
- if required fields are missing, report the node and field name

Example:
```ts
const schema = nodeSchemas[node.type];
const requiredFields = schema.required ?? [];

for (const field of requiredFields) {
  if (!node.config?.[field] && node.config?.[field] !== false && node.config?.[field] !== 0) {
    issues.push({
      code: 'REQUIRED_FIELD_MISSING',
      message: `Missing required field "${field}" for node "${node.data?.name ?? node.id}".`,
      nodeId: node.id,
      field,
    });
  }
}
```

## 6. Publish handler flow
```ts
const workflow = await this.workflowRepo.findById(workflowId);
if (!workflow) throw new NotFoundException(...);

const draft = await this.workflowDraftRepo.findById(workflowId);
if (!draft || !draft.definition) throw new BadRequestException(...);

const validationReport = validateWorkflowForPublish(draft.definition);
if (!validationReport.isValid) {
  draft.validationErrors = validationReport.issues;
  await this.workflowDraftRepo.upsert(draft);
  throw new BadRequestException({
    message: 'Workflow validation failed.',
    issues: validationReport.issues,
  });
}

const newVersion = WorkflowVersion.create(...);
await this.workflowVersionRepo.save(newVersion);

workflow.currentVersionId = newVersion.id;
await this.workflowRepo.update(workflow);
```

## 7. Frontend behavior
The API response should return structured validation issues.

Frontend handling:
- show a summary banner on the publish failure
- render per-node validation messages
- highlight affected node in the canvas or properties panel
- disable publish while the graph is invalid

Example API error payload:
```json
{
  "message": "Workflow validation failed.",
  "issues": [
    {
      "code": "ACTION_UNREACHABLE",
      "severity": "error",
      "nodeId": "node-8",
      "message": "Action node Send Email is not reachable from any trigger node."
    }
  ]
}
```

## 8. Testing strategy
### Unit tests
- workflow with no trigger -> fail
- workflow with no action -> fail
- trigger exists but action unreachable -> fail
- valid trigger-to-action path -> pass
- missing required schema field -> fail

### Integration tests
- publish valid workflow creates version
- publish invalid workflow stores validationErrors
- publish invalid workflow does not create version

## 9. Risks and mitigations
### Risk: false positives from disconnected but valid node groups
Mitigation: reachability is evaluated relative to trigger nodes, not against all nodes globally.

### Risk: schema check duplicated in multiple places
Mitigation: centralize validation in a reusable validator service.

### Risk: unclear frontend errors
Mitigation: return structured issues with `code`, `message`, `nodeId`, and `field`.

## 10. Definition of done
The feature is complete when:
- graph validation is implemented for trigger/action reachability
- configSchema validation is enforced for required fields
- validation errors are stored and returned in a structured format
- publish is blocked until the workflow is valid
- frontend shows clear, user-friendly errors
