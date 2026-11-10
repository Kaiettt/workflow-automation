import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExecutionMonitor } from './useExecutionMonitor';
import { useExecution } from './useExecution';
import { useExecutionHistory } from './useExecutionHistory';
import { useExecutionStream } from './useExecutionStream';
import { useStartExecution } from './useStartExecution';

vi.mock('./useExecution', () => ({
  useExecution: vi.fn(),
}));

vi.mock('./useExecutionHistory', () => ({
  useExecutionHistory: vi.fn(),
}));

vi.mock('./useExecutionStream', () => ({
  useExecutionStream: vi.fn(),
}));

vi.mock('./useStartExecution', () => ({
  useStartExecution: vi.fn(),
}));

describe('useExecutionMonitor', () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useExecution).mockReturnValue({
      data: undefined,
      isError: false,
    } as unknown as ReturnType<typeof useExecution>);

    vi.mocked(useExecutionHistory).mockReturnValue({
      data: { items: [], nextCursor: null },
    } as unknown as ReturnType<typeof useExecutionHistory>);

    vi.mocked(useExecutionStream).mockReturnValue(undefined);

    vi.mocked(useStartExecution).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useStartExecution>);
  });

  const createWrapper =
    (initialEntries = ['/test']) =>
    ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );

  it('reads selectedExecutionId from URL search params', () => {
    const { result } = renderHook(
      () =>
        useExecutionMonitor({
          workflowId: 'wf-1',
          versionId: 'ver-1',
        }),
      { wrapper: createWrapper(['/test?execution=exec-123']) },
    );

    expect(result.current.selectedExecutionId).toBe('exec-123');
  });

  it('triggers mutation when calling handleRun', () => {
    const onBeforeRun = vi.fn();
    const { result } = renderHook(
      () =>
        useExecutionMonitor({
          workflowId: 'wf-1',
          versionId: 'ver-1',
          onBeforeRun,
        }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.handleRun();
    });

    expect(onBeforeRun).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_version_id: 'ver-1',
      }),
    );
  });
});

