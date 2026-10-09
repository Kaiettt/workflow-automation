Status: resolved

## Problem Statement

The Workflow Designer needs a reliable server-side persistence boundary for editable workflow graphs. Drafts may be incomplete or invalid while a user is designing, so they must not be treated as published workflow definitions.

## Solution

Create a Designer backend module that exposes workflow creation and draft persistence through HTTP APIs. The module uses Clean Architecture and CQRS, with domain repository interfaces and Prisma implementations.

## API Contracts

### Create Workflow

```http
POST /workflows
```

Creates the workflow metadata required before the designer can save a draft.

### Get Workflow Draft

```http
GET /workflows/:id/draft
```

Returns the current draft definition for an existing workflow. A workflow without a saved draft may return `404`; the frontend may treat this as an empty graph during the MVP.

### Save Workflow Draft

```http
PUT /workflows/:id/draft
```

Request body:

```json
{
  "definition": {
    "nodes": [],
    "edges": [],
    "viewport": {}
  }
}
```

The response confirms a successful save and includes the workflow ID and update timestamp.

## Business Rules

- The parent workflow must exist before a draft can be saved.
- Each workflow has at most one draft.
- Saving a draft uses upsert semantics.
- A draft may contain an incomplete or invalid graph; saving must not block on graph validation.
- Draft data remains separate from published workflow versions.

## Architecture Requirements

- Domain: `Workflow` and `WorkflowDraft` entities plus repository interfaces.
- Application: commands for creating and saving, and a query for retrieving a draft.
- Infrastructure: Prisma repositories and mappers.
- Presentation: DTOs and NestJS controllers.
- Module assembly: the Designer module is registered in the API application and exposed in Swagger.

## Acceptance Criteria

- A client can create a workflow, save its graph, and retrieve the same graph.
- Saving a draft for a missing workflow returns a not-found error.
- Repeated saves update the same draft record instead of creating duplicates.
- The frontend can use the APIs for its autosave flow.

