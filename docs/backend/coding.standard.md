# Backend Coding Standard

> **Project:** Workflow Automation / FlowPilot  
> **Stack:** NestJS, TypeScript, PostgreSQL, Prisma, Redis, BullMQ  
> **Architecture:** Modular Monolith + Clean Architecture + CQRS  
> **Runtime concerns:** Workflow execution, connectors, background jobs, SSE

This document defines backend conventions for developers and coding agents. It is intended to preserve the current architecture while making module boundaries, error handling, testing, and operational behavior explicit.

## 1. Core principles

1. **Business rules are explicit and testable.**
2. **Dependencies point inward.** Domain and application code must not depend on infrastructure or transport frameworks.
3. **Modules own their data and behavior.** Cross-module collaboration happens through deliberate public contracts.
4. **Use CQRS where it clarifies intent**, not as ceremony for every simple operation.
5. **Reliability is part of correctness.** Background jobs, workflow execution, and connector calls must account for retries, duplicate delivery, timeouts, and partial failure.
6. **Prefer the simplest design that preserves required boundaries.**
7. **Refactor safely.** Preserve behavior, add characterization/regression tests, and avoid unrelated rewrites.

## 2. Naming conventions

| Item | Convention | Example |
|---|---|---|
| File | kebab-case + role suffix | `start-execution.handler.ts` |
| Class | PascalCase | `StartExecutionHandler` |
| Interface / port | PascalCase, descriptive name | `ExecutionRepository` |
| Plugin contract | Existing `I` prefix may be retained consistently | `INodeDefinition` |
| Enum | PascalCase; values follow domain convention | `ExecutionStatus.RUNNING` |
| Variable/function | camelCase | `workflowId`, `startExecution()` |
| Constant | UPPER_SNAKE_CASE for true constants | `MAX_RETRY_COUNT` |
| DTO | PascalCase + `Dto` | `CreateWorkflowDto` |
| Command/query/event | PascalCase + role suffix | `StartExecutionCommand` |
| Module directory | kebab-case, singular concept | `execution/`, `connector/` |
| Database table | Follow Prisma schema convention consistently | `workflow_executions` |

Do not introduce a naming convention that conflicts with the existing codebase without a migration plan. Names should express domain intent rather than implementation detail.

## 3. Architecture and dependency rules

The intended dependency direction is:

```text
                 ┌──────────────────────┐
                 │     Presentation     │
                 │ Controllers, DTOs    │
                 └──────────┬───────────┘
                            v
                 ┌──────────────────────┐
                 │     Application      │
                 │ Use cases, handlers  │
                 │ Ports, orchestration │
                 └──────────┬───────────┘
                            v
                 ┌──────────────────────┐
                 │        Domain        │
                 │ Rules, entities, VOs │
                 └──────────────────────┘

Infrastructure implements ports defined inward:
Infrastructure ───────> Application / Domain contracts
```

### 3.1 Domain

- Contains domain entities, value objects, domain services, domain events, and domain-level contracts.
- Must not import NestJS, Prisma, BullMQ, HTTP clients, database drivers, or presentation DTOs.
- Must not depend on infrastructure implementations.
- Owns business invariants and state transitions.
- Prefer identity references (IDs) across module boundaries instead of holding another module's entity object.
- Keep domain objects independent of persistence shape.

### 3.2 Application

- Contains use cases, command/query handlers, orchestration services, application ports, and transaction boundaries.
- May use `@nestjs/cqrs` as an application delivery mechanism, but business logic must not depend on Nest HTTP concepts.
- Must not import Prisma clients or concrete infrastructure adapters.
- Coordinates domain objects and ports; it should not become a second domain layer full of business rules.
- Application errors should describe use-case outcomes, not HTTP status codes.

### 3.3 Infrastructure

- Implements repository and service ports.
- Owns Prisma, Redis, BullMQ, external HTTP clients, filesystem access, and framework-specific adapters.
- Converts infrastructure failures into stable application-facing errors where the use case needs to distinguish them.
- Must not leak raw database or provider-specific errors through public API contracts.

### 3.4 Presentation

- Owns HTTP controllers, request/response DTOs, guards, interceptors, pipes, and transport mapping.
- Validates request shape and authentication/authorization context.
- Dispatches use cases through application interfaces or CQRS buses.
- Maps application outcomes to HTTP responses.
- Must not contain business workflows or direct database access.

### 3.5 Module boundaries

- A module exposes a small, intentional public API through its Nest module exports or public entry point.
- Do not import another module's private implementation files.
- Do not access another module's repository or database tables directly as a shortcut.
- Prefer a public application port, facade, command, query, or domain event for cross-module collaboration.
- Avoid circular module dependencies. Do not use `forwardRef()` as the default solution; first inspect ownership and dependency direction.
- Cross-module domain references should generally use IDs and explicit contracts.
- Keep shared-kernel code small. Do not move feature-specific logic into shared code merely to avoid an import.

