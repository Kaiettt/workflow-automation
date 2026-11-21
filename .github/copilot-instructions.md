
# Copilot Instructions

Follow the repository instructions in `AGENTS.md`.

Before editing code:
- Inspect the relevant implementation and tests.
- Read the applicable coding standard:
  - `docs/frontend/coding.standard.md`
  - `docs/backend/coding.standard.md`

Follow existing architecture and conventions.
Avoid unnecessary abstractions, duplicated logic, and unrelated refactoring.

When changing behavior:
- Add or update tests.
- Preserve existing contracts unless explicitly requested.
- Run relevant lint, type-check, test, and build commands.

Report actual validation results. Never claim checks passed without running them.

## Feature Development Workflow

For behavior-changing work, follow the canonical workflow in `docs/workflow-coding.md`.