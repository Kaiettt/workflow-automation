import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { workflowService } from '../services/workflow.service';
import type { NodeTypeDefinition } from '../models/workflow.model';
import { useWorkflowDraft, useNodeTypes } from './useWorkflowDraft';

vi.mock('../services/workflow.service', () => ({
  workflowService: {
    getDraft: vi.fn(),
    getNodeTypes: vi.fn(),
  },
}));

describe('useWorkflowDraft & useNodeTypes', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    return ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  it('fetches draft data for a workflow', async () => {
    const mockDraft = {
      definition: {
        nodes: [{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      },
      validationErrors: null,
    };
    vi.mocked(workflowService.getDraft).mockResolvedValue(mockDraft);

    const { result } = renderHook(() => useWorkflowDraft('wf-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockDraft);
    expect(workflowService.getDraft).toHaveBeenCalledWith('wf-1');
  });

  it('fetches node types definition', async () => {
    const mockNodeTypes = [
      {
        key: 'trigger.manual',
        name: 'Manual Trigger',
        type: 'trigger',
        category: 'trigger',
        description: 'Triggers workflow manually',
        icon: 'play',
        configSchema: [],
      },
    ];
    vi.mocked(workflowService.getNodeTypes).mockResolvedValue(
      mockNodeTypes as unknown as NodeTypeDefinition[],
    );

    const { result } = renderHook(() => useNodeTypes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockNodeTypes);
    expect(workflowService.getNodeTypes).toHaveBeenCalledTimes(1);
  });
});
