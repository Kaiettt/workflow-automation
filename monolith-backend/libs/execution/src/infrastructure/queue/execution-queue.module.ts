import { Injectable } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ExecutionQueuePort,
  QueuedExecutionJob,
} from '../../application/ports/execution-queue.port';

export const EXECUTION_QUEUE = 'executions';

// Connection is read at startup (after .env is loaded), not at import time.
export const executionQueueImports = [
  BullModule.forRootAsync({
    useFactory: () => ({
      // Separate key space per environment, e.g. so e2e runs are not picked
      // up by a dev server sharing the same Redis.
      prefix: process.env['BULLMQ_PREFIX'] || 'bull',
      connection: {
        host: process.env['REDIS_HOST'] || 'localhost',
        port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
        password: process.env['REDIS_PASSWORD'] || undefined,
      },
    }),
  }),
  BullModule.registerQueue({
    name: EXECUTION_QUEUE,
    defaultJobOptions: {
      // A failed run is never replayed automatically: nodes may already have
      // sent emails or messages.
      attempts: 1,
      removeOnComplete: 1000,
      removeOnFail: 1000,
    },
  }),
];

@Injectable()
export class BullMqExecutionQueue implements ExecutionQueuePort {
  constructor(@InjectQueue(EXECUTION_QUEUE) private readonly queue: Queue) {}

  async enqueue(job: QueuedExecutionJob): Promise<void> {
    await this.queue.add('run', job, { jobId: job.executionId });
  }
}
