import { create } from 'zustand';
import type { NodeTypeDefinition } from '../models/workflow.model';
import type { WorkflowValidationIssue } from '../models/workflow-validation.model';

interface DesignerState {
  selectedNodeId: string | null;
  isSaving: boolean;
  nodeTypes: NodeTypeDefinition[];
  validationIssues: WorkflowValidationIssue[];
  setSelectedNodeId: (id: string | null) => void;
  setIsSaving: (saving: boolean) => void;
  setNodeTypes: (types: NodeTypeDefinition[]) => void;
  setValidationIssues: (issues: WorkflowValidationIssue[]) => void;
}

export const useDesignerStore = create<DesignerState>((set) => ({
  selectedNodeId: null,
  isSaving: false,
  nodeTypes: [],
  validationIssues: [],
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setIsSaving: (saving) => set({ isSaving: saving }),
  setNodeTypes: (types) => set({ nodeTypes: types }),
  setValidationIssues: (issues) => set({ validationIssues: issues }),
}));
