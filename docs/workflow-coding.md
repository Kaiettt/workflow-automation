# Feature Development Workflow

All agents must follow **Specification-Driven Development (SDD)** and **Test-Driven Development (TDD)** when implementing features or significant changes.

## 1. Understand

- Inspect the existing codebase, architecture, and related features.
- Identify dependencies, constraints, and potential risks.
- Reuse existing patterns instead of introducing unnecessary abstractions.

## 2. Specify

Create or update `specs/<feature-name>/`:

- `spec.md`: Requirements, behavior, constraints, and acceptance criteria.
- `design.md`: Architecture, components, API contracts, and data model.
- `plan.md`: Implementation approach and milestones.
- `task.md`: Ordered, actionable implementation checklist.

Keep documents concise and consistent. Avoid duplicating information.

## 3. Review Before Implementation

Verify that:

- Requirements are clear and testable.
- Design aligns with existing architecture.
- Tasks are small and actionable.
- Important edge cases and failure scenarios are covered.

Resolve significant ambiguities before implementation.

## 4. Implement Using TDD

Follow the Red → Green → Refactor cycle:

1. **Red:** Write a test that fails for the expected reason.
2. **Green:** Implement the minimum code to pass.
3. **Refactor:** Improve the implementation while keeping tests green.

Follow the applicable coding standards:

- `docs/backend/coding.standard.md`
- `docs/frontend/coding.standard.md`

Update `task.md` as work progresses.

## 5. Verify and Complete

Before finishing:

- Run relevant tests, lint, and build.
- Verify acceptance criteria.
- Check for regressions and unintended changes.
- Update documentation if implementation or design changed.
- Mark completed tasks accurately.

Never claim a test or command passed unless it was actually executed.

## Rules

- Do not implement behavior that is not covered by the specification.
- Do not skip tests for behavior-changing code.
- Do not weaken tests merely to make them pass.
- Keep implementation and documentation synchronized.
- Prefer simple solutions consistent with the existing architecture.

## Final Report

Summarize:
- What was implemented.
- Important design decisions.
- Tests and verification results.
- Remaining tasks or known limitations.