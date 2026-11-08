import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { executionService } from '../services/execution.service';

vi.mock('../services/execution.service', () => ({
  executionService: {
    startExecution: vi.fn(),
  },
}));

import { useStartExecution } from './useStartExecution';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('useStartExecution', () => {
  it('invalidates the matching execution history and calls onSuccess', async () => {
    const execution = {
      id: 'execution-1',
      workflowId: 'workflow-1',
      workflowVersionId: 'version-1',
      status: 'QUEUED',
      startedAt: null,
      nodeLogs: [],
    };
    vi.mocked(executionService.startExecution).mockResolvedValue(execution);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 10000 } },
    });
    const historyQueryKey = ['execution-history', 'workflow-1', 'version-1'];
    queryClient.setQueryData(historyQueryKey, { items: [], nextCursor: null });
    queryClient.setQueryData(
      ['execution-history', 'workflow-1', 'version-2'],
      { items: [], nextCursor: null },
    );
    const onSuccess = vi.fn();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () =>
        useStartExecution({
          workflowId: 'workflow-1',
          workflowVersionId: 'version-1',
          onSuccess,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        workflow_version_id: 'version-1',
        idempotency_key: 'idempotency-key',
      });
    });

    await waitFor(() =>
      expect(queryClient.getQueryState(historyQueryKey)?.isInvalidated).toBe(true),
    );
    expect(
      queryClient.getQueryState(['execution-history', 'workflow-1', 'version-2'])
        ?.isInvalidated,
    ).toBe(false);
    expect(onSuccess).toHaveBeenCalledWith(execution);
  });
});