## Agent skills

### Issue tracker

Local markdown (issues live under `.scratch/<feature>/`). See `docs/agents/issue-tracker.md`.

### Triage labels

Keep default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo layout. See `docs/agents/domain.md`.

### Frontend UI & Components

- **UI Library**: Always use **shadcn/ui** (`@/components/ui/*`) with Tailwind CSS v4.
- **No custom primitives**: Never create custom HTML buttons, dialogs, dropdowns, modals, or form inputs from scratch if `shadcn/ui` provides them.
- **Adding components**: If a component is missing in `frontend/src/components/ui`, add it via `npx shadcn@latest add <component-name>`.
- Detailed standard: See [coding.standard.md](file:///d:/New%20folder/workflow-automation/docs/frontend/coding.standard.md).
