import { useEffect } from 'react';
import {
  executionService,
  type ExecutionStreamEvent,
} from '../services/execution.service';

export function useExecutionStream(
  executionId: string | null,
  onEvent: (event: ExecutionStreamEvent) => void,
  onConnectionChange?: (state: 'connected' | 'reconnecting' | 'disconnected') => void,
) {
  useEffect(() => {
    if (!executionId) return;

    const stop = executionService.subscribeExecution(
      executionId,
      onEvent,
      onConnectionChange,
    );
    return () => stop();
  }, [executionId, onEvent, onConnectionChange]);
}
