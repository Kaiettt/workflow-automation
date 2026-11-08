import { describe, it, expect, vi, afterEach } from 'vitest';
import { executionService } from './execution.service';

describe('executionService.subscribeExecution', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reconnects after a dropped stream and refetches the latest snapshot', async () => {
    const onEvent = vi.fn();
    const onConnectionChange = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const getExecutionSpy = vi.spyOn(executionService, 'getExecution').mockResolvedValue({
      id: 'execution-1',
      workflowId: 'workflow-1',
      workflowVersionId: 'version-1',
      status: 'SUCCESS',
      startedAt: '2026-11-08T00:00:00.000Z',
      nodeLogs: [],
    });

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    } as Response);

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    } as Response);

    const stop = executionService.subscribeExecution(
      'execution-1',
      onEvent,
      onConnectionChange,
    );

    await new Promise((resolve) => setTimeout(resolve, 1200));
    stop();

    expect(onConnectionChange).toHaveBeenCalledWith('reconnecting');
    expect(getExecutionSpy).toHaveBeenCalledWith('execution-1');
    expect(mockFetchCalls(fetchSpy)).toBeGreaterThanOrEqual(2);
  });
});

function mockFetchCalls(fetchSpy: ReturnType<typeof vi.spyOn>) {
  return fetchSpy.mock.calls.length;
}
