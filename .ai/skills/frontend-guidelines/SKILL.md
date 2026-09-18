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

## 5. Styling
- Use Tailwind utility classes (`className="flex items-center"`).
- Always prefer `shadcn/ui` components over building custom ones from scratch. Extend them as needed.
