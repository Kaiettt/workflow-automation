import { Item } from '../../domain/models/item';

export interface QueuedExecutionJob {
  executionId: string;
  workflowVersionId: string;
  triggerItems: Item[];
  queuedAt: string; // ISO time the execution row was created
}

export abstract class ExecutionQueuePort {
  abstract enqueue(job: QueuedExecutionJob): Promise<void>;
}
