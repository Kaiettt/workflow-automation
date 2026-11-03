---
name: Frontend Guidelines
description: Guidelines for React 19 frontend development, following Feature-Based Architecture, Tailwind CSS v4, state management, and Vitest testing rules. Trigger this when writing or testing frontend React code.
---

# FlowPilot Frontend Coding Standard (React)

You must follow these rules when developing the frontend:

## 1. Architecture & Organization
- **Stack**: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui.
- **Structure**: Feature-Based. Organize code by feature (e.g., `features/workflow/api|components|hooks|pages|store`).
- Components should have one responsibility and ideally be under 200 lines.

## 2. Naming Conventions
- **Components**: PascalCase (`WorkflowCard.tsx`).
- **Hooks**: Prefix with `use` (`useWorkflow.ts`).
- **Services**: camelCase (`workflow.service.ts`).

## 3. Types and State
- **NO `any`**. Use `unknown` or proper interfaces. Prefer `interface` over `type` for models.
- **Local State**: Use `useState` (modals, forms, UI toggles).
- **Global UI State**: Use `Zustand` (theme, sidebar, designer state). NO API data here.
- **Server State**: Use `TanStack React Query` (API data, caching, mutations).

## 4. API & Business Logic
- Components DO NOT call APIs directly. Use React Query hooks which call a service layer.
- Move business logic to services, not components.

## 5. Styling & UI Components (shadcn/ui)
- **Mandatory shadcn/ui**: Always use `shadcn/ui` components (`@/components/ui/*`). Never build raw custom buttons, inputs, dialogs, dropdowns, tables, cards, etc. from scratch.
- **Install missing components**: Run `npx shadcn@latest add <component-name>` inside `frontend/` whenever a UI component is needed and not yet present in `src/components/ui`.
- **Customization**: Extend shadcn components using Tailwind utility classes (`className="..."`) and `cn()` from `@/lib/utils`.
- Follow the color system and theme tokens defined in `src/App.css` and `components.json`.

## 6. Testing (Vitest & React Testing Library)
- **Collocation**: Tests live strictly inside `src/features/<feature>/...` alongside source files (e.g. `LoginForm.test.tsx`, `auth.store.test.ts`, `workflow-validation.util.test.ts`).
- **Scope**:
  - Pure logic & utils (`*.test.ts`): Test edge cases, validation, formatting, calculations.
  - Zustand stores (`*.store.test.ts`): Test actions, local storage persistence, state transitions.
  - Services (`*.service.test.ts`): Mock API layer (`vi.mock`), verify error handling & transformations.
  - Components (`*.test.tsx`): Test user actions, conditional alerts, accessibility roles.
- **Conventions**:
  - Query by accessibility: `screen.getByRole()`, `screen.getByText()`, `screen.getByPlaceholderText()`. Avoid testing CSS classes or internal implementation details.
  - Wrap components requiring context with necessary providers (`QueryClientProvider`, `MemoryRouter`).
  - Mock external boundaries with `vi.mock()` / `vi.fn()`, and always reset mocks / `cleanup()` between tests.
  - Avoid snapshot testing; verify behaviors and state invariants instead.
- **Execution**: Run `npm test` inside `frontend/`.
