import {
  ExecutionStatus,
  NodeKeys,
  TriggerType,
} from '@app/execution/domain/constants/execution.constants';
import { Item } from '@app/execution/domain/models/item';
import { WorkflowEngine } from '@app/execution/application/services/workflow-engine';
import {
  ExecutionQueuePort,
  QueuedExecutionJob,
} from '@app/execution/application/ports/execution-queue.port';
import {
  EnqueueExecutionCommand,
  EnqueueExecutionHandler,
} from '@app/execution/application/commands/enqueue-execution/enqueue-execution.command';
import { ExecutionProcessor } from '@app/execution/infrastructure/queue/execution.processor';
import { WebhookTriggerExecutor } from '@app/execution/application/executors/webhook-trigger-executor';
import { FilterExecutor } from '@app/execution/application/executors/filter-executor';
import { GmailSendExecutor } from '@app/execution/application/executors/gmail-send-executor';
import { ManualTriggerExecutor } from '@app/execution/application/executors/manual-trigger-executor';
import {
  chain,
  decode,
  FakeCatalog,
  gmailNode,
  jsonOf,
  logOf,
  MemoryExecutionRepository,
} from '@test/support/execution/start-execution.test-support';
import type { Job } from 'bullmq';

const webhookTrigger = {
  id: 'hook',
  data: { key: NodeKeys.TRIGGER_WEBHOOK, name: 'Incoming', config: {} },
};
const urgentOnly = {
  id: 'filter',
  data: {
    key: NodeKeys.LOGIC_FILTER,
    name: 'Urgent',
    config: { field: 'body.priority', operator: 'equals', value: 'urgent' },
  },
};

const order = (priority: string): Item => ({
  json: {
    body: { email: 'kiet@gmail.com', priority, note: 'Need help' },
    query: {},
    headers: { 'content-type': 'application/json' },
    received_at: '2026-10-29T08:00:00.000Z',
  },
});

class FakeQueue extends ExecutionQueuePort {
  jobs: QueuedExecutionJob[] = [];
  enqueue(job: QueuedExecutionJob): Promise<void> {
    this.jobs.push(job);
    return Promise.resolve();
  }
}

function setup(definition: unknown) {
  const send = jest.fn().mockResolvedValue({ data: { id: 'm' } });
  // The owner (actor-1) holds the Gmail credential; nobody pressed Run.
  const repository = new MemoryExecutionRepository({
    id: 'version-1',
    workflowId: 'workflow-1',
    workflowOwnerId: 'actor-1',
    definition,
  });
  const engine = new WorkflowEngine(
    repository,
    [
      new ManualTriggerExecutor(),
      new WebhookTriggerExecutor(),
      new FilterExecutor(),
      new GmailSendExecutor(() => ({ users: { messages: { send } } })),
    ],
    new FakeCatalog(),
  );
  const queue = new FakeQueue();
  const enqueue = new EnqueueExecutionHandler(repository, engine, queue);
  const processor = new ExecutionProcessor(repository, engine);
  const process = (job: QueuedExecutionJob) =>
    processor.process({ data: job } as Job<QueuedExecutionJob>);
  return { repository, queue, enqueue, process, send };
}

const emailFlow = chain([
  webhookTrigger,
  urgentOnly,
  gmailNode({
    to: '{{$json.body.email}}',
    subject: 'Urgent request',
    body: '{{$json.body.note}}',
  }),
]);

describe('Webhook executions', () => {
  it('stores a WEBHOOK execution with no user and queues the payload', async () => {
    const { repository, queue, enqueue } = setup(emailFlow);

    const executionId = await enqueue.execute(
      new EnqueueExecutionCommand('version-1', [order('urgent')]),
    );

    expect(executionId).toBe('execution-1');
    expect(repository.created).toEqual([
      expect.objectContaining({
        workflowVersionId: 'version-1',
        triggerType: TriggerType.WEBHOOK,
        triggeredById: null,
        context: { triggerItems: [order('urgent')] },
      }),
    ]);
    expect(queue.jobs).toEqual([
      expect.objectContaining({
        executionId: 'execution-1',
        workflowVersionId: 'version-1',
        triggerItems: [order('urgent')],
      }),
    ]);
    // Nothing runs until the queue picks the job up.
    expect(repository.logs).toEqual([]);
  });

  it('runs the queued job: the payload reaches the nodes and the owner credential is used', async () => {
    const { repository, queue, enqueue, process, send } = setup(emailFlow);
    await enqueue.execute(
      new EnqueueExecutionCommand('version-1', [order('urgent')]),
    );

    const status = await process(queue.jobs[0]);

    expect(status).toBe(ExecutionStatus.SUCCESS);
    expect(repository.finishedStatus).toBe(ExecutionStatus.SUCCESS);
    const triggerLog = logOf(repository.logs, NodeKeys.TRIGGER_WEBHOOK);
    expect(jsonOf(triggerLog?.output)).toEqual([order('urgent').json]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(decode(send, 0)).toContain('To: kiet@gmail.com');
    expect(decode(send, 0)).toContain('Need help');
  });

  it('finishes with SUCCESS and sends nothing when the filter drops the payload', async () => {
    const { queue, enqueue, process, send } = setup(emailFlow);
    await enqueue.execute(
      new EnqueueExecutionCommand('version-1', [order('low')]),
    );

    expect(await process(queue.jobs[0])).toBe(ExecutionStatus.SUCCESS);
    expect(send).not.toHaveBeenCalled();
  });

  it('marks the execution FAILED when the definition cannot be run', async () => {
    const { repository, queue, enqueue, process } = setup({
      nodes: [webhookTrigger],
      edges: [],
    });
    await enqueue.execute(new EnqueueExecutionCommand('version-1', []));

    expect(await process(queue.jobs[0])).toBe(ExecutionStatus.FAILED);
    expect(repository.finishedStatus).toBe(ExecutionStatus.FAILED);
  });

  it('marks the execution FAILED when the version was deleted before the job ran', async () => {
    const { repository, process } = setup(emailFlow);
    jest.spyOn(repository, 'findVersion').mockResolvedValue(null);

    const status = await process({
      executionId: 'execution-1',
      workflowVersionId: 'gone',
      triggerItems: [],
      startedAt: new Date().toISOString(),
    });

    expect(status).toBe(ExecutionStatus.FAILED);
    expect(repository.finishedStatus).toBe(ExecutionStatus.FAILED);
  });

  it('starts the flow with an empty item when a webhook workflow gets no payload', async () => {
    const executor = new WebhookTriggerExecutor();
    await expect(executor.execute({ items: [] })).resolves.toEqual([
      { json: {} },
    ]);
  });
});
