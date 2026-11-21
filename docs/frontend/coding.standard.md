# Frontend Coding Standard

> **Project:** Workflow Automation / FlowPilot  
> **Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui  
> **State:** TanStack Query, Zustand  
> **Routing:** React Router  
> **Workflow editor:** React Flow  
> **Testing:** Vitest, React Testing Library

This document defines the frontend conventions for developers and coding agents. It describes the expected design of new code and the constraints for modifying existing code.

## 1. Core principles

1. **Correctness before cleverness.** Prefer code that is easy to understand, test, and debug.
2. **Feature ownership.** Keep feature-specific code inside its feature.
3. **Explicit data flow.** Server state, shared UI state, and local component state have different owners.
4. **Small, cohesive modules.** Split code when responsibilities or reasons to change differ, not merely to meet a line count.
5. **Accessible by default.** Prefer semantic HTML and accessible interactions.
6. **Avoid speculative abstractions.** Do not introduce generic frameworks, wrappers, or layers without a demonstrated use case.
7. **Preserve existing behavior.** Refactoring must not silently change user-visible behavior or API contracts.

## 2. Project structure and boundaries

Organize the application by feature rather than by global technical folders.

```text
src/
├── app/                       # App bootstrap, providers, router
├── components/
│   ├── ui/                    # Shared UI primitives (including shadcn)
│   └── shared/                # Truly cross-feature components
├── features/
│   ├── workflow/
│   │   ├── api/               # HTTP/SSE transport and endpoint functions
│   │   ├── components/        # Feature UI
│   │   ├── hooks/             # React Query and feature hooks
│   │   ├── pages/             # Route-level screens
│   │   ├── services/          # Feature orchestration / mapping
│   │   ├── store/             # Shared client-side state
│   │   ├── types/             # Feature-owned types
│   │   └── index.ts           # Deliberate public exports
│   └── ...
├── hooks/                     # Generic hooks used by multiple features
├── lib/                       # Configured third-party clients and libraries
├── routes/                    # Route composition, if not owned by app/
├── types/                     # Types genuinely shared across features
└── utils/                     # Small, pure, generic helpers
```

### Boundary rules

- A feature owns its pages, components, hooks, API functions, services, stores, and types.
- A feature must not import another feature's internal file through a deep relative path.
- Cross-feature imports should use the exporting feature's public entry point (`features/<name>/index.ts`) or a deliberately shared module.
- Do not move code into `components/`, `hooks/`, `types/`, or `utils/` merely because it is used twice. Promote it only when it is genuinely generic and has stable ownership.
- Avoid circular dependencies between features.
- Keep `app/` focused on composition and application bootstrap; do not place feature business rules there.

## 3. Naming and file conventions

| Item | Convention | Example |
|---|---|---|
| React component | PascalCase | `WorkflowCard.tsx` |
| Component test | Component name + `.test` | `WorkflowCard.test.tsx` |
| Hook | `use` + PascalCase | `useWorkflowMutations.ts` |
| Service | kebab-case + `.service` | `workflow.service.ts` |
| API module | kebab-case + `.api` | `workflow.api.ts` |
| Store | kebab-case + `.store` | `designer.store.ts` |
| Utility | descriptive kebab-case | `parse-cron.ts` |
| Type module | domain name | `workflow.types.ts` |
| Constants | descriptive kebab-case | `workflow.constants.ts` |

Use names that describe intent. Avoid vague names such as `data.ts`, `helpers.ts`, `common.ts`, or `manager.ts` unless their scope is genuinely clear.

## 4. TypeScript rules

- Keep TypeScript strict mode enabled for application code. Do not weaken compiler settings to make a change pass.
- Do not introduce `any`. Use a concrete type, a generic, or `unknown` followed by runtime validation/narrowing.
- Do not use `as` casts to silence a type error when the value can be validated or modeled correctly.
- Avoid non-null assertions (`!`). If a value is required, establish that invariant explicitly.
- Prefer `type` for unions, intersections, mapped types, and aliases; use `interface` when declaration merging or extension of an object contract is useful. Be consistent within a domain.
- Use `readonly` for values that should not be mutated.
- Model API responses and external data as untrusted input. Validate at runtime when correctness or security depends on the shape.
- Avoid duplicating backend contracts manually when a generated or shared contract is available and maintained.
- Export types intentionally; do not create a global type dumping ground.

