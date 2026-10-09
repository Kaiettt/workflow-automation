Status: resolved

## Problem Statement

Users need a visual way to create and edit workflow graphs. Writing a workflow definition manually as JSON is error-prone and prevents business users from designing automations independently.

## Solution

Provide a Workflow Designer MVP built with React Flow. A user can create or open a workflow, compose a graph on a canvas, configure nodes, and automatically save the current draft.

## User Stories

1. As a user, I want to create a workflow before opening the designer, so that changes are associated with a workflow ID.
2. As a user, I want to load an existing workflow draft, so that I can continue editing it.
3. As a user, I want to drag nodes from a palette onto a canvas, so that I can build a workflow visually.
4. As a user, I want to move, connect, select, and delete nodes and edges, so that I can change the workflow graph.
5. As a user, I want to configure the selected node in a properties panel, so that each node can hold its required settings.
6. As a user, I want my changes to save automatically and see the saving state, so that I do not lose work.

## Functional Requirements

### Open Designer

- Creating a new workflow calls `POST /workflows` before canvas interaction is enabled.
- Opening an existing workflow calls `GET /workflows/:id/draft` and maps the saved definition onto the canvas.

### Canvas Operations

- The node palette initially contains mock node types, including trigger and action examples.
- Users can drag nodes to the canvas, move them, connect them, select them, and remove nodes or edges.
- The designer stores a React Flow graph composed of `nodes`, `edges`, and `viewport`.

### Node Configuration

- The properties panel displays the selected node.
- Node configuration is stored in `node.data.config`.
- The MVP may use predefined configuration fields; future versions will generate forms from `node_type_definitions.config_schema`.

### Autosave

- Changes are debounced for approximately two seconds.
- The current graph is sent to `PUT /workflows/:id/draft`.
- The UI presents `Saving...` and `Saved` states.

## Data Contract

The draft definition follows this shape:

```json
{
  "nodes": [],
  "edges": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

## Out of Scope

- Authentication and authorization.
- Graph validation and publishing.
- Workflow execution and scheduling.
- Dynamic node catalog, connector credentials, and AI workflow generation.

## Acceptance Criteria

- A user can create a workflow and open the designer.
- A user can add, move, connect, select, configure, and delete canvas elements.
- Reloading a workflow restores its saved draft graph.
- Editing the graph triggers autosave and reports its state in the UI.

