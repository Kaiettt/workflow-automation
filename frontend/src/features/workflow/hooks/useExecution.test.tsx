import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { executionService } from '../services/execution.service';

vi.mock('../services/execution.service', () => ({
  executionService: {
    getExecution: vi.fn(),
  },
}));

import { useExecution } from './useExecution';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('useExecution', () => {
  const createWrapper = (queryClient: QueryClient) =>
    ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

  it('polls an active execution and stops when it reaches a terminal state', async () => {
    vi.mocked(executionService.getExecution)
      .mockResolvedValueOnce({
        id: 'execution-1',
        workflowId: 'workflow-1',
        workflowVersionId: 'version-1',
        status: 'QUEUED',
        startedAt: null,
        nodeLogs: [],
      })
      .mockResolvedValueOnce({
        id: 'execution-1',
        workflowId: 'workflow-1',
        workflowVersionId: 'version-1',
        status: 'SUCCESS',
        startedAt: '2026-11-07T10:00:01.000Z',
        nodeLogs: [],
      });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const { result } = renderHook(() => useExecution('execution-1', 10), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data?.status).toBe('SUCCESS'));
    expect(executionService.getExecution).toHaveBeenCalledTimes(2);
  });

  it.each([403, 404])('stops polling after an HTTP %i error', async (status) => {
    const error = Object.assign(new AxiosError('Request failed'), {
      response: { status },
    });
    vi.mocked(executionService.getExecution).mockRejectedValue(error);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const { result } = renderHook(() => useExecution('execution-1', 10), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(executionService.getExecution).toHaveBeenCalledTimes(1);
  });

  it('continues polling after a transient error', async () => {
    vi.mocked(executionService.getExecution)
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({
        id: 'execution-1',
        workflowId: 'workflow-1',
        workflowVersionId: 'version-1',
        status: 'SUCCESS',
        startedAt: '2026-11-07T10:00:01.000Z',
        nodeLogs: [],
      });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const { result } = renderHook(() => useExecution('execution-1', 100), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data?.status).toBe('SUCCESS'));
    expect(executionService.getExecution).toHaveBeenCalledTimes(2);
  });
});