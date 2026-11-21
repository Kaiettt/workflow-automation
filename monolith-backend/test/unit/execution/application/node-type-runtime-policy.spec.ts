import { NodeRunner } from '@app/execution/application/services/node-runner';
import { WorkflowEngine } from '@app/execution/application/services/workflow-engine';
import { NodeExecutionObserver } from '@app/execution/application/services/node-execution-observer';
import { MemoryExecutionRepository } from '@test/support/execution/start-execution.test-support';
import {
  ExecutionStatus,
  TriggerType,
} from '@app/execution/domain/constants/execution.constants';
import type { IOnceExecutor } from '@app/execution/domain/entities/node-executor';

describe('Runtime node policy (BDD-NM-02/03)', () => {
  const version = {
    id: 'version',
    workflowId: 'workflow',
    workflowOwnerId: 'actor-1',
    definition: {
      nodes: [
        {
          id: 'n1',
          data: { key: 'trigger.manual', name: 'Start', config: {} },
        },
        { id: 'n2', data: { key: 'logic.output', name: 'Output', config: {} } },
      ],
      edges: [{ source: 'n1', target: 'n2' }],
    },
  };
  it('stops the engine with a typed node failure and no executor side effects', async () => {
    const repo = new MemoryExecutionRepository(version);
    const execute = jest.fn(() => Promise.resolve([{ json: { sent: true } }]));
    const executor: IOnceExecutor = {
      key: 'trigger.manual',
      runMode: 'once',
      parseConfig: (raw) => raw,
      execute,
    };
    const runner = NodeRunner.create(repo, [executor], undefined, {
      isExecutionAllowed: () => Promise.resolve(false),
    });
    const engine = new WorkflowEngine(
      repo,
      { getConfigSchemas: () => Promise.resolve(new Map()) },
      runner,
      new NodeExecutionObserver(repo),
    );
    const startedAt = new Date();
    const executionId = await engine.createExecution(
      {
        version,
        triggerType: TriggerType.MANUAL,
        triggeredById: 'actor-1',
        triggerItems: [],
      },
      startedAt,
    );
    await engine.run(executionId, version, [], startedAt);
    expect(execute).not.toHaveBeenCalled();
    expect(repo.logs[0]).toMatchObject({
      status: ExecutionStatus.FAILED,
      errorCode: 'NODE_TYPE_DISABLED',
    });
    expect(repo.finishedStatus).toBe(ExecutionStatus.FAILED);
  });
});
