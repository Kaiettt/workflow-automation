export type ExecutionEventType =
  | 'execution.queued'
  | 'execution.started'
  | 'node.started'
  | 'node.completed'
  | 'node.failed'
  | 'node.skipped'
  | 'execution.completed'
  | 'execution.failed';

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
  input?: unknown;
  output?: unknown;
  errorMessage?: string | null;
  ts: string;
}

export abstract class ExecutionEventPublisher {
  abstract publish(event: ExecutionEvent): Promise<void>;
  abstract subscribe(
    executionId: string,
    listener: (event: ExecutionEvent) => void,
  ): () => void;
}
