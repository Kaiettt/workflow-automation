import { EventEmitter } from 'node:events';
import { QueryBus } from '@nestjs/cqrs';
jest.mock('@app/auth/infrastructure/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {},
}));
import { ExecutionController } from '@app/execution/presentation/http/execution.controller';
import { ExecutionEventPublisher } from '@app/execution/application/ports/execution-event-publisher.port';

describe('ExecutionController SSE lifecycle', () => {
  const user = { id: 'owner-1', email: 'owner@example.test' };

  function createController(snapshot: unknown) {
    const queryBusExecute = jest.fn().mockResolvedValue(snapshot);
    const queryBus = {
      execute: queryBusExecute,
    } as unknown as QueryBus;
    const listeners = new Map<string, (event: never) => void>();
    const unsubscribe = jest.fn();
    const eventPublisher = {
      subscribe: jest.fn(
        (executionId: string, listener: (event: never) => void) => {
          listeners.set(executionId, listener);
          return unsubscribe;
        },
      ),
    } as unknown as ExecutionEventPublisher;
    const controller = new ExecutionController(
      {} as never,
      queryBus,
      eventPublisher,
    );
    const response = new EventEmitter() as EventEmitter & {
      writableEnded: boolean;
      writes: string[];
      setHeader: jest.Mock;
      flushHeaders: jest.Mock;
      write: jest.Mock;
      end: jest.Mock;
    };
    response.writableEnded = false;
    response.writes = [];
    response.setHeader = jest.fn();
    response.flushHeaders = jest.fn();
    response.write = jest.fn((chunk: string) => {
      response.writes.push(chunk);
      return true;
    });
    response.end = jest.fn(() => {
      response.writableEnded = true;
    });
    return { controller, queryBusExecute, response, unsubscribe };
  }

  it('keeps a running stream open until the response disconnects', async () => {
    const { controller, response, unsubscribe } = createController({
      status: 'RUNNING',
    });

    await controller.stream('execution-1', user, response as never);

    expect(response.writes.join('')).toContain('execution.snapshot');
    expect(response.end.mock.calls).toHaveLength(0);

    response.emit('close');
    response.emit('close');

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(response.end.mock.calls).toHaveLength(1);
  });

  it.each(['SUCCESS', 'FAILED', 'CANCELLED'])(
    'closes after sending a terminal %s snapshot',
    async (status) => {
      const { controller, response, unsubscribe } = createController({
        status,
      });

      await controller.stream('execution-1', user, response as never);

      expect(response.writes.join('')).toContain('execution.snapshot');
      expect(response.end.mock.calls).toHaveLength(1);
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    },
  );

  it('does not open a stream when the execution is not accessible', async () => {
    const { controller, queryBusExecute, response } = createController(null);
    queryBusExecute.mockRejectedValueOnce(new Error('not found'));

    await expect(
      controller.stream('execution-1', user, response as never),
    ).rejects.toThrow('not found');

    expect(response.flushHeaders.mock.calls).toHaveLength(0);
  });
});
