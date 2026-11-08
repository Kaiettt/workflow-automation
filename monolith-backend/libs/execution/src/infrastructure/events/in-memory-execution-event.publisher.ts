import { Injectable } from '@nestjs/common';
import {
  ExecutionEvent,
  ExecutionEventPublisher,
} from '../../application/ports/execution-event-publisher.port';

@Injectable()
export class InMemoryExecutionEventPublisher extends ExecutionEventPublisher {
  private readonly listeners = new Map<
    string,
    Set<(event: ExecutionEvent) => void>
  >();

  publish(event: ExecutionEvent): Promise<void> {
    const subscribers = this.listeners.get(event.executionId) ?? new Set();
    for (const listener of Array.from(subscribers)) {
      listener(event);
    }

    if (
      event.event === 'execution.completed' ||
      event.event === 'execution.failed'
    ) {
      this.listeners.delete(event.executionId);
    }

    return Promise.resolve();
  }

  subscribe(
    executionId: string,
    listener: (event: ExecutionEvent) => void,
  ): () => void {
    const subscribers = this.listeners.get(executionId) ?? new Set();
    subscribers.add(listener);
    this.listeners.set(executionId, subscribers);

    return () => {
      const active = this.listeners.get(executionId);
      if (!active) return;
      active.delete(listener);
      if (active.size === 0) {
        this.listeners.delete(executionId);
      }
    };
  }
}
