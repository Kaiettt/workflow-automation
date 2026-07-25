# Workflow Designer Frontend Design

## 1. Architecture

The Workflow Designer is a client-side Single Page Application (SPA) view built with React. It interfaces with the `monolith-backend` APIs to sync the workflow draft.

### Tech Stack
- **React Flow (`@xyflow/react`)**: Renders the canvas, handles drag/drop/zoom/pan, and renders custom nodes/edges.
- **Zustand**: Manages global UI state (e.g., currently selected node, dragged node type from sidebar).
- **shadcn/ui**: Provides consistent, accessible UI components (Sidebar, Panels, Forms, Buttons, Inputs).
- **Tailwind CSS**: Styling.

## 2. UI Layout

The UI consists of a full-screen layout divided into three primary regions:

1. **Sidebar (Left) - Node Palette**:
   - A list of available node types (triggers, actions, logic).
   - Draggable items using HTML5 Drag and Drop API.
2. **Canvas (Center)**:
   - The React Flow `<ReactFlow />` instance.
   - Handles dropping nodes, connecting edges, moving nodes around.
3. **Properties Panel (Right/Modal)**:
   - Appears when a node is selected.
   - Dynamically renders a form based on the `config_schema` of the selected node type.

## 3. State Management

### React Flow State
React Flow expects `nodes` and `edges` arrays. We maintain these in a hook (`useNodesState`, `useEdgesState`) or a Zustand store so that we can serialize them easily for the Auto Save mechanism.

### Zustand Store (`useDesignerStore`)
- `isSaving`: boolean
- `selectedNodeId`: string | null
- `setNodes`, `setEdges`: functions to wrap React Flow's state updates (if kept in store).

## 4. API Integration & Flow

note: dont need any authentication & authorization at this stage
### Initialization (Open Designer)
1. User clicks "Create Workflow" on the dashboard.
2. UI calls `POST /workflows` (creates a workflow, returns `workflowId`).
3. UI transitions to the Designer view routing to `/workflows/:id/draft`.
4. The designer mounts and calls `GET /workflows/:id/draft`.
5. If it's a new workflow, the draft is empty (`{ nodes: [], edges: [] }`). The UI sets this in React Flow.
6. If loading an existing workflow, the draft contains the saved graph, which maps directly to React Flow's expected structure.

### Auto Save (Debounced)
- We use a `useEffect` hook that listens to changes in the canvas state (nodes, edges).
- We use a debouncer or interval (e.g. lodash `debounce` or `useDebounce` hook with a 2-second delay).
- Call `PUT /workflows/:id/draft` with the current serialized JSON:
```json
{
  "definition": {
    "nodes": [...],
    "edges": [...],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

## 5. Extensibility
Custom node types will be registered with React Flow via the `nodeTypes` prop. We'll map FlowPilot's `category` or `type` (e.g., `trigger.schedule`) to specific custom React components that render the visual representation of the node on the canvas.
