import { AxiosError, isAxiosError } from 'axios';
import { executionApi } from '../api/execution.api';
import { useAuthStore } from '../../auth/store/auth.store';
import type {
  ExecutionHistoryPage,
  ExecutionResult,
  ListExecutionsRequest,
  StartExecutionInput,
} from '../types/execution.types';
import { isTerminalExecutionState } from '../utils/execution-status.util';

export type ExecutionConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export interface ExecutionStreamEvent {
  event: string;
  executionId: string;
  ts: string;
  [key: string]: unknown;
}

class ExecutionStreamHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Execution stream rejected with status ${status}`);
    this.status = status;
  }
}

const MAX_SEEN_EVENTS = 500;
const MAX_RECONNECT_DELAY_MS = 15_000;

function isPermanentHttpStatus(status: number | undefined): boolean {
  return (
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  );
}

export const executionService = {
  startExecution: async (
    input: StartExecutionInput,
  ): Promise<ExecutionResult> => {
    try {
      const { idempotency_key, ...request } = input;
      return await executionApi.startExecution(request, idempotency_key);
    } catch (error: unknown) {
      // The server explains why it refused (e.g. the nodes are not one connected chain).
      if (
        error instanceof AxiosError &&
        error.response?.data &&
        typeof error.response.data === 'object' &&
        'message' in error.response.data
      ) {
        throw new Error(String(error.response.data.message), { cause: error });
      }
      throw error;
    }
  },

  getExecution: (executionId: string): Promise<ExecutionResult> =>
    executionApi.getExecution(executionId),

  listExecutions: (
    request: ListExecutionsRequest,
  ): Promise<ExecutionHistoryPage> => executionApi.listExecutions(request),

  subscribeExecution: (
    executionId: string,
    onEvent: (event: ExecutionStreamEvent) => void,
    onConnectionChange?: (state: ExecutionConnectionState) => void,
  ): (() => void) => {
    const controller = new AbortController();
    const token = useAuthStore.getState().token;
    const seenEventKeys = new Set<string>();
    const seenEventOrder: string[] = [];
    let stopped = false;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const notifyState = (state: ExecutionConnectionState) => {
      onConnectionChange?.(state);
    };

    const handleEvent = (event: ExecutionStreamEvent) => {
      const payload = event.payload;
      const snapshotStatus =
        payload && typeof payload === 'object' && 'status' in payload
          ? payload.status
          : undefined;
      onEvent(event);
      if (isTerminalExecutionState(event.event, event.status ?? snapshotStatus)) {
        stopped = true;
        controller.abort();
        notifyState('disconnected');
        if (event.event !== 'execution.snapshot') {
          void refreshSnapshot();
        }
      }
    };

    const refreshSnapshot = async () => {
      try {
        const snapshot = await executionService.getExecution(executionId);
        handleEvent({
          event: 'execution.snapshot',
          executionId,
          payload: snapshot,
          ts: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Execution snapshot refresh failed after reconnect:', error);
        notifyState('disconnected');
        if (
          isAxiosError(error) &&
          isPermanentHttpStatus(error.response?.status)
        ) {
          stopped = true;
        }
      }
    };

    const waitBeforeReconnect = () =>
      new Promise<void>((resolve) => {
        const delay = Math.min(500 * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS);
        reconnectAttempt += 1;
        const onAbort = () => {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            controller.signal.removeEventListener('abort', onAbort);
            resolve();
          };
        reconnectTimer = setTimeout(() => {
          controller.signal.removeEventListener('abort', onAbort);
          resolve();
        }, delay);
        controller.signal.addEventListener('abort', onAbort, { once: true });
      });

    const connect = async (): Promise<void> => {
      if (controller.signal.aborted || stopped) {
        return;
      }

      notifyState('reconnecting');

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8081'}/api/executions/${executionId}/events`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              Accept: 'text/event-stream',
            },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new ExecutionStreamHttpError(response.status);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Execution stream response has no body');
        }

        notifyState('connected');
        const connectedAt = Date.now();

        const decoder = new TextDecoder();
        let buffer = '';

        while (!controller.signal.aborted && !stopped) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const lines = part.split('\n');
            let eventName = 'message';
            let data = '';

            for (const line of lines) {
              if (!line) continue;
              if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                data += `${line.slice(5).trim()}\n`;
              }
            }

            const trimmed = data.trim();
            if (!trimmed) continue;

            try {
              const payload = JSON.parse(trimmed) as ExecutionStreamEvent & {
                payload?: unknown;
                nodeId?: string;
                status?: string;
                ts?: string;
              };
              const dedupeKey = [
                eventName,
                String(payload.executionId ?? executionId),
                String(payload.nodeId ?? 'execution'),
                String(payload.status ?? ''),
                String(payload.ts ?? ''),
              ].join(':');

              if (seenEventKeys.has(dedupeKey)) {
                continue;
              }
              seenEventKeys.add(dedupeKey);
              seenEventOrder.push(dedupeKey);
              if (seenEventOrder.length > MAX_SEEN_EVENTS) {
                const oldest = seenEventOrder.shift();
                if (oldest) seenEventKeys.delete(oldest);
              }

              handleEvent({ ...payload, event: eventName });
            } catch (error) {
              console.error('Execution stream payload parse failed:', error);
              handleEvent({
                event: eventName,
                executionId,
                ts: new Date().toISOString(),
                raw: trimmed,
              });
            }
          }
        }
        if (Date.now() - connectedAt >= 10_000) {
          reconnectAttempt = 0;
        }
      } catch (error) {
        if (controller.signal.aborted || stopped) return;
        console.error('Execution stream connection failed:', error);
        notifyState('disconnected');
        if (
          (error instanceof ExecutionStreamHttpError &&
            isPermanentHttpStatus(error.status)) ||
          (isAxiosError(error) && isPermanentHttpStatus(error.response?.status))
        ) {
          stopped = true;
          return;
        }
        await refreshSnapshot();
        if (!controller.signal.aborted && !stopped) {
          await waitBeforeReconnect();
          await connect();
        }
        return;
      }

      if (!controller.signal.aborted && !stopped) {
        notifyState('reconnecting');
        await refreshSnapshot();
        if (!controller.signal.aborted && !stopped) {
          await waitBeforeReconnect();
          await connect();
        }
      }
    };

    void connect().catch((error) => {
      console.error('Execution stream lifecycle failed:', error);
      if (!controller.signal.aborted && !stopped) {
        notifyState('disconnected');
      }
    });

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      controller.abort();
    };
  },
};
