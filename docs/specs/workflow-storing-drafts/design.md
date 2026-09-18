# Workflow Draft API Design

## Architecture (Modular Monolith + CQRS)

The implementation resides entirely within `libs/modules/designer`.

### 1. Domain Layer
- **Entities**: 
  - `Workflow`: Represents the workflow metadata.
  - `WorkflowDraft`: Represents the draft definition.
- **Repositories (Ports)**:
  - `WorkflowRepository`: `findById`, `create`.
  - `WorkflowDraftRepository`: `upsert`.

### 2. Application Layer
- **Command & Handler**: `SaveDraftCommand` and `SaveDraftHandler` (combined in `save-draft.handler.ts`)
  - Fetch workflow by ID.
  - If not found, throw a `NotFoundException` (or domain error).
  - Upsert `WorkflowDraft` entity via `WorkflowDraftRepository`.

### 3. Infrastructure Layer
- **Prisma Repositories**: 
  - `PrismaWorkflowRepository`: Implements `WorkflowRepository` using Prisma.
  - `PrismaWorkflowDraftRepository`: Implements `WorkflowDraftRepository` using Prisma `upsert`.
- **Mappers**: Map between Prisma models and Domain entities to avoid leaking DB schema into domain.

### 4. Presentation Layer
- **Controller**: `WorkflowDraftsController` (`PUT /workflows/:id/draft`)
- **DTOs**: `SaveDraftDto` with `class-validator` to ensure `definition` is an object. (The `id` will come from the path parameters).