import { AxiosError } from 'axios';
import { executionApi } from '../api/execution.api';
import {
  sseConnectionManager,
  type SseConnectionState,
} from '../api/sse-client';
import { useAuthStore } from '../../auth/store/auth.store';
import type {
  ExecutionHistoryPage,
  ExecutionResult,
  ListExecutionsRequest,
  StartExecutionInput,
} from '../types/execution.types';
import { isTerminalExecutionState } from '../utils/execution-status.util';

export type ExecutionConnectionState = SseConnectionState;

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
    const url = executionApi.getEventStreamUrl(executionId);
    const token = useAuthStore.getState().token;

    const refreshSnapshot = async () => {
      const snapshot = await executionService.getExecution(executionId);
      onEvent({
        event: 'execution.snapshot',
        executionId,
        payload: snapshot,
        ts: new Date().toISOString(),
      });
    };

    return sseConnectionManager.subscribe<ExecutionStreamEvent>({
      url,
      token,
      onEvent,
      onConnectionChange,
      onReconnect: refreshSnapshot,
      isTerminal: (event) => {
        const payload = event.payload;
        const snapshotStatus =
          payload && typeof payload === 'object' && 'status' in payload
            ? payload.status
            : undefined;
        return isTerminalExecutionState(event.event, event.status ?? snapshotStatus);
      },
      onTerminal: (event) => {
        if (event.event !== 'execution.snapshot') {
          return refreshSnapshot();
        }
      },
    });
  },
};
