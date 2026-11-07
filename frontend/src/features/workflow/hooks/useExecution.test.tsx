import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useExecution('execution-1', 10), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data?.status).toBe('SUCCESS'));
    expect(executionService.getExecution).toHaveBeenCalledTimes(2);
  });
});