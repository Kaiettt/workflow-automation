---
labels: ["ready-for-agent"]
---

## Problem Statement

The workflow designer frontend (`DesignerPage.tsx`) needs to display a catalog of available node types and integrations to the user so they can drag and drop them onto the canvas. Currently, this data is hardcoded or missing, and it needs to be fetched dynamically from the backend database.

## Solution

Design and implement a RESTful API endpoint in the backend to fetch the node type definitions from the database, and update the frontend `DesignerPage.tsx` to consume this API.

## User Stories

1. As a workflow designer, I want to see a list of available node types, so that I can add triggers and logic blocks to my workflow.

## Implementation Decisions

- **Backend Controllers**: 
  - Create a new `NodeTypesController` in the monolith backend (inside `libs/node-library`).
- **API Endpoints**:
  - `GET /api/node-types`: Returns a list of all active records from the `node_type_definitions` table.
- **Frontend Integration**:
  - Update `workflow.api.ts` to include methods for fetching node types.
  - In `DesignerPage.tsx` (or a related context/store), fetch this data on load and pass it to the sidebar/palette component.
- **Dynamic Configuration UI**:
  - The `PropertiesPanel` currently shows a raw textarea for `settings`. This needs to be replaced.
  - Using the selected node's `type` (or `data.key`), find the corresponding `nodeTypeDefinition` from the fetched catalog.
  - Iterate over `configSchema.properties`. For each property:
    - Render a label (using the property key or a human-readable format).
    - If `type` is `string` and has an `enum`, render a `<select>`.
    - If it has `"x-connectorKey"`, render a "Connect" button instead of an input (the actual OAuth popup flow will be handled in Ticket 3).
    - Otherwise, render a standard text `<input>`.
    - Support dynamic variables: If `"x-allowExpression": true`, styling or a toggle should indicate that it accepts dynamic variables (e.g. `{{nodeId.output}}`).

- **UI/UX Enhancements (Fix Notes)**:
  - **Visuals**: Show the `icon` (logo) and `color` from the Node Type Definition in both the left sidebar (palette) and the actual nodes rendered on the design canvas.
  - **Connections**: Update the React Flow custom nodes so that each node supports connecting to other nodes from all 4 sides (top, bottom, left, right). Currently, it only supports top and bottom.
  - **Sidebar Cleanup**: Completely remove the "Integrations" section from the left-hand sidebar, as we no longer load connectors for the sidebar.

- **Caching**: For this MVP, we will not implement complex caching; fetching directly from the database on page load is sufficient.

## Testing Decisions

- **Backend**: Write integration tests for the two new GET endpoints to ensure they return the expected JSON structures (as seeded by the MVP seed script).
- **Frontend**: Test that the `DesignerPage` component correctly handles loading states and displays the items retrieved from the mock or actual API.

## Out of Scope

- Implementing pagination or search/filtering on the backend for this endpoint. The number of nodes is small enough for the MVP to return all of them at once.
- Real-time updates to the catalog via WebSockets.

## Further Notes

- The API design follows standard RESTful principles as per the NestJS guidelines of the project.
