# Implementation Tasks

- [ ] **1. Project Setup & Dependencies**
  - [ ] Install React Flow (`npm install @xyflow/react`).
  - [ ] Initialize/Ensure shadcn/ui is setup in the frontend project.
  - [ ] Install Zustand (`npm install zustand`).

- [ ] **2. Core Layout & UI Components**
  - [ ] Create `DesignerLayout` component (Full screen container).
  - [ ] Create `Sidebar` component (Node Palette with mock nodes).
  - [ ] Create `PropertiesPanel` component (empty placeholder for now).

- [ ] **3. State Management**
  - [ ] Create `useDesignerStore` (Zustand) to manage global designer state (`selectedNodeId`, `isSaving`, etc.).

- [ ] **4. API Integration: Initialization**
  - [ ] Create API service functions (`createWorkflow`, `getWorkflowDraft`, `saveWorkflowDraft`).
  - [ ] Implement the `POST /workflows` trigger from the UI before entering the canvas.
  - [ ] Implement fetching `GET /workflows/:id/draft` on canvas mount.

- [ ] **5. React Flow Integration**
  - [ ] Initialize `<ReactFlow>` inside the Canvas area.
  - [ ] Wire up `nodes` and `edges` state.
  - [ ] Implement Drag & Drop from Sidebar to Canvas (WD-02 Add Node).
  - [ ] Implement Edge connections (WD-05 Connect Nodes).
  - [ ] Implement Node/Edge selection and deletion (WD-06, WD-07).

- [ ] **6. Properties Panel & Node Configuration (WD-04)**
  - [ ] Detect node selection event.
  - [ ] Render a form inside `PropertiesPanel` based on the selected node.
  - [ ] Sync form data back to the node's `data.config` state.

- [ ] **7. Auto Save Mechanism (WD-08)**
  - [ ] Implement a debounced effect (2 seconds).
  - [ ] Serialize React Flow state (`reactFlowInstance.toObject()`).
  - [ ] Call `PUT /workflows/:id/draft` API.
  - [ ] Add visual feedback on the UI (Saving... / Saved).

- [ ] **8. Polish & Custom Nodes**
  - [ ] Create custom Node components (Trigger Node, Action Node) to make them look distinct and styled with Tailwind.
  - [ ] Ensure layout is responsive and full-screen without scrolling issues.


note: dont need any test writing