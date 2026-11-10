import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { workflowService } from '../services/workflow.service';
import { useWorkflowMutations } from './useWorkflowMutations';
import type { WorkflowTemplate } from '../templates/catalog';
import type { PublishResult } from '../types/workflow.types';
import type { Node, Edge } from '@xyflow/react';

vi.mock('../services/workflow.service', () => ({
  workflowService: {
    createWorkflow: vi.fn(),
    renameWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
    saveDraft: vi.fn(),
    publishWorkflow: vi.fn(),
  },
}));

describe('useWorkflowMutations', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  const setup = () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useWorkflowMutations(), { wrapper });
    return { result, invalidateSpy };
  };

  it('handles createWorkflow mutation', async () => {
    vi.mocked(workflowService.createWorkflow).mockResolvedValue('wf-new-1');
    const { result, invalidateSpy } = setup();

    result.current.createWorkflowMutation.mutate('New WF');

    await waitFor(() =>
      expect(result.current.createWorkflowMutation.isSuccess).toBe(true),
    );
    expect(workflowService.createWorkflow).toHaveBeenCalledWith('New WF');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflows'] });
  });

  it('handles createFromTemplate mutation', async () => {
    vi.mocked(workflowService.createWorkflow).mockResolvedValue('wf-template-1');
    vi.mocked(workflowService.saveDraft).mockResolvedValue(undefined);
    const { result, invalidateSpy } = setup();

    const template: WorkflowTemplate = {
      id: 'tpl-1',
      title: 'Template 1',
      category: 'marketing',
      description: 'Test template',
      nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }] as unknown as Node[],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }] as unknown as Edge[],
    };

    result.current.createFromTemplateMutation.mutate(template);

    await waitFor(() =>
      expect(result.current.createFromTemplateMutation.isSuccess).toBe(true),
    );
    expect(workflowService.createWorkflow).toHaveBeenCalledWith('Template 1');
    expect(workflowService.saveDraft).toHaveBeenCalledWith(
      'wf-template-1',
      expect.objectContaining({
        nodes: template.nodes,
        edges: template.edges,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflows'] });
  });

  it('handles renameWorkflow mutation', async () => {
    vi.mocked(workflowService.renameWorkflow).mockResolvedValue(undefined);
    const { result, invalidateSpy } = setup();

    result.current.renameWorkflowMutation.mutate({
      id: 'wf-1',
      name: 'Renamed Workflow',
    });

    await waitFor(() =>
      expect(result.current.renameWorkflowMutation.isSuccess).toBe(true),
    );
    expect(workflowService.renameWorkflow).toHaveBeenCalledWith(
      'wf-1',
      'Renamed Workflow',
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflows'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['workflow-draft', 'wf-1'],
    });
  });

  it('handles deleteWorkflow mutation', async () => {
    vi.mocked(workflowService.deleteWorkflow).mockResolvedValue(undefined);
    const { result, invalidateSpy } = setup();

    result.current.deleteWorkflowMutation.mutate('wf-1');

    await waitFor(() =>
      expect(result.current.deleteWorkflowMutation.isSuccess).toBe(true),
    );
    expect(workflowService.deleteWorkflow).toHaveBeenCalledWith('wf-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflows'] });
  });

  it('handles saveDraft mutation', async () => {
    vi.mocked(workflowService.saveDraft).mockResolvedValue(undefined);
    const { result, invalidateSpy } = setup();

    result.current.saveDraftMutation.mutate({
      id: 'wf-1',
      definition: { nodes: [], edges: [] },
    });

    await waitFor(() =>
      expect(result.current.saveDraftMutation.isSuccess).toBe(true),
    );
    expect(workflowService.saveDraft).toHaveBeenCalledWith('wf-1', {
      nodes: [],
      edges: [],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['workflow-draft', 'wf-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['workflow-versions', 'draft-status', 'wf-1'],
    });
  });

  it('handles publishWorkflow mutation', async () => {
    const mockPublishResult = {
      versionNumber: 2,
      workflowId: 'wf-1',
      activation: { active: true },
    } as unknown as PublishResult;
    vi.mocked(workflowService.publishWorkflow).mockResolvedValue(mockPublishResult);
    const { result, invalidateSpy } = setup();

    result.current.publishWorkflowMutation.mutate('wf-1');

    await waitFor(() =>
      expect(result.current.publishWorkflowMutation.isSuccess).toBe(true),
    );
    expect(workflowService.publishWorkflow).toHaveBeenCalledWith('wf-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflows'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['workflow-draft', 'wf-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['workflow-versions'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['workflow-activation', 'wf-1'],
    });
  });
});
