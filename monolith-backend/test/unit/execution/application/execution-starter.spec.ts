import { ExecutionStarter } from '@app/execution/application/services/execution-starter';
import {
  ExecutionStatus,
  TriggerType,
} from '@app/execution/domain/constants/execution.constants';
import {
  ExecutionQueuePort,
  QueuedExecutionJob,
} from '@app/execution/application/ports/execution-queue.port';
import { MemoryExecutionRepository } from '@test/support/execution/start-execution.test-support';

class FakeQueue extends ExecutionQueuePort {
  jobs: QueuedExecutionJob[] = [];
  failure: Error | null = null;

  async enqueue(job: QueuedExecutionJob): Promise<void> {
    if (this.failure) throw this.failure;
    this.jobs.push(job);
  }
}

function setup() {
  const repository = new MemoryExecutionRepository({
    id: 'version-1',
    workflowId: 'workflow-1',
    workflowOwnerId: 'actor-1',
    definition: { nodes: [], edges: [] },
  });
  const queue = new FakeQueue();
  return {
    repository,
    queue,
    starter: new ExecutionStarter(repository, queue),
  };
}

describe('ExecutionStarter', () => {
  it('creates a queued manual execution and enqueues it for the shared worker', async () => {
    const { repository, queue, starter } = setup();
    const version = await repository.findVersion('version-1');
    if (!version) throw new Error('test workflow version is missing');

    const result = await starter.start({
      version,
      triggerType: TriggerType.MANUAL,
      triggeredById: 'actor-1',
      triggerItems: [],
    });

    expect(result).toEqual({
      id: 'execution-1',
      workflowId: 'workflow-1',
      workflowVersionId: 'version-1',
      triggerType: TriggerType.MANUAL,
      status: ExecutionStatus.QUEUED,
      queuedAt: expect.any(Date),
      startedAt: null,
    });
    expect(repository.created).toEqual([
      expect.objectContaining({
        workflowId: 'workflow-1',
        workflowVersionId: 'version-1',
        triggerType: TriggerType.MANUAL,
        triggeredById: 'actor-1',
        status: ExecutionStatus.QUEUED,
      }),
    ]);
    expect(queue.jobs).toEqual([
      expect.objectContaining({
        executionId: 'execution-1',
        workflowVersionId: 'version-1',
        triggerItems: [],
        queuedAt: repository.created[0].queuedAt.toISOString(),
      }),
    ]);
  });

  it('marks the execution failed when the queue rejects the job', async () => {
    const { repository, queue, starter } = setup();
    queue.failure = new Error('Redis unavailable');
    const version = await repository.findVersion('version-1');
    if (!version) throw new Error('test workflow version is missing');

    await expect(
      starter.start({
        version,
        triggerType: TriggerType.MANUAL,
        triggeredById: 'actor-1',
        triggerItems: [],
      }),
    ).rejects.toThrow('Redis unavailable');

    expect(repository.status).toBe(ExecutionStatus.FAILED);
    expect(queue.jobs).toHaveLength(0);
  });

  it('returns the original execution for a repeated idempotency key', async () => {
    const { repository, queue, starter } = setup();
    const version = await repository.findVersion('version-1');
    if (!version) throw new Error('test workflow version is missing');
    const input = {
      version,
      triggerType: TriggerType.MANUAL,
      triggeredById: 'actor-1',
      triggerItems: [],
      idempotencyKey: 'run-intent-1',
    };

    const first = await starter.start(input);
    const replay = await starter.start(input);

    expect(replay.id).toBe(first.id);
    expect(queue.jobs).toHaveLength(1);
    expect(repository.created).toHaveLength(1);
  });

  it('rejects reusing a key for a different workflow version', async () => {
    const { repository, queue, starter } = setup();
    const version = await repository.findVersion('version-1');
    if (!version) throw new Error('test workflow version is missing');
    const input = {
      version,
      triggerType: TriggerType.MANUAL,
      triggeredById: 'actor-1',
      triggerItems: [],
      idempotencyKey: 'run-intent-1',
    };
    await starter.start(input);

    await expect(
      starter.start({ ...input, version: { ...version, id: 'version-2' } }),
    ).rejects.toThrow('Idempotency key was already used');
    expect(queue.jobs).toHaveLength(1);
  });
});
