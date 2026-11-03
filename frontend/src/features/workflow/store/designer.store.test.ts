import { beforeEach, describe, expect, it } from 'vitest';
import { useDesignerStore } from './designer.store';
import type { NodeTypeDefinition } from '../models/workflow.model';
import type { WorkflowValidationIssue } from '../models/workflow-validation.model';

describe('useDesignerStore', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      selectedNodeId: null,
      isSaving: false,
      nodeTypes: [],
      validationIssues: [],
    });
  });

  it('updates selectedNodeId', () => {
    expect(useDesignerStore.getState().selectedNodeId).toBeNull();
    useDesignerStore.getState().setSelectedNodeId('node-123');
    expect(useDesignerStore.getState().selectedNodeId).toBe('node-123');
    useDesignerStore.getState().setSelectedNodeId(null);
    expect(useDesignerStore.getState().selectedNodeId).toBeNull();
  });

  it('updates isSaving flag', () => {
    expect(useDesignerStore.getState().isSaving).toBe(false);
    useDesignerStore.getState().setIsSaving(true);
    expect(useDesignerStore.getState().isSaving).toBe(true);
  });

  it('updates nodeTypes catalog', () => {
    const mockTypes: NodeTypeDefinition[] = [
      {
        name: 'Webhook Trigger',
        description: 'Receives webhook requests',
        category: 'Trigger',
        type: 'TRIGGER',
        configSchema: {},
      },
    ];

    useDesignerStore.getState().setNodeTypes(mockTypes);
    expect(useDesignerStore.getState().nodeTypes).toEqual(mockTypes);
  });

  it('updates validationIssues', () => {
    const issues: WorkflowValidationIssue[] = [
      {
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'error',
        message: 'Missing field',
      },
    ];

    useDesignerStore.getState().setValidationIssues(issues);
    expect(useDesignerStore.getState().validationIssues).toEqual(issues);
  });
});

