---
name: Frontend Guidelines
description: Guidelines for React 19 frontend development, following Feature-Based Architecture, Tailwind CSS v4, and state management rules. Trigger this when writing frontend React code.
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