```ts
type ExecutionStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

interface WorkflowSummary {
  id: string;
  name: string;
  status: ExecutionStatus;
}
```

## 5. React component design

- Use function components.
- Keep components focused on rendering and coordinating UI interactions.
- Extract a child component when it has an independent responsibility, meaningful reuse, or makes the parent substantially easier to understand.
- Keep complex state transitions and reusable behavior in hooks or feature services.
- Do not create a hook for trivial one-line logic used only once.
- Avoid deeply nested conditional JSX. Use early returns or small named components when they improve readability.
- Use stable keys for rendered collections. Never use array indexes as keys when items can be inserted, removed, or reordered.
- Keep effects for synchronization with external systems. Do not use effects to derive values that can be computed during render.
- Do not suppress React hook dependency warnings without documenting and understanding the reason.
- Do not add `React.memo`, `useMemo`, or `useCallback` by default. Use them when profiling, expensive computation, referential stability requirements, or a known rendering issue justifies them.
- Do not define components inside other components unless there is a clear reason and remount behavior is understood.

### Component size

Line counts are review signals, not hard limits. A 250-line cohesive component may be clearer than several artificial wrappers. Split a file when it has multiple responsibilities, difficult-to-follow state transitions, or independent testing needs.

## 6. State management

Choose state ownership deliberately:

| State | Preferred owner | Examples |
|---|---|---|
| State used by one component | `useState` / `useReducer` | Dialog open, input draft |
| Server state | TanStack Query | Workflows, executions, connectors |
| Shared client/UI state | Zustand | Selected node, canvas state, undo/redo, sidebar |
| URL/shareable navigation state | Router/search params | Filters, selected tab, page |

Rules:

- Do not copy API responses into Zustand when TanStack Query can own the server state.
- Do not use TanStack Query as a general-purpose UI state store.
- Avoid duplicating the same state in multiple stores.
- Keep Zustand stores focused. Prefer selectors to subscribing components to the entire store.
- Reset feature state when its lifecycle ends if stale state could affect another workflow or user session.
- Keep derived values derived; do not store them unless there is a measured reason.

## 7. Data access and API layering

Use a simple, consistent flow:

```text
Page / Component
       |
       v
Feature hook (TanStack Query)
       |
       v
Feature service (only when orchestration/mapping is needed)
       |
       v
API module / shared API client
       |
       v
Backend
```

Rules:

- Components must not construct raw HTTP requests.
- Query and mutation hooks should own cache keys, invalidation, optimistic updates, and request lifecycle.
- API modules own transport details: URL, HTTP method, headers, serialization, and response parsing.
- A service is appropriate when it coordinates multiple API calls, applies feature-level mapping, or encapsulates reusable feature behavior. Do not add a service that only forwards one function without adding value.
- Centralize authentication, base URL, common headers, and transport-level error handling in the configured API client.
- Keep query keys centralized or consistently factory-based within each feature.
- Invalidate the smallest correct query scope after mutations.
- Use optimistic updates only when rollback and reconciliation behavior are defined.
- Do not swallow errors or convert every failure into a generic success-shaped response.

## 8. Forms and validation

- Use React Hook Form for forms with meaningful state, validation, or dynamic fields.
- Use Zod for schemas where runtime validation is needed; infer TypeScript types from schemas where practical.
- Keep field-level validation and user-facing messages close to the form.
- Validate on the client for usability, but treat backend validation as authoritative.
- Disable duplicate submission while a mutation is pending when duplicate requests would be harmful.
- Preserve user input when a recoverable submission error occurs.
- Ensure labels, descriptions, errors, and controls are programmatically associated.

## 9. UI, styling, and accessibility

