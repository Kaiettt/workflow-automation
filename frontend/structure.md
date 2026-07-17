# React Frontend Architecture

## Folder Structure

```text
src/
│
├── app/
│   ├── App.tsx
│   ├── main.tsx
│   ├── router.tsx
│   ├── providers/
│   │    ├── QueryProvider.tsx
│   │    ├── ThemeProvider.tsx
│   │    └── AuthProvider.tsx
│   │
│   └── layouts/
│        ├── DashboardLayout.tsx
│        ├── AuthLayout.tsx
│        └── EmptyLayout.tsx
│
├── assets/
│
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── common/
│   ├── forms/
│   ├── data-table/
│   ├── dialogs/
│   ├── loading/
│   └── charts/
│
├── features/
│
│   ├── auth/
│   ├── dashboard/
│   ├── workflow/
│   ├── execution/
│   ├── connectors/
│   ├── monitoring/
│   ├── logs/
│   ├── versions/
│   └── settings/
│
├── hooks/
│
├── lib/
│
├── services/
│
├── store/
│
├── types/
│
├── utils/
│
└── styles/
```

---

# Feature Structure

Each feature should be completely self-contained.

```text
features/
    workflow/
        api/
        services/
        components/
        hooks/
        pages/
        services/
        store/
        types/
        utils/
        index.ts
```

Example:

```text
workflow/

├── api/
│   └── workflow.api.ts
├── services/
│   └── workflow.service.ts
│
├── components/
│   ├── WorkflowCard.tsx
│   ├── WorkflowTable.tsx
│   └── PublishDialog.tsx
│
├── hooks/
│   ├── useWorkflow.ts
│   └── usePublishWorkflow.ts
│
├── pages/
│   ├── WorkflowListPage.tsx
│   └── WorkflowDetailPage.tsx
│
├── store/
│   └── workflow.store.ts
│
├── types/
│   └── workflow.ts
│
├── utils/
│   └── workflowValidator.ts
│
└── index.ts
```

---

# Workflow Designer

The Workflow Designer is the largest feature and should be treated as its own module.

```text
workflow-designer/

├── canvas/
├── nodes/
├── edges/
├── sidebar/
├── toolbar/
├── panels/
├── inspector/
├── minimap/
├── controls/
├── shortcuts/
├── hooks/
├── services/
├── store/
└── types/
```

Example:

```text
workflow-designer/

├── canvas/
│   └── WorkflowCanvas.tsx
│
├── nodes/
│   ├── TriggerNode.tsx
│   ├── HttpNode.tsx
│   ├── ConditionNode.tsx
│   ├── LoopNode.tsx
│   └── SlackNode.tsx
│
├── sidebar/
│   └── NodeLibrary.tsx
│
├── inspector/
│   └── PropertyPanel.tsx
│
├── toolbar/
│   └── DesignerToolbar.tsx
│
├── panels/
│   ├── VariablesPanel.tsx
│   └── ExecutionPanel.tsx
│
├── services/
│   ├── layout.service.ts
│   └── validation.service.ts
│
├── hooks/
│   ├── useReactFlow.ts
│   └── useSelection.ts
│
└── store/
    └── designer.store.ts
```

---

# API Layer

Never call Axios directly inside React components.

```text
services/

├── api/
│   ├── axios.ts
│   └── interceptors.ts
│
├── auth.service.ts
├── workflow.service.ts
├── execution.service.ts
├── connector.service.ts
├── monitoring.service.ts
└── version.service.ts
```

Example:

```tsx
const workflows = await workflowService.getAll();
```

Instead of:

```tsx
axios.get(...)
```

inside components.

---

# React Query

Keep all server state inside feature hooks.

```text
workflow/

├── api/
│   └── workflow.api.ts
│
└── hooks/
    ├── useWorkflows.ts
    ├── useWorkflow.ts
    ├── useCreateWorkflow.ts
    └── useDeleteWorkflow.ts
```

Example:

```tsx
export function useWorkflows() {
    return useQuery({
        queryKey: ['workflows'],
        queryFn: workflowApi.getAll,
    });
}
```

Components should never know how data is fetched.

---

# Zustand Store

Separate **server state** from **UI state**.

Global stores:

```text
store/

├── auth.store.ts
├── theme.store.ts
└── notification.store.ts
```

Feature stores:

```text
workflow/store/
    workflow.store.ts

workflow-designer/store/
    designer.store.ts
```

Example Designer Store:

```tsx
selectedNode

selectedEdge

zoom

undoStack

redoStack

clipboard

draggingNode

editingNode
```

---

# Routing

```text
/

login

dashboard

workflows

workflows/:id

designer/:id

executions

executions/:id

connectors

logs

versions

settings
```

```text
DashboardLayout
      │
      ├── Dashboard
      ├── Workflow
      ├── Execution
      ├── Monitoring
      ├── Connectors
      ├── Logs
      └── Settings
```

---

# Shared Components

```text
components/

└── common/
    ├── ConfirmDialog
    ├── SearchBar
    ├── EmptyState
    ├── ErrorState
    ├── PageHeader
    ├── PageTitle
    ├── Breadcrumb
    ├── Pagination
    ├── DeleteDialog
    └── StatusBadge
```

---

# Utilities

```text
utils/

├── formatDate.ts
├── formatDuration.ts
├── debounce.ts
├── download.ts
├── cn.ts
└── copy.ts
```

---

# Shared Types

```text
types/

├── api.ts
├── pagination.ts
├── user.ts
├── workflow.ts
├── connector.ts
├── execution.ts
└── node.ts
```

---

# React Flow Nodes

Each custom node should be isolated in its own folder.

```text
nodes/

├── Trigger/
│   ├── index.tsx
│   └── TriggerConfig.tsx
│
├── Http/
│   ├── index.tsx
│   └── HttpConfig.tsx
│
├── Condition/
├── Loop/
├── Slack/
├── Gmail/
├── Postgres/
└── OpenAI/
```

Each node owns its rendering logic, configuration UI, validation, and related utilities.