Status: resolved

## Problem Statement

Published workflows will eventually need a runtime that can execute nodes predictably, handle failures, and record enough information for users to diagnose runs. The project needs an agreed execution model before implementation begins.

## Solution

Define the initial execution-module boundary and the lifecycle of a node execution. This is a design and scaffolding effort only; no executable workflow runtime is included in this phase.

## Node Execution Lifecycle

For each node, the future execution engine will:

1. Interpolate incoming data into node configuration.
2. Retrieve the required connector credential.
3. Run the node implementation.
4. Apply retry and error-handling policy when necessary.
5. Normalize the output for downstream nodes.
6. Persist execution and node-log data.

## Required Domain Concepts

- An execution references a specific published `WorkflowVersion`.
- An execution has an overall lifecycle and status.
- Each executed node produces a node log containing status, input, output, error, retry count, and timing information.
- Credentials are retrieved through the connector boundary rather than embedded in a workflow definition.

## Scope

### Included

- Define module responsibilities and directory structure.
- Define the node-execution lifecycle.
- Prepare the schema concepts for executions and node logs.

### Excluded

- Running workflow graphs.
- Queue processing, parallel execution, retry implementation, and timeouts.
- Connector runners and credential encryption implementation.
- Execution monitoring UI and workflow-log UI.

## Acceptance Criteria

- The project has a documented execution lifecycle and clear module boundary.
- The database model contains the concepts needed for executions and node logs.
- The Execution Module can be implemented later without redefining the workflow-version contract.

