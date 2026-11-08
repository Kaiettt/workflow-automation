import { AxiosError } from 'axios';
import { executionApi } from '../api/execution.api';
import { useAuthStore } from '../../auth/store/auth.store';
import type {
  ExecutionHistoryPage,
  ExecutionResult,
  ListExecutionsRequest,
  StartExecutionInput,
} from '../types/execution.types';

export type ExecutionConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export interface ExecutionStreamEvent {
  event: string;
  executionId: string;
  ts: string;
  [key: string]: unknown;
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
    const terminalEvents = new Set([
      'execution.completed',
      'execution.failed',
    ]);
    const seenEventKeys = new Set<string>();
    let hasReachedTerminalState = false;

    const notifyState = (state: ExecutionConnectionState) => {
      onConnectionChange?.(state);
    };

    const refreshSnapshot = async () => {
      try {
        const snapshot = await executionService.getExecution(executionId);
        onEvent({
          event: 'execution.snapshot',
          executionId,
          payload: snapshot,
          ts: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Execution snapshot refresh failed after reconnect:', error);
        notifyState('disconnected');
      }
    };

    const connect = async (): Promise<void> => {
      if (controller.signal.aborted || hasReachedTerminalState) {
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
          throw new Error(`Execution stream rejected with status ${response.status}`);
        }

        notifyState('connected');

        const reader = response.body?.getReader();
        if (!reader) {
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (!controller.signal.aborted && !hasReachedTerminalState) {
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

              if (terminalEvents.has(eventName)) {
                hasReachedTerminalState = true;
                controller.abort();
              }

              onEvent({ ...payload, event: eventName });
            } catch (error) {
              console.error('Execution stream payload parse failed:', error);
              const rawEvent = {
                event: eventName,
                executionId,
                ts: new Date().toISOString(),
                raw: trimmed,
              };
              if (terminalEvents.has(eventName)) {
                hasReachedTerminalState = true;
                controller.abort();
              }
              onEvent(rawEvent);
            }
          }
        }
      } catch (error) {
        console.error('Execution stream connection failed:', error);
        notifyState('disconnected');
        if (!controller.signal.aborted && !hasReachedTerminalState) {
          try {
            await refreshSnapshot();
          } finally {
            setTimeout(() => {
              if (!controller.signal.aborted && !hasReachedTerminalState) {
                void connect();
              }
            }, 1000);
          }
        }
        return;
      }

      if (!controller.signal.aborted && !hasReachedTerminalState) {
        notifyState('reconnecting');
        await refreshSnapshot();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!controller.signal.aborted && !hasReachedTerminalState) {
          await connect();
        }
      }
    };

    void connect().catch((error) => {
      console.error('Execution stream lifecycle failed:', error);
      if (!controller.signal.aborted && !hasReachedTerminalState) {
        notifyState('disconnected');
      }
    });

    return () => {
      hasReachedTerminalState = true;
      controller.abort();
    };
  },
};
