# React Coding Standards

> **Project:** FlowPilot Frontend  
> **Framework:** React 19 + TypeScript + Vite  
> **Architecture:** Feature-Based Architecture  
> **UI:** Tailwind CSS v4 + shadcn/ui  
> **State Management:** TanStack Query + Zustand  
> **Routing:** React Router  
> **Workflow Canvas:** React Flow

---

# 2. Folder Organization

Organize code by **feature**, not by file type.

✅ Good

```text
features/
    workflow/
        api/
        components/
        hooks/
        pages/
        store/
```

❌ Avoid

```text
components/
pages/
hooks/
services/
```

for the entire application.

---

# 3. Naming Convention

## Components

Use **PascalCase**.

```tsx
WorkflowCard.tsx

ExecutionTable.tsx

NodeLibrary.tsx
```

---

## Hooks

Prefix with `use`.

```tsx
useWorkflow.ts

usePublishWorkflow.ts

useNodeSelection.ts
```

---

## Services

Use camelCase.

```tsx
workflow.service.ts

execution.service.ts
```

---

## API

```tsx
workflow.api.ts

connector.api.ts
```

---

## Store

```tsx
auth.store.ts

designer.store.ts
```

---

## Utils

```tsx
formatDate.ts

parseCron.ts

downloadFile.ts
```

---

## Types

```tsx
workflow.ts

execution.ts

connector.ts
```

---

# 4. Component Guidelines

A component should:

- Have one responsibility
- Be reusable
- Stay under ~200 lines whenever possible
- Move complex logic into hooks

Bad

```tsx
WorkflowPage
    700 lines
```

Good

```text
WorkflowPage

├── WorkflowTable
├── WorkflowToolbar
├── CreateWorkflowDialog
├── DeleteWorkflowDialog
```

---

# 5. Props

Always define interfaces.

```tsx
interface WorkflowCardProps {
    workflow: Workflow;
    onDelete: () => void;
}
```

Avoid

```tsx
function WorkflowCard(props: any)
```

---

# 6. TypeScript

Never use

```tsx
any
```

Use

```tsx
unknown
```

or proper interfaces.

Prefer

```tsx
interface Workflow
```

instead of

```tsx
type Workflow = {
...
}
```

for object models.

---

# 7. React Components

Prefer function components.

```tsx
export function WorkflowCard() {}
```

Avoid

```tsx
const WorkflowCard = () => {}
```

unless consistency within the file requires it.

---

# 8. Import Order

```tsx
// React

// Third-party libraries

// App aliases

// Relative imports

// Styles
```

Example

```tsx
import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { WorkflowTable } from "@/features/workflow";

import "./styles.css";
```

---

# 9. Absolute Imports

Always use aliases.

Good

```tsx
import { Button } from "@/components/ui/button";
```

Avoid

```tsx
../../../components/ui/button
```

---

# 10. State Management

## React State

Use for:

- Modal state
- Form input
- Expand/Collapse
- Selected tab

```tsx
const [open, setOpen] = useState(false);
```

---

## Zustand

Use for UI state shared across multiple components.

Examples

- Theme
- Sidebar
- Workflow Designer state
- Selected node
- Undo/Redo

Do **not** store server data in Zustand.

---

## React Query

Use for:

- API data
- Caching
- Mutations
- Pagination
- Infinite scrolling

Never use Zustand for API responses.

---

# 11. API Calls

Never call APIs directly from components or hooks. Add a services layer before the API layer.

❌

```tsx
workflowApi.getAll()
```

inside React hooks or components.

✅

```tsx
workflowService.getAll()
```

inside hooks, and the service calls the API layer.

---

# 12. React Query Hooks

Every feature owns its own hooks.

Example

```text
workflow/

hooks/

useWorkflow.ts

useWorkflows.ts

useCreateWorkflow.ts

useDeleteWorkflow.ts
```

Components only consume hooks.

---

# 13. Business Logic

Business logic belongs in:

- services

Not inside components, hooks, or utils.

Bad

```tsx
WorkflowTable.tsx

400 lines

validation

sorting

filtering

mapping
```

Good

```text
WorkflowTable.tsx

↓

useWorkflow()

↓

workflow.service.ts
```

---

# 14. Forms

Use

- React Hook Form
- Zod

Never use uncontrolled validation logic.

---

# 15. Styling

Use Tailwind utilities.

Prefer

```tsx
className="flex items-center gap-2"
```

Avoid

```css
.container {}
```

unless necessary.

---

# 16. shadcn/ui