- Prefer existing shadcn/ui components and shared project components before building a new primitive.
- shadcn/ui is a preferred component foundation, not a requirement to wrap every HTML element. Semantic native HTML is appropriate.
- Extend or compose existing components instead of copying their implementation.
- Use Tailwind utilities for ordinary layout and styling. Add CSS modules or standalone CSS when styles are complex, reusable, or clearer outside class strings.
- Avoid arbitrary values when a design token or existing spacing/color scale fits.
- Do not use color as the only way to communicate status.
- Interactive elements must be keyboard accessible and expose accessible names and states.
- Use buttons for actions and links for navigation.
- Use correct heading hierarchy, labels, landmarks, and table semantics.
- Dialogs and popovers must manage focus and support keyboard dismissal according to their interaction pattern.
- Do not remove focus indicators without providing an accessible replacement.
- Prefer accessible Testing Library queries (`getByRole`, `getByLabelText`) over CSS selectors.

## 10. React Flow and workflow designer

- Keep custom node components separate from workflow execution/business rules.
- Keep node rendering, node configuration forms, and node metadata distinct where this improves cohesion.
- Use stable node and edge identifiers.
- Avoid mutating React Flow node/edge objects directly; use the supported state update APIs.
- Keep canvas-only transient state in the designer store, not in persisted workflow definitions unless it is part of the domain contract.
- Validate workflow structure on the backend as well as in the UI.
- Handle large canvases carefully; avoid unnecessary updates to every node when one node changes.
- Document any custom connection, selection, or keyboard interaction that differs from React Flow defaults.

## 11. Error, loading, and empty states

Every asynchronous user-facing view must intentionally handle the states relevant to its operation:

- Initial loading
- Empty result
- Success
- Recoverable error
- Permission/authorization failure
- Pending mutation or submission

Rules:

- Show actionable, understandable feedback; do not expose stack traces or internal server details.
- Preserve useful context when an action fails.
- Use the shared notification/error presentation where available.
- Do not show duplicate notifications for the same error at multiple layers.
- A `catch` block must handle, enrich, or rethrow the error. Never leave it empty.
- Cancellation and expected control-flow outcomes should not be reported as unexpected errors.

## 12. Async behavior and real-time updates

- Handle loading, cancellation, retries, and component unmounting deliberately.
- Avoid fire-and-forget promises. Await them, return them, or explicitly handle rejection.
- For SSE or WebSocket clients, define connection lifecycle, reconnect policy, event validation, deduplication, and terminal-state behavior.
- Clean up subscriptions and listeners when their owner unmounts.
- Do not assume events arrive exactly once or in order unless the server contract guarantees it.
- Keep polling as a deliberate fallback with bounded frequency and a clear stop condition.
- Do not log credentials, tokens, personal data, or full sensitive payloads.

## 13. Performance

- Measure before optimizing.
- Avoid unnecessary global state subscriptions and broad query invalidations.
- Paginate or virtualize genuinely large collections.
- Debounce user input only when it improves the interaction and define when the pending value is committed.
- Lazy-load large route-level or editor-only dependencies where beneficial.
- Keep expensive parsing and transformations out of repeated render paths when profiling shows a problem.
- Do not sacrifice correctness or accessibility for speculative performance gains.

## 14. Constants and configuration

- Replace unexplained values with named constants when they represent policy, domain meaning, or reused configuration.
- Keep environment-specific values in environment configuration, not source code.
- Validate required environment variables at application startup.
- Never commit secrets, API keys, tokens, or production credentials.
- Avoid creating enums for every two-value local condition; use literal unions when simpler.

## 15. Logging and debugging

- Remove temporary `console.log`, debugger statements, and test-only code before merging.
- Use the project's approved logging/telemetry mechanism for production diagnostics.
- Do not log secrets, access tokens, credential values, or sensitive user payloads.
- Include useful identifiers (for example, workflow ID or execution ID) when they help trace an operation and are safe to expose.
- Avoid logging the same error at every layer.

## 16. Comments and documentation

- Prefer expressive names and simple control flow over comments that repeat the code.
- Comment the reason, invariant, trade-off, or non-obvious behavior—not what the next line does.
- Document public feature contracts and complex state transitions.
- Mark temporary work with an owner or issue reference where possible; avoid permanent vague TODOs.
- Update relevant documentation when changing behavior, API contracts, environment variables, or developer workflows.

