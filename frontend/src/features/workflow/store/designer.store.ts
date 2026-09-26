import { create } from 'zustand';
import type { NodeTypeDefinition } from '../models/workflow.model';

interface DesignerState {
  selectedNodeId: string | null;
  isSaving: boolean;
  nodeTypes: NodeTypeDefinition[];
  setSelectedNodeId: (id: string | null) => void;
  setIsSaving: (saving: boolean) => void;
  setNodeTypes: (types: NodeTypeDefinition[]) => void;
}

export const useDesignerStore = create<DesignerState>((set) => ({
  selectedNodeId: null,
  isSaving: false,
  nodeTypes: [],
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setIsSaving: (saving) => set({ isSaving: saving }),
  setNodeTypes: (types) => set({ nodeTypes: types }),
}));
