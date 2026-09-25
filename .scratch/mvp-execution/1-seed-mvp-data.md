---
labels: ["ready-for-agent"]
---

## Problem Statement

The workflow execution MVP requires a specific set of foundational data to be present in the database before it can be run. This data includes a single unified Google OAuth connector (`google`) that requests both Sheets and Gmail scopes, and node type definitions (`trigger.manual`, `integration.google_sheet.readRows`, `logic.filter`, `integration.gmail.send`). Since the main `seed.ts` file is already quite large, adding this MVP-specific data there would clutter it.

## Solution

Create a separate seed script (`seed-mvp.ts`) dedicated to bootstrapping the database with the catalogs and credentials needed specifically for the Google Sheet -> Filter -> Gmail workflow MVP.

## User Stories

1. As a developer, I want to run a dedicated MVP seed script, so that I can populate the database with the exact node types and connectors needed for the MVP execution without modifying the core system seed file.
2. As a backend system, I want the node types to be present in the database, so that the execution engine can resolve the node types defined in a user's workflow graph.

## Implementation Decisions

- **Seed Script Location**: Create a new file at `monolith-backend/prisma/seed-mvp.ts`.
- **Data Source**: Use the JSON payloads defined in `.scratch/mvp-execution/sample-data.md` for `connectors`, `connector_credentials`, `node_type_definitions`, `workflows`, `workflow_drafts`, and `workflow_versions`.
- **Idempotency**: Use Prisma's `upsert` for all records based on their UUIDs to ensure the script can be run multiple times without throwing duplicate key errors.
- **Run Command**: Update `package.json` with a script to run this specific seed file (e.g., `npm run seed:mvp`).

## Testing Decisions

- The primary test is manual verification: Running the seed script should exit cleanly with a success message.
- Inspecting the database (using Prisma Studio) should reveal the correct number of rows in the targeted tables.

## Out of Scope

- Setting up an automated pipeline to run this seed file in production. This is strictly for local development and testing of the MVP.

## Further Notes

- The seed script should insert the `users` (owner) first, then `connectors`, then `connector_credentials`, then `node_type_definitions`, and finally the `workflows` to respect foreign key constraints.
