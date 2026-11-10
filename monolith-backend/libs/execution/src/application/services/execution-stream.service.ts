import { Injectable, MessageEvent } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Observable } from 'rxjs';
import { GetExecutionQuery } from '../queries/get-execution/get-execution.query';
import { ExecutionEventPublisher } from '../ports/execution-event-publisher.port';
import { isTerminalExecutionState } from '../../domain/constants/execution.constants';

@Injectable()
export class ExecutionStreamService {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly eventPublisher: ExecutionEventPublisher,
  ) {}

  createStream(executionId: string, userId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let cleanedUp = false;
      let unsubscribe: () => void = () => undefined;
      let heartbeat: NodeJS.Timeout | undefined;

      const doCleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
      };

      void (async () => {
        try {
          const snapshot: unknown = await this.queryBus.execute(
            new GetExecutionQuery(executionId, userId),
          );

          if (cleanedUp || subscriber.closed) return;

          subscriber.next({
            type: 'execution.snapshot',
            data: {
              event: 'execution.snapshot',
              executionId,
              payload: snapshot,
              ts: new Date().toISOString(),
            },
          });

          if (
            snapshot &&
            typeof snapshot === 'object' &&
            'status' in snapshot &&
            isTerminalExecutionState('execution.snapshot', snapshot.status)
          ) {
            subscriber.complete();
            doCleanup();
            return;
          }

          unsubscribe = this.eventPublisher.subscribe(executionId, (event) => {
            if (cleanedUp || subscriber.closed) return;
            subscriber.next({
              type: event.event,
              data: event,
            });

            if (isTerminalExecutionState(event.event, event.status)) {
              subscriber.complete();
              doCleanup();
            }
          });

          heartbeat = setInterval(() => {
            if (!cleanedUp && !subscriber.closed) {
              subscriber.next({
                type: 'heartbeat',
                data: { ts: new Date().toISOString() },
              });
            }
          }, 15000);
        } catch (error) {
          subscriber.error(error);
          doCleanup();
        }
      })();

      return () => {
        doCleanup();
      };
    });
  }
}
