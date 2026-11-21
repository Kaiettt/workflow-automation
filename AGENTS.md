
# AGENTS.md

## Project Overview

Workflow Automation Platform.

- Frontend: React, TypeScript, Vite.
- Backend: NestJS, TypeScript, Modular Monolith.
- Database: PostgreSQL, Prisma.
- Queue and cache: Redis, BullMQ.
- Architecture: Clean Architecture, CQRS.

## Instructions Before Coding

1. Inspect the existing implementation before making changes.
2. Understand the relevant modules and their dependencies.
3. Read the applicable coding standard:
   - Frontend: `docs/frontend/coding.standard.md`
   - Backend: `docs/backend/coding.standard.md`
4. Check related tests and existing patterns.
5. Prefer extending existing abstractions over introducing new ones.

## Architecture Rules

- Preserve the Modular Monolith architecture.
- Keep module boundaries explicit.
- Keep business logic independent of framework-specific concerns.
- Do not introduce unnecessary abstractions or dependencies.
- Avoid unrelated refactoring.
- Do not duplicate existing functionality.

## Implementation Rules

- Follow the relevant coding standard.
- Use strict TypeScript types. Avoid `any`.
- Handle errors and asynchronous operations explicitly.
- Validate external input.
- Consider transaction boundaries and data consistency.
- Add tests for new or changed behavior.
- Never silently change existing API contracts.

## Before Completing a Task

Run applicable checks:

1. Lint.
2. Type checking.
3. Relevant unit and integration tests.
4. Build.

If a check cannot run, explain why.

## Final Response

Summarize:

- What changed.
- Important implementation decisions.
- Tests and validation performed.
- Known limitations or remaining work.

Do not claim that a test, build, or validation passed unless it was actually executed.


## Feature Development Workflow

For behavior-changing features, enhancements, significant refactors, and bug fixes, follow `docs/workflow-coding.md`. It defines the grilling confirmation gate, BDD scenario traceability, scaled feature artifacts, and the TDD cycle.