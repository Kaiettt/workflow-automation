export type ExecutionEventType =
  | 'execution.queued'
  | 'execution.started'
  | 'node.started'
  | 'node.completed'
  | 'node.failed'
  | 'node.skipped'
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.cancelled';
// Cancellation is terminal without calling an executor.

export interface ExecutionEvent {
  event: ExecutionEventType;
  executionId: string;
  workflowId?: string;
  workflowVersionId?: string;
  nodeId?: string;
  nodeKey?: string;
  status?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  ts: string;
}

export abstract class ExecutionEventPublisher {
  abstract publish(event: ExecutionEvent): Promise<void>;
  abstract subscribe(
    executionId: string,
    listener: (event: ExecutionEvent) => void,
  ): () => void;
}

export async function publishExecutionEventSafely(
  publisher: ExecutionEventPublisher | undefined,
  event: ExecutionEvent,
): Promise<void> {
  if (!publisher) return;
  try {
    await publisher.publish(event);
  } catch (error) {
    console.error(
      `Could not publish ${event.event} for execution ${event.executionId}:`,
      error,
    );
  }
}
