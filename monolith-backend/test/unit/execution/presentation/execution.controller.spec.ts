import { QueryBus } from '@nestjs/cqrs';
jest.mock('@app/auth/infrastructure/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {},
}));
import { ExecutionController } from '@app/execution/presentation/http/execution.controller';
import { ExecutionStreamService } from '@app/execution/application/services/execution-stream.service';
import { ExecutionEventPublisher } from '@app/execution/application/ports/execution-event-publisher.port';
import { ExecutionEvent } from '@app/execution/application/ports/execution-event-publisher.port';
import { UserRole } from '@app/auth/domain/enums/user-role.enum';

describe('ExecutionController SSE lifecycle', () => {
  const user = {
    id: 'owner-1',
    name: 'Owner',
    role: UserRole.CLIENT,
    email: 'owner@example.test',
    sessionVersion: 0,
  };

  function createController(snapshot: unknown) {
    const queryBusExecute = jest.fn().mockResolvedValue(snapshot);
    const queryBus = {
      execute: queryBusExecute,
    } as unknown as QueryBus;
    const listeners = new Map<string, (event: ExecutionEvent) => void>();
    const unsubscribe = jest.fn();
    const eventPublisher = {
      subscribe: jest.fn(
        (executionId: string, listener: (event: ExecutionEvent) => void) => {
          listeners.set(executionId, listener);
          return unsubscribe;
        },
      ),
    } as unknown as ExecutionEventPublisher;

    const streamService = new ExecutionStreamService(queryBus, eventPublisher, {
      isActive: () => Promise.resolve(true),
      isCurrent: () => Promise.resolve(true),
    });
    const controller = new ExecutionController(
      {} as never,
      queryBus,
      streamService,
    );

    return {
      controller,
      streamService,
      queryBusExecute,
      eventPublisher,
      listeners,
      unsubscribe,
    };
  }

  it('keeps a running stream open until client unsubscribes', async () => {
    const { controller, unsubscribe } = createController({
      status: 'RUNNING',
    });

    const stream$ = controller.stream('execution-1', user);
    const emitted: unknown[] = [];
    let completed = false;

    const subscription = stream$.subscribe({
      next: (val) => emitted.push(val),
      complete: () => {
        completed = true;
      },
    });

    // Wait for initial async snapshot
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(emitted).toHaveLength(1);
    expect((emitted[0] as { type: string }).type).toBe('execution.snapshot');
    expect(completed).toBe(false);
    expect(unsubscribe).not.toHaveBeenCalled();

    subscription.unsubscribe();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it.each(['SUCCESS', 'FAILED', 'CANCELLED'])(
    'completes after emitting a terminal %s snapshot',
    async (status) => {
      const { controller, unsubscribe } = createController({
        status,
      });

      const stream$ = controller.stream('execution-1', user);
      const emitted: unknown[] = [];
      let completed = false;

      stream$.subscribe({
        next: (val) => emitted.push(val),
        complete: () => {
          completed = true;
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(emitted).toHaveLength(1);
      expect((emitted[0] as { type: string }).type).toBe('execution.snapshot');
      expect(completed).toBe(true);
      expect(unsubscribe).not.toHaveBeenCalled();
    },
  );

  it('completes when a terminal event is received from publisher', async () => {
    const { controller, listeners, unsubscribe } = createController({
      status: 'RUNNING',
    });

    const stream$ = controller.stream('execution-1', user);
    const emitted: unknown[] = [];
    let completed = false;

    stream$.subscribe({
      next: (val) => emitted.push(val),
      complete: () => {
        completed = true;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(emitted).toHaveLength(1);

    const listener = listeners.get('execution-1');
    expect(listener).toBeDefined();

    listener!({
      event: 'execution.completed',
      executionId: 'execution-1',
      status: 'SUCCESS',
      ts: new Date().toISOString(),
    });

    // Events now recheck the current session asynchronously before delivery.
    await new Promise((resolve) => setImmediate(resolve));

    expect(emitted).toHaveLength(2);
    expect((emitted[1] as { type: string }).type).toBe('execution.completed');
    expect(completed).toBe(true);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not open a stream when the execution is not accessible', async () => {
    const { controller, queryBusExecute } = createController(null);
    queryBusExecute.mockRejectedValueOnce(new Error('not found'));

    const stream$ = controller.stream('execution-1', user);
    let capturedError: Error | null = null;

    await new Promise<void>((resolve) => {
      stream$.subscribe({
        error: (err: Error) => {
          capturedError = err;
          resolve();
        },
      });
    });

    expect(capturedError).toBeDefined();
    expect((capturedError as unknown as Error).message).toBe('not found');
  });
});