## 4. Module structure

A feature module may use the following structure where its complexity justifies it:

```text
execution/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   └── repositories/
├── application/
│   ├── commands/
│   ├── queries/
│   ├── services/
│   └── ports/
├── infrastructure/
│   ├── persistence/
│   ├── queue/
│   └── adapters/
├── presentation/
│   ├── controllers/
│   └── dto/
├── execution.module.ts
└── index.ts
```

Do not create empty layers or folders for a small module. The structure should reflect actual responsibilities.

## 5. Dependency injection

- Prefer constructor injection.
- Depend on application/domain contracts rather than concrete infrastructure classes when crossing architectural boundaries.
- TypeScript interfaces are erased at runtime and cannot be used directly as Nest provider tokens. Use a symbol token or abstract class.

```ts
// execution.tokens.ts
export const EXECUTION_REPOSITORY = Symbol("EXECUTION_REPOSITORY");

// execution.module.ts
{
  provide: EXECUTION_REPOSITORY,
  useClass: PrismaExecutionRepository,
}

// handler.ts
constructor(
  @Inject(EXECUTION_REPOSITORY)
  private readonly repository: ExecutionRepository,
) {}
```

- Keep provider registration close to the module that owns the implementation.
- Export only providers required by other modules.
- Do not instantiate injectable services manually with `new` in application code.
- Avoid service locator patterns and property injection.
- Do not add a DI token for every internal class when ordinary constructor composition is sufficient.

## 6. CQRS and use-case conventions

- Use commands for operations that change state and queries for read operations.
- A command/query handler should have one clear use-case responsibility.
- Keep handlers focused on orchestration: load required data, invoke domain behavior, coordinate ports, and return an application result.
- Put invariants and business decisions in domain entities/services or a clearly named policy, not in controllers or generic utility functions.
- Keep commands and queries immutable (`readonly` fields).
- Do not return persistence models directly from public API endpoints.
- Map results to response DTOs at the presentation boundary or through an explicit mapper.
- Use events for meaningful facts that have occurred, not as an indirect replacement for ordinary method calls.
- Event and queue consumers must be idempotent where duplicate delivery is possible.
- Avoid creating a command/handler pair for trivial internal operations when it adds ceremony without improving separation.

Suggested file convention:

```text
start-execution/
├── start-execution.command.ts
├── start-execution.handler.ts
└── start-execution.result.ts
```

Keeping command and handler together is acceptable for small use cases; separate them when the handler or result grows. Follow one convention consistently within a module.

## 7. Error handling

Use errors that communicate the layer and meaning of a failure.

- Domain errors represent violated business invariants.
- Application errors represent use-case outcomes, such as workflow not found, invalid state transition, or connector unavailable.
- Infrastructure errors represent technical failures and should be translated at the adapter boundary when the application needs a stable abstraction.
- HTTP status mapping belongs in presentation (exception filters or controller boundary).
- Do not throw `BadRequestException`, `NotFoundException`, or other Nest HTTP exceptions from domain or application handlers.
- Do not expose stack traces, SQL details, provider responses, secrets, or internal implementation details to API clients.
- Do not catch an error merely to rethrow the same error without adding context or changing behavior.
- Never use empty catch blocks.
- Preserve the original cause when wrapping errors where supported.

Example:

```ts
// Application layer
throw new WorkflowNotFoundError(workflowId);

// Presentation boundary / exception filter
// WorkflowNotFoundError -> HTTP 404
```

Use centralized exception mapping for consistent API responses. Controllers should not each implement their own error translation.

## 8. Validation and API contracts

- Validate external input at the presentation boundary using DTOs and the configured validation pipe.
- Configure whitelist behavior and reject unexpected properties where appropriate.
- Treat webhook payloads, connector responses, queue messages, and persisted JSON as untrusted input.
- Validate domain invariants in the domain/application layer even if the frontend already validates them.
- Do not use DTO validation as a replacement for authorization or business validation.
- Keep request/response contracts stable and version changes deliberately.
- Avoid returning ORM entities or internal database fields directly.
- Use explicit pagination, sorting, and filtering contracts; enforce reasonable limits.
- Normalize errors into the project's documented API error shape.

## 9. Persistence and transactions

