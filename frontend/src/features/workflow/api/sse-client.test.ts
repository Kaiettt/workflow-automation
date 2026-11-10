import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  SseConnectionManager,
  isPermanentHttpStatus,
} from './sse-client';

describe('SseConnectionManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('determines permanent HTTP statuses accurately', () => {
    expect(isPermanentHttpStatus(undefined)).toBe(false);
    expect(isPermanentHttpStatus(200)).toBe(false);
    expect(isPermanentHttpStatus(400)).toBe(true);
    expect(isPermanentHttpStatus(401)).toBe(true);
    expect(isPermanentHttpStatus(403)).toBe(true);
    expect(isPermanentHttpStatus(404)).toBe(true);
    expect(isPermanentHttpStatus(408)).toBe(false); // Request timeout -> reconnectable
    expect(isPermanentHttpStatus(429)).toBe(false); // Too many requests -> reconnectable
    expect(isPermanentHttpStatus(500)).toBe(false); // Internal server error -> reconnectable
    expect(isPermanentHttpStatus(503)).toBe(false); // Service unavailable -> reconnectable
  });

  it('parses SSE events across chunks and delivers them to onEvent', async () => {
    const manager = new SseConnectionManager();
    const onEvent = vi.fn();
    const onConnectionChange = vi.fn();

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'event: node.started\ndata: {"executionId":"exec-1","nodeId":"node-1","status":"RUNNING"}\n\n',
          ),
        );
        controller.enqueue(
          new TextEncoder().encode(
            'event: node.completed\ndata: {"executionId":"exec-1","nodeId":"node-1","status":"COMPLETED"}\n\n',
          ),
        );
        controller.close();
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const unsubscribe = manager.subscribe({
      url: 'http://localhost/api/executions/exec-1/events',
      token: 'jwt-token',
      onEvent,
      onConnectionChange,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    unsubscribe();

    expect(onConnectionChange).toHaveBeenCalledWith('reconnecting');
    expect(onConnectionChange).toHaveBeenCalledWith('connected');
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'node.started',
        executionId: 'exec-1',
        nodeId: 'node-1',
        status: 'RUNNING',
      }),
    );
    expect(onEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'node.completed',
        executionId: 'exec-1',
        nodeId: 'node-1',
        status: 'COMPLETED',
      }),
    );
  });

  it('deduplicates identical events using deduplication key', async () => {
    const manager = new SseConnectionManager();
    const onEvent = vi.fn();

    const stream = new ReadableStream({
      start(controller) {
        // Send duplicate event frame
        const frame =
          'event: node.started\ndata: {"executionId":"exec-1","nodeId":"node-1","status":"RUNNING","ts":"2026-11-10T12:00:00Z"}\n\n';
        controller.enqueue(new TextEncoder().encode(frame));
        controller.enqueue(new TextEncoder().encode(frame));
        controller.close();
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream));

    const unsubscribe = manager.subscribe({
      url: 'http://localhost/api/executions/exec-1/events',
      onEvent,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    unsubscribe();

    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it('aborts and triggers onTerminal when a terminal event is received', async () => {
    const manager = new SseConnectionManager();
    const onEvent = vi.fn();
    const onTerminal = vi.fn();
    const onConnectionChange = vi.fn();

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'event: execution.completed\ndata: {"executionId":"exec-1","status":"SUCCEEDED"}\n\n',
          ),
        );
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream));

    const unsubscribe = manager.subscribe({
      url: 'http://localhost/api/executions/exec-1/events',
      onEvent,
      onTerminal,
      onConnectionChange,
      isTerminal: (event) => event.status === 'SUCCEEDED',
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    unsubscribe();

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onConnectionChange).toHaveBeenCalledWith('disconnected');
  });

  it('does not retry permanent HTTP error statuses like 403', async () => {
    const manager = new SseConnectionManager();
    const onEvent = vi.fn();
    const onConnectionChange = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    const unsubscribe = manager.subscribe({
      url: 'http://localhost/api/executions/exec-1/events',
      onEvent,
      onConnectionChange,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    unsubscribe();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(onConnectionChange).toHaveBeenCalledWith('disconnected');
  });

  it('handles clean unsubscribe teardown immediately', () => {
    const manager = new SseConnectionManager();
    const onEvent = vi.fn();

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => {}),
    );

    const unsubscribe = manager.subscribe({
      url: 'http://localhost/api/executions/exec-1/events',
      onEvent,
    });

    expect(() => unsubscribe()).not.toThrow();
  });
});
