import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useDraftAutoSave } from './useDraftAutoSave';
import { useWorkflowMutations } from './useWorkflowMutations';
import type { Node, Edge } from '@xyflow/react';

vi.mock('./useWorkflowMutations', () => ({
  useWorkflowMutations: vi.fn(),
}));

describe('useDraftAutoSave', () => {
  const mockMutateAsync = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(useWorkflowMutations).mockReturnValue({
      saveDraftMutation: { mutateAsync: mockMutateAsync },
    } as unknown as ReturnType<typeof useWorkflowMutations>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleNodes: Node[] = [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }];
  const sampleEdges: Edge[] = [];

  it('does not trigger save on initial load', () => {
    renderHook(() =>
      useDraftAutoSave({
        workflowId: 'wf-1',
        nodes: sampleNodes,
        edges: sampleEdges,
        loading: false,
      }),
    );

    vi.advanceTimersByTime(3000);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('triggers debounced save when nodes/edges change after first load', () => {
    const { rerender } = renderHook(
      ({ nodes }) =>
        useDraftAutoSave({
          workflowId: 'wf-1',
          nodes,
          edges: sampleEdges,
          loading: false,
          debounceMs: 2000,
        }),
      { initialProps: { nodes: sampleNodes } },
    );

    // Initial load passes
    vi.advanceTimersByTime(100);

    // Update nodes
    const updatedNodes: Node[] = [
      { id: 'n1', position: { x: 10, y: 10 }, data: {} },
    ];
    rerender({ nodes: updatedNodes });

    // Should not save immediately
    expect(mockMutateAsync).not.toHaveBeenCalled();

    // Advance 1900ms (not yet 2000ms)
    vi.advanceTimersByTime(1900);
    expect(mockMutateAsync).not.toHaveBeenCalled();

    // Advance remaining 200ms
    vi.advanceTimersByTime(200);
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'wf-1',
        definition: expect.objectContaining({
          nodes: updatedNodes,
        }),
      }),
    );
  });

  it('immediately triggers save on forceSave', async () => {
    const { result } = renderHook(() =>
      useDraftAutoSave({
        workflowId: 'wf-1',
        nodes: sampleNodes,
        edges: sampleEdges,
        loading: false,
      }),
    );

    await act(async () => {
      await result.current.forceSave();
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'wf-1',
        definition: expect.objectContaining({
          nodes: sampleNodes,
        }),
      }),
    );
  });
});