- Prisma and database-specific code belong in infrastructure.
- Repositories should expose domain/application-oriented operations, not simply mirror every Prisma method.
- Keep transaction boundaries at the use-case/application level when one operation spans multiple repositories or writes.
- Do not open nested transactions accidentally.
- Make transaction scope as short as practical; do not hold a database transaction open while waiting for an external API or long-running job.
- Enforce important uniqueness and consistency rules in the database as well as application logic.
- Use migrations for schema changes; do not rely on manual production database edits.
- Avoid N+1 queries and unbounded reads. Select only required fields and paginate large result sets.
- Treat JSON columns as versioned contracts when their structure is persisted over time.
- Use optimistic concurrency or explicit locking when concurrent updates could violate invariants.

## 10. Background jobs and workflow execution

Workflow execution and connector calls are distributed operations, even when deployed as a modular monolith.

- Assume a job may be delivered more than once.
- Design job handlers and event consumers to be idempotent.
- Define retryable versus non-retryable failures. Do not retry validation, authorization, or permanent business failures indefinitely.
- Use bounded retries with backoff and jitter where appropriate.
- Set explicit timeouts for external calls and jobs.
- Define job identity, correlation IDs, and execution/node identifiers consistently.
- Persist state transitions deliberately; do not rely only on in-memory state.
- Ensure terminal execution states cannot be overwritten by late duplicate events.
- Handle cancellation, timeout, retry, and partial failure as explicit state transitions.
- Avoid holding database transactions open across queue publishing or external network calls.
- Consider the dual-write problem when persisting state and publishing a job/event. Use an outbox or another documented reliability strategy when loss would violate correctness.
- Do not assume queue ordering or exactly-once delivery unless the infrastructure explicitly guarantees it.
- Keep workflow definitions immutable after publication; execution should reference a stable version.
- Keep the workflow engine independent from transport and queue implementation details.

## 11. Connector and external integration safety

- Treat connector configuration, credentials, webhook payloads, and provider responses as untrusted.
- Never log access tokens, refresh tokens, API keys, passwords, or raw credential-bearing payloads.
- Encrypt credentials at rest and restrict decryption to the smallest required boundary.
- Validate OAuth `state`, redirect URI, scopes, and callback ownership.
- Define token refresh concurrency behavior to prevent refresh races.
- Apply timeouts, bounded retries, and provider-specific rate-limit handling.
- Prevent SSRF in user-configurable HTTP connectors: restrict schemes, validate resolved addresses, block loopback/private/link-local/metadata ranges as appropriate, and revalidate redirects.
- Protect webhook endpoints against replay and unauthorized invocation using signatures, timestamps, secrets, or provider-supported verification.
- Do not trust a connector's declared schema as proof that its runtime output is valid.
- Sanitize provider error messages before returning them to users.
- Keep provider-specific behavior inside connector adapters, not generic workflow orchestration.

## 12. Authentication and authorization

- Authentication establishes identity; authorization decides whether that identity may perform an action on a resource.
- Enforce authorization on every protected backend operation, not only in controllers or the frontend.
- Check resource ownership and tenant/workspace scope explicitly.
- Apply least privilege to service credentials and internal module access.
- Avoid trusting user IDs, roles, or tenant IDs supplied in request bodies when they should come from verified identity context.
- Record security-sensitive administrative actions in an audit trail.
- Do not expose whether a protected resource exists when that would leak information.

## 13. Logging and observability

- Use the project's approved structured logger and consistent log levels.
- Include useful correlation context where available: `requestId`, `workflowId`, `executionId`, `nodeId`, and job ID.
- Never log secrets, tokens, passwords, credential values, or sensitive personal data.
- Log state transitions and operational failures at the layer that has sufficient context.
- Avoid logging the same exception at every layer.
- Do not use `console.log` in production code.
- Metrics and traces should help answer operational questions: execution success/failure, queue latency, node duration, retry count, connector latency, and error category.
- Avoid high-cardinality metric labels such as raw user IDs, workflow IDs, or arbitrary URLs.
- Ensure health checks distinguish process liveness from dependency readiness.

## 14. Configuration and secrets

- Read environment configuration through a centralized, validated configuration mechanism.
- Fail fast on missing required configuration.
- Do not read `process.env` throughout business logic.
- Never commit `.env` files containing real credentials.
- Provide safe example configuration with placeholder values.
- Keep environment-specific configuration outside source code.
- Rotate secrets through the deployment/secret-management process; do not hardcode fallback production secrets.

## 15. TypeScript and code quality

- Keep `strict` TypeScript settings enabled and improve legacy code incrementally rather than weakening the compiler.
- Do not introduce `any`. Use `unknown` with type guards for untrusted or uncertain values.
- Avoid `@ts-ignore`. If suppression is unavoidable, use the narrowest supported directive and explain why.
- Avoid unsafe casts and non-null assertions; validate invariants instead.
- Handle promises explicitly. Do not leave rejected promises floating.
- Avoid broad `eslint-disable` comments and file-level rule suppression.
- Prefer small, cohesive functions and explicit names.
- Avoid generic abstractions that have only one caller and no clear reuse or policy boundary.
- Do not use inheritance where composition is simpler.
- Do not add comments that merely restate the code.

