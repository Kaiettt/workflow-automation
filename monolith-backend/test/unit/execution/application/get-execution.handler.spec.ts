import {
  GetExecutionHandler,
  GetExecutionQuery,
} from '@app/execution/application/queries/get-execution/get-execution.query';
import { MemoryExecutionRepository } from '@test/support/execution/start-execution.test-support';

describe('GetExecutionHandler', () => {
  it('returns an execution to its workflow owner', async () => {
    const repository = new MemoryExecutionRepository({
      id: 'version-1',
      workflowId: 'workflow-1',
      workflowOwnerId: 'actor-1',
      definition: { nodes: [], edges: [] },
    });
    const handler = new GetExecutionHandler(repository);

    await expect(
      handler.execute(new GetExecutionQuery('execution-1', 'actor-1')),
    ).resolves.toMatchObject({ id: 'execution-1' });
  });

  it('does not disclose an execution to another user', async () => {
    const repository = new MemoryExecutionRepository({
      id: 'version-1',
      workflowId: 'workflow-1',
      workflowOwnerId: 'actor-1',
      definition: { nodes: [], edges: [] },
    });
    const handler = new GetExecutionHandler(repository);

    await expect(
      handler.execute(new GetExecutionQuery('execution-1', 'actor-2')),
    ).rejects.toThrow('Execution not found');
  });
});
