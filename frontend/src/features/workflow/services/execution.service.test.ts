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
      status: 'RUNNING',
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

  it('stops reconnecting when the stream sends a terminal snapshot', async () => {
    const onEvent = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        'event: execution.snapshot\ndata: {"event":"execution.snapshot","executionId":"execution-1","payload":{"status":"CANCELLED"},"ts":"2026-11-08T00:00:00.000Z"}\n\n',
      ),
    );

    const stop = executionService.subscribeExecution('execution-1', onEvent);
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'execution.snapshot' }),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not retry a permanent authorization failure', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 403 }));
    const getExecutionSpy = vi.spyOn(executionService, 'getExecution');

    const stop = executionService.subscribeExecution('execution-1', vi.fn());
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(getExecutionSpy).not.toHaveBeenCalled();
  });

  it('treats a missing stream body as a reconnectable failure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    } as Response);
    const getExecutionSpy = vi.spyOn(executionService, 'getExecution').mockResolvedValue({
      id: 'execution-1',
      workflowId: 'workflow-1',
      workflowVersionId: 'version-1',
      status: 'RUNNING',
      startedAt: null,
      nodeLogs: [],
    });
    const onConnectionChange = vi.fn();

    const stop = executionService.subscribeExecution(
      'execution-1',
      vi.fn(),
      onConnectionChange,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(getExecutionSpy).toHaveBeenCalledWith('execution-1');
    expect(onConnectionChange).toHaveBeenCalledWith('disconnected');
  });
});

function mockFetchCalls(fetchSpy: ReturnType<typeof vi.spyOn>) {
  return fetchSpy.mock.calls.length;
}
