import { useEffect, useRef, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useDesignerStore } from '../store/designer.store';
import { useWorkflowMutations } from './useWorkflowMutations';

export interface UseDraftAutoSaveOptions {
  workflowId: string;
  nodes: Node[];
  edges: Edge[];
  loading?: boolean;
  debounceMs?: number;
}

export function useDraftAutoSave({
  workflowId,
  nodes,
  edges,
  loading = false,
  debounceMs = 2000,
}: UseDraftAutoSaveOptions) {
  const { saveDraftMutation } = useWorkflowMutations();
  const setIsSaving = useDesignerStore((state) => state.setIsSaving);
  const isSaving = useDesignerStore((state) => state.isSaving);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  const saveDraft = useCallback(
    async (currentNodes: Node[], currentEdges: Edge[]) => {
      if (!workflowId) return;
      setIsSaving(true);
      try {
        const definition = {
          nodes: currentNodes,
          edges: currentEdges,
          viewport: { x: 0, y: 0, zoom: 1 },
        };
        await saveDraftMutation.mutateAsync({ id: workflowId, definition });
      } catch (error) {
        console.error('Failed to save draft', error);
      } finally {
        setIsSaving(false);
      }
    },
    [workflowId, setIsSaving, saveDraftMutation],
  );

  const forceSave = useCallback(
    async (overrideNodes?: Node[], overrideEdges?: Edge[]) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      await saveDraft(overrideNodes ?? nodes, overrideEdges ?? edges);
    },
    [nodes, edges, saveDraft],
  );

  useEffect(() => {
    if (loading) return;
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      void saveDraft(nodes, edges);
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, edges, loading, debounceMs, saveDraft]);

  return {
    isSaving,
    forceSave,
    saveDraft,
  };
}

