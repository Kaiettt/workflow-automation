import { create } from 'zustand';

interface DesignerState {
  selectedNodeId: string | null;
  isSaving: boolean;
  setSelectedNodeId: (id: string | null) => void;
  setIsSaving: (saving: boolean) => void;
}

export const useDesignerStore = create<DesignerState>((set) => ({
  selectedNodeId: null,
  isSaving: false,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setIsSaving: (saving) => set({ isSaving: saving }),
}));
