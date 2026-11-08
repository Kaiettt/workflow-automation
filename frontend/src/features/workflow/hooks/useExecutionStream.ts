import { useEffect, useRef } from 'react';
import {
  executionService,
  type ExecutionStreamEvent,
} from '../services/execution.service';

export function useExecutionStream(
  executionId: string | null,
  onEvent: (event: ExecutionStreamEvent) => void,
  onConnectionChange?: (state: 'connected' | 'reconnecting' | 'disconnected') => void,
) {
  const onEventRef = useRef(onEvent);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => {
    onEventRef.current = onEvent;
    onConnectionChangeRef.current = onConnectionChange;
  }, [onEvent, onConnectionChange]);

  useEffect(() => {
    if (!executionId) return;

    const stop = executionService.subscribeExecution(
      executionId,
      (event) => onEventRef.current(event),
      (state) => onConnectionChangeRef.current?.(state),
    );
    return () => stop();
  }, [executionId]);
}