## 17. Testing

### 17.1 Test location and naming

Keep tests close to the code they verify unless the repository's test tooling or integration setup requires a centralized test directory.

| Subject | Example |
|---|---|
| Component | `WorkflowCard.test.tsx` |
| Hook | `useWorkflowMutations.test.tsx` |
| Service | `workflow.service.test.ts` |
| Store | `designer.store.test.ts` |
| Utility | `parse-cron.test.ts` |

Follow the repository's actual Vitest configuration. Do not exclude tests from type-checking without an explicit reason.

### 17.2 What to test

- **Utilities and transformations:** normal cases, boundary values, invalid inputs.
- **Stores:** initial state, actions, reset behavior, and important invariants.
- **Services/API modules:** request construction, mapping, and error propagation.
- **Hooks:** query keys, mutation lifecycle, cache invalidation, and error behavior.
- **Components:** user-visible behavior, validation, loading/error/empty states, accessibility, and important interactions.
- **Workflow designer:** node/edge updates, selection, configuration, and persistence boundaries.
- **Real-time clients:** reconnect behavior, duplicate events, invalid payloads, cleanup, and terminal states.

### 17.3 Test practices

- Test observable behavior rather than implementation details.
- Prefer role- and label-based queries.
- Use `userEvent` for realistic interactions.
- Mock external boundaries (HTTP, browser APIs, third-party services), not every internal function.
- Use MSW or the project's established API mocking approach when it provides more realistic request-level tests.
- Avoid brittle snapshots for complex UI.
- Keep tests deterministic; control time, randomness, and asynchronous events where necessary.
- Do not assert only that a mocked function was called when a user-visible outcome can be tested.
- Add regression tests for bugs before or alongside the fix.

### 17.4 Coverage

Coverage is a diagnostic, not a substitute for meaningful assertions. Prioritize critical workflow paths, authorization-sensitive UI, data transformations, and complex state transitions. Agree on thresholds in CI and raise them incrementally; do not add meaningless tests just to satisfy a percentage.

## 18. Security and privacy

- Treat all user input, URL parameters, API responses, and external connector data as untrusted.
- Do not store secrets or access tokens in source code or browser storage unless the authentication design explicitly requires it and the risks are addressed.
- Do not render untrusted HTML. If rich HTML is required, sanitize it with an approved sanitizer.
- Avoid leaking sensitive data in URLs, logs, error messages, analytics, or client-side state.
- Enforce authorization on the backend; frontend route guards are user experience, not a security boundary.
- Validate file type, size, and user permissions before upload.
- Do not weaken Content Security Policy or browser security settings to work around a development issue.

## 19. Imports and module exports

Use the configured `@/` alias for imports from the frontend source root.

Recommended grouping:

1. React and framework imports
2. Third-party packages
3. Application aliases
4. Relative imports
5. Styles

Follow the formatter and lint rules for ordering. Avoid barrel files that create cycles or hide expensive imports. A feature `index.ts` should export only its intended public API.

## 20. Pull request checklist

Before requesting review:

- [ ] The change follows feature and module boundaries.
- [ ] No new `any`, unsafe cast, or unexplained non-null assertion was introduced.
- [ ] Server state and client state have the correct owners.
- [ ] Loading, empty, error, and success states are handled where applicable.
- [ ] Keyboard and screen-reader behavior is considered for interactive UI.
- [ ] Tests cover the behavior and important regression cases.
- [ ] No debug logs, secrets, or sensitive payloads are included.
- [ ] Relevant documentation and API contracts are updated.
- [ ] Frontend lint, type-check, tests, and build pass.

## 21. Exceptions

A rule may be intentionally broken when there is a concrete technical reason. The author must:

1. Explain why the standard approach is unsuitable.
2. Describe the scope and risk of the exception.
3. Add a comment or ADR when the exception affects architecture or future maintenance.
4. Add a follow-up issue if the exception is temporary.

Do not add broad lint or TypeScript suppressions to bypass a local problem.
