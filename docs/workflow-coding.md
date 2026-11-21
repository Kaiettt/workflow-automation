# Feature Development Workflow

Use this workflow for features, enhancements, significant refactors, and bug fixes that change behavior. Scale the documentation to the change, but keep the clarification, BDD, and TDD gates for behavior changes.

## 1. Understand and clarify

Inspect the existing implementation, related tests, architecture, project context, applicable coding standards, and available test commands. Establish repository facts yourself before asking the user.

For behavior-changing work, invoke the `grilling` skill:

- Start with a short clarification round for a straightforward change. Expand into a full design-tree interview when decisions are ambiguous, risky, or have competing solutions.
- Ask all currently answerable questions in a round, number them, and give a recommended answer for each. Wait for the user's answers, then recompute the next question frontier.
- Do not ask the user to discover facts available in the repository or environment.
- When the frontier is settled, present a concise shared-understanding summary covering requirements, constraints, scenarios, design choices, and material test seams. Wait for explicit user confirmation before treating the specification as approved or implementing. If the user declines or asks to stop, stop.

## 2. Specify and write BDD scenarios

Store approved feature artifacts under `specs/<feature-name>/`. `.scratch/` may hold temporary discovery notes and issue-tracking tickets; promote the approved specification into `specs/` before implementation.

For a feature, enhancement, or significant change, create or update:

- `spec.md`: requirements, constraints, acceptance criteria, and stable-ID Given/When/Then scenarios.
- `design.md`: architecture, components, API contracts, data model, and material test seams.
- `plan.md`: implementation approach and milestones.
- `task.md`: ordered tasks and validation evidence.

For a narrow bug fix, use a concise `spec.md` for the expected behavior and relevant scenarios, plus `task.md` for implementation and test evidence. Add `design.md` or `plan.md` when the fix has material design or sequencing decisions. Expand the artifacts if the scope grows.

Trace every acceptance criterion to one or more BDD scenarios. Include meaningful failure and boundary cases; do not create a separate scenario for every trivial variant. BDD scenarios describe observable behavior and are the source for implementation-level test coverage.

## 3. Review before implementation

Confirm that:

- The user-approved understanding, requirements, and constraints are reflected in the spec.
- Acceptance criteria and BDD scenarios are clear, observable, and traceable.
- The design, public test seams, and test layers fit the architecture and have no unresolved material decisions.
- Tasks are actionable and small enough for vertical implementation slices.

Resolve gaps with the user before implementation. Do not implement behavior outside the approved specification.

## 4. Implement BDD-first with TDD

Use BDD to define behavior, then TDD to implement it at the most appropriate test layer. Trace each scenario to automated verification, choosing the lowest practical layer that proves the behavior. Reserve end-to-end tests for journeys that need cross-boundary validation; a scenario does not require a one-to-one end-to-end test.

Work in vertical slices, one behavior at a time:

1. **Red:** Add a meaningful test for an approved behavior and run it. Confirm it fails because the behavior is missing or incorrect, not because of setup or environment failure.
2. **Green:** Make the smallest production change that passes the test and relevant existing tests.
3. **Refactor:** Improve the code while keeping the tests green.

Record the test layer, command, expected Red result, and Green result in `task.md`. If the Red test cannot be run, record the blocker and do not claim that the TDD cycle is complete. For non-behavioral edits, a new failing test is unnecessary; mechanical refactors still need characterization coverage for the behavior they preserve.

Follow the applicable coding standards:

- `docs/backend/coding.standard.md`
- `docs/frontend/coding.standard.md`

## 5. Verify and complete

- Run relevant tests, lint, type-check, and build commands for the affected projects.
- Verify each acceptance criterion against its BDD scenarios and test evidence.
- Check for regressions and unintended behavior changes.
- Keep the implementation, specification, design, plan, and task evidence synchronized.
- Mark tasks complete only when their checks have actually run and passed.

Report what changed, important decisions, actual validation results, and remaining limitations. Never claim a test or validation passed unless it was executed.
