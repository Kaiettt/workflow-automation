---
labels: ["ready-for-agent"]
---

## Problem Statement

The workflow designer frontend (`DesignerPage.tsx`) needs to display a catalog of available node types and integrations to the user so they can drag and drop them onto the canvas. Currently, this data is hardcoded or missing, and it needs to be fetched dynamically from the backend database.

## Solution

Design and implement two RESTful API endpoints in the backend to fetch the node type definitions and connectors from the database, and update the frontend `DesignerPage.tsx` to consume these APIs.

## User Stories

1. As a workflow designer, I want to see a list of available node types, so that I can add triggers and logic blocks to my workflow.
2. As a workflow designer, I want to see a list of available integrations, so that I can connect my workflow to external services like Gmail or Google Sheets.

## Implementation Decisions

- **Backend Controllers**: 
  - Create a new `NodeTypesController` in the monolith backend.
  - Create a new `ConnectorsController` in the monolith backend.
- **API Endpoints**:
  - `GET /api/node-types`: Returns a list of all active records from the `node_type_definitions` table.
  - `GET /api/connectors`: Returns a list of all active records from the `connectors` table.
- **Frontend Integration**:
  - Update `workflow.service.ts` to include methods for fetching node types and connectors.
  - In `DesignerPage.tsx` (or a related context/store), fetch this data on load and pass it to the sidebar/palette component.
- **Caching**: For this MVP, we will not implement complex caching; fetching directly from the database on page load is sufficient.

## Testing Decisions

- **Backend**: Write integration tests for the two new GET endpoints to ensure they return the expected JSON structures (as seeded by the MVP seed script).
- **Frontend**: Test that the `DesignerPage` component correctly handles loading states and displays the items retrieved from the mock or actual API.

## Out of Scope

- Implementing pagination or search/filtering on the backend for these endpoints. The number of nodes/connectors is small enough for the MVP to return all of them at once.
- Real-time updates to the catalog via WebSockets.

## Further Notes

- The API design follows standard RESTful principles as per the NestJS guidelines of the project.
