import { isAxiosError } from 'axios';

export type SseConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export class SseHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Execution stream rejected with status ${status}`);
    this.status = status;
  }
}

export function isPermanentHttpStatus(status: number | undefined): boolean {
  return (
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  );
}

export interface SseSubscribeOptions<TEvent extends { event: string; [key: string]: unknown }> {
  url: string;
  token?: string | null;
  onEvent: (event: TEvent) => void;
  onConnectionChange?: (state: SseConnectionState) => void;
  onReconnect?: () => Promise<void>;
  onTerminal?: (event: TEvent) => Promise<void> | void;
  isTerminal?: (event: TEvent) => boolean;
  getDedupeKey?: (event: TEvent) => string | undefined;
  maxSeenEvents?: number;
  maxReconnectDelayMs?: number;
}

const DEFAULT_MAX_SEEN_EVENTS = 500;
const DEFAULT_MAX_RECONNECT_DELAY_MS = 15_000;

export class SseConnectionManager {
  subscribe<TEvent extends { event: string; [key: string]: unknown }>(
    options: SseSubscribeOptions<TEvent>,
  ): () => void {
    const {
      url,
      token,
      onEvent,
      onConnectionChange,
      onReconnect,
      onTerminal,
      isTerminal,
      getDedupeKey,
      maxSeenEvents = DEFAULT_MAX_SEEN_EVENTS,
      maxReconnectDelayMs = DEFAULT_MAX_RECONNECT_DELAY_MS,
    } = options;

    const controller = new AbortController();
    const seenEventKeys = new Set<string>();
    const seenEventOrder: string[] = [];
    let stopped = false;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const notifyState = (state: SseConnectionState) => {
      onConnectionChange?.(state);
    };

    const handleEvent = (event: TEvent) => {
      onEvent(event);
      if (isTerminal?.(event)) {
        stopped = true;
        controller.abort();
        notifyState('disconnected');
        if (onTerminal) {
          void onTerminal(event);
        }
      }
    };

    const waitBeforeReconnect = () =>
      new Promise<void>((resolve) => {
        const delay = Math.min(500 * 2 ** reconnectAttempt, maxReconnectDelayMs);
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

    const triggerReconnectRefresh = async () => {
      if (!onReconnect) return;
      try {
        await onReconnect();
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

    const connect = async (): Promise<void> => {
      if (controller.signal.aborted || stopped) {
        return;
      }

      notifyState('reconnecting');

      try {
        const response = await fetch(url, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new SseHttpError(response.status);
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
              const payload = JSON.parse(trimmed) as TEvent;
              const dedupeKey = getDedupeKey
                ? getDedupeKey(payload)
                : `${eventName}:${String(payload.executionId ?? '')}:${String(payload.nodeId ?? 'execution')}:${String(payload.status ?? '')}:${String(payload.ts ?? '')}`;

              if (dedupeKey) {
                if (seenEventKeys.has(dedupeKey)) {
                  continue;
                }
                seenEventKeys.add(dedupeKey);
                seenEventOrder.push(dedupeKey);
                if (seenEventOrder.length > maxSeenEvents) {
                  const oldest = seenEventOrder.shift();
                  if (oldest) seenEventKeys.delete(oldest);
                }
              }

              handleEvent({ ...payload, event: eventName });
            } catch (error) {
              console.error('Execution stream payload parse failed:', error);
              handleEvent({
                event: eventName,
                raw: trimmed,
                ts: new Date().toISOString(),
              } as unknown as TEvent);
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
          (error instanceof SseHttpError && isPermanentHttpStatus(error.status)) ||
          (isAxiosError(error) && isPermanentHttpStatus(error.response?.status))
        ) {
          stopped = true;
          return;
        }
        await triggerReconnectRefresh();
        if (!controller.signal.aborted && !stopped) {
          await waitBeforeReconnect();
          await connect();
        }
        return;
      }

      if (!controller.signal.aborted && !stopped) {
        notifyState('reconnecting');
        await triggerReconnectRefresh();
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
  }
}

export const sseConnectionManager = new SseConnectionManager();

