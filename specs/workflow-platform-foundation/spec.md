Status: resolved

## Problem Statement

CrabFlowPilot needs a clear technical foundation before workflow-design and execution features can be developed safely. Without agreed product scope, module boundaries, a database model, and a reproducible local environment, later features would become tightly coupled and difficult to evolve.

## Solution

Establish the MVP foundation for a workflow-automation platform. The foundation defines the product boundary, adopts a modular-monolith architecture, provides the initial PostgreSQL schema, and prepares frontend, backend, Prisma, and local database tooling.

## Scope

### Included

- Define the MVP scope and the principal product modules.
- Use a Modular Monolith backend with Clean Architecture and CQRS.
- Establish frontend and backend technology choices.
- Model workflow, draft, published version, connector, execution, and execution-log data in Prisma/PostgreSQL.
- Prepare PostgreSQL through Docker Compose and Prisma migrations.

### Excluded

- Distributed execution and multi-region deployment.
- Real-time collaboration.
- Connector marketplace and a large connector catalog.
- Full execution runtime, monitoring, and production CI/CD.
- AI workflow generation.

## Architecture Decisions

### Frontend

- React 19, TypeScript, Vite, React Flow, Zustand, Tailwind CSS, and shadcn/base-ui.

### Backend

- NestJS, TypeScript, CQRS, Swagger, and Prisma ORM.
- Each business module is separated into Domain, Application, Infrastructure, and Presentation layers.

### Database and Local Infrastructure

- PostgreSQL is the primary relational database.
- Prisma owns the schema and migrations.
- Docker Compose provides the local PostgreSQL service.

## Data Model Requirements

The initial schema must support the following concepts:

- `users` and roles.
- `workflows` as workflow metadata and ownership.
- `workflow_drafts` as one editable draft per workflow.
- `workflow_versions` as immutable published snapshots.
- `node_type_definitions` for node metadata and configuration schemas.
- `connectors` and `connector_credentials` for future integrations.
- `executions` and `execution_node_logs` for future runtime observability.

## Acceptance Criteria

- The project has documented product scope, architecture, and core data relationships.
- Frontend and backend applications can be started as separate applications.
- Prisma schema and migrations represent the core workflow domain.
- A local PostgreSQL instance can be started with Docker Compose.
- The database model keeps editable drafts separate from immutable published versions.

