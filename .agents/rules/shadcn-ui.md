# Rule: Mandatory Use of shadcn/ui for Frontend

When developing or updating frontend components in `frontend/`:

## 1. Always Use shadcn/ui
- **Primary UI Library**: All UI elements must use `shadcn/ui` (`@/components/ui/*`).
- **No custom HTML primitives**: Never roll custom buttons, inputs, dialogs, sheets, modals, dropdowns, cards, tables, badges, etc. when shadcn/ui provides them.
- **Component Installation**: If a required shadcn component is not yet in `frontend/src/components/ui/`, install it using:
  ```bash
  npx shadcn@latest add <component-name>
  ```
- **Reuse & Extension**: Check existing components in `@/components/ui/` first. Extend or compose them with `className` and Tailwind utility classes or CVA variants as needed.

## 2. Styling & Theming
- Follow Tailwind CSS v4 and the color tokens defined in `src/App.css` and `components.json`.
- Keep component designs clean, modern, and consistent with the project's design system.

## 3. Reference
- Coding Standard: `docs/frontend/coding.standard.md`
- Frontend Skill: `.agents/skills/workflow-automation-frontend-guidelines/SKILL.md`