Line counts are review signals, not hard limits. Split files when they contain multiple responsibilities or are difficult to navigate—not solely to satisfy an arbitrary number.

## 16. Testing strategy

Tests should verify behavior at the narrowest layer that provides meaningful confidence.

| Test type | Target | Dependencies |
|---|---|---|
| Unit | Domain rules, value objects, pure functions | No infrastructure |
| Application/use-case | Handler orchestration and outcomes | Fake/in-memory ports or focused mocks |
| Infrastructure integration | Prisma repositories, Redis, BullMQ adapters | Real disposable services where practical |
| HTTP integration / E2E | Routing, validation, auth, response contract, key user journeys | Test application and test dependencies |
| Contract | Connector/provider or module boundaries | Controlled fixtures or provider sandbox |

### 16.1 Test placement

Follow the repository's established Jest configuration and test discovery patterns. Keep production source free of test-only helpers where that is the project convention. Centralized `test/unit`, `test/integration`, `test/e2e`, and `test/support` directories are appropriate if configured and consistently maintained.

Do not create a new test location or suffix without updating Jest configuration and CI.

### 16.2 Test doubles

- Use pure unit tests for domain logic; do not boot Nest or connect to a database for simple business rules.
- Use fake or in-memory repositories for application tests when they provide meaningful behavior and are simpler than mocking every repository method.
- Mock external boundaries when testing failure handling, rare responses, or provider interactions.
- Use real disposable PostgreSQL/Redis services for integration tests that claim to verify those integrations.
- Do not mock Prisma internals in tests intended to validate Prisma repository behavior.
- Do not require every dependency to be mocked in every test category.

### 16.3 What to test

Prioritize:
- Domain invariants and state transitions.
- Workflow draft, publish, and immutable-version behavior.
- Execution lifecycle, idempotency, retries, cancellation, and terminal-state protection.
- Queue publishing/consumption and failure recovery.
- Connector credential lifecycle, OAuth callback validation, timeouts, and unsafe URL rejection.
- Authentication, authorization, tenant/resource ownership, and admin actions.
- API validation and response contracts.
- Persistence constraints and transaction behavior.

### 16.4 Test quality

- Test outcomes and invariants, not private implementation details.
- Include success, failure, boundary, and concurrency cases where relevant.
- Keep tests deterministic. Control clocks, randomness, and external responses.
- Use descriptive test names that state the expected behavior.
- Add regression tests for fixed defects.
- Avoid tests that pass only because all dependencies are mocked to return the expected answer.
- Coverage is a signal, not proof of correctness. Prioritize critical paths and meaningful assertions.

## 17. Git and pull request conventions

Use Conventional Commits:

```text
feat(execution): add node retry policy
fix(connector): reject private network targets
refactor(workflow): simplify version mapping
test(execution): cover duplicate job delivery
docs(architecture): document module boundaries
chore(ci): run backend type-check
```

Pull requests should:

- Address one coherent concern.
- Explain intent and behavior changes.
- Include tests and relevant migration/configuration notes.
- Call out security, data, or operational impact.
- Include screenshots or recordings for meaningful UI/API consumer changes where useful.
- Avoid mixing broad formatting changes with behavioral refactoring.

## 18. Pull request checklist

- [ ] Dependencies follow the intended architecture direction.
- [ ] No domain/application code imports Nest HTTP exceptions or infrastructure implementations.
- [ ] Cross-module access uses an intentional public contract.
- [ ] No new `any`, unsafe cast, floating promise, or broad lint suppression.
- [ ] Errors are translated at the correct boundary.
- [ ] Input, authorization, and tenant/resource ownership are validated.
- [ ] Database changes include migrations and appropriate constraints.
- [ ] Jobs and event handlers account for duplicate delivery and retry behavior.
- [ ] Logs contain useful correlation context but no secrets or sensitive payloads.
- [ ] Tests cover success, failure, and relevant edge cases.
- [ ] Backend lint, type-check, tests, and build pass.
- [ ] Relevant docs, environment examples, and API contracts are updated.

## 19. Exceptions

An exception is acceptable only when the standard approach is unsuitable for a concrete reason. Document:

1. The rule being bypassed.
2. Why the exception is necessary.
3. Its scope and risk.
4. Whether it is permanent or temporary.
5. A follow-up issue when remediation is expected.

Prefer a narrow exception over weakening a project-wide rule.