Always use shadcn components before creating custom ones.

Example

- Button
- Dialog
- Card
- Sheet
- Table
- DropdownMenu

Extend existing components instead of rewriting them.

---

# 17. React Flow

Each custom node lives in its own folder.

```text
Http/

index.tsx

HttpConfig.tsx

HttpIcon.tsx
```

Node configuration should be independent.

---

# 18. Error Handling

Never ignore errors.

Bad

```tsx
catch {}
```

Good

```tsx
toast.error(error.message);
```

Always provide user feedback.

---

# 19. Loading States

Every async page should support

- Loading
- Empty
- Error
- Success

Example

```tsx
LoadingSpinner

↓

EmptyState

↓

ErrorState

↓

Content
```

---

# 20. Performance

Use

- React.memo
- useMemo
- useCallback

only when there is a measurable performance benefit.

Do not optimize prematurely.

---

# 21. Constants

Avoid magic values.

Bad

```tsx
if (status === 1)
```

Good

```tsx
enum WorkflowStatus {
    Draft,
    Published,
}
```

---

# 23. Comments

Write code that explains itself.

Avoid

```tsx
// increment i
i++;
```

Use comments only for:

- Complex algorithms
- Important business rules
- Temporary TODOs

---

# 24. Logging

Never use

```tsx
console.log()
```

in production code.

Remove all debugging logs before merging.

---

# 25. File Size Guidelines

| File | Recommended Limit |
|-------|------------------:|
| Component | < 200 lines |
| Hook | < 150 lines |
| Service | < 300 lines |
| Utility | < 100 lines |

Split files when responsibilities grow.

---

# 26. Testing

### 26.1. Stack & Tooling

- **Test Runner & Framework**: **Vitest** (`vitest run --environment jsdom`)
- **Testing Library**: **@testing-library/react** + **@testing-library/jest-dom**
- **Environment**: **jsdom**

---

### 26.2. Location & Naming Conventions

All frontend tests live directly inside `@features` (`src/features/<feature>/...`), collocated with the source code:

| Type | Suffix | Location | Example |
|---|---|---|---|
| **Components** | `*.test.tsx` | Next to component | `features/auth/components/LoginForm.test.tsx` |
| **Stores (Zustand)** | `*.test.ts` | Next to store | `features/auth/store/auth.store.test.ts` |
| **Services** | `*.test.ts` | Next to service | `features/workflow/services/workflow.service.test.ts` |
| **Utilities** | `*.test.ts` | Next to util | `features/auth/utils/password.utils.test.ts` |
| **Hooks** | `*.test.ts` | Next to hook | `features/workflow/hooks/useWorkflow.test.ts` |

---

### 26.3. What to Test

1. **Pure Business Logic & Utilities**:
   - Validation rules, data transformers, formatting logic, output builders.
   - Test edge cases, empty values, invalid types, and complex computations.

2. **Zustand State Stores**:
   - Initial state initialization (e.g. from `localStorage`).
   - State updates, action dispatches, and store resets.

3. **Services**:
   - Verify proper parameters are forwarded to the API layer (`apiClient` or feature API).
   - Test error propagation and structured API error handling.

4. **React Components**:
   - Critical user flows: input entry, button clicks, validation errors, loading indicators, and success callbacks.
   - Accessibility & role queries: find elements using semantic queries (`getByRole`, `getByText`, `getByPlaceholderText`).
   - Mock child components or heavy sub-panels (e.g. React Flow canvas) when testing parent page orchestration.

---

### 26.4. Testing Best Practices

- **Query by Accessibility First**:
  - Prefer `screen.getByRole('button', { name: 'Sign In' })`, `screen.getByPlaceholderText(...)`, or `screen.getByText(...)`.
  - Avoid querying internal classes or DOM hierarchy (`container.querySelector(...)`).

- **Provide Context Providers**:
  - Wrap components with required providers: `QueryClientProvider` for React Query, `MemoryRouter` for routing links (`<Link>`).

- **Mock External Boundaries**:
  - Mock API endpoints and external side-effects using `vi.mock()` and `vi.fn()`.
  - Clear and reset mocks in `beforeEach` or `afterEach` (`vi.clearAllMocks()`, `cleanup()`).

- **Avoid Fragile Snapshot Testing**:
  - Do not use snapshot tests for UI layouts. Focus tests on behavior, invariant state transitions, and accessible feedback to the user.

- **Run in CI**:
  - Both CI pipeline (`.github/workflows/ci-pipeline.yml`) and pre-commit checks run `npm test` inside `frontend/`.

---
