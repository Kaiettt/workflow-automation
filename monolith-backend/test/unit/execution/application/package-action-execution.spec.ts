import { AppApiError, nodeConfigSchema, PackageRegistry } from '@app/apps';
import { createPackages } from '@app/apps/packages';
import { WorkflowEngine } from '@app/execution/application/services/workflow-engine';
import { NodeCatalogPort } from '@app/execution/application/ports/node-catalog.port';
import {
  PackageActionExecutor,
  packageExecutors,
} from '@app/execution/application/executors/package-action-executor';
import {
  ExecutionStatus,
  TriggerType,
} from '@app/execution/domain/constants/execution.constants';
import type { ResolvedCredential } from '@app/execution/domain/models/execution.types';
import {
  chain,
  CREDENTIAL_ID,
  logOf,
  MemoryExecutionRepository,
} from '@test/support/execution/start-execution.test-support';
import { FakeMetaGraph } from '@test/support/apps/fake-meta-graph';
import { messengerSecret } from '@test/support/triggers/memory-triggers';

// The owner holds a connected Messenger credential.
class MessengerRepository extends MemoryExecutionRepository {
  resolveCredential(
    credentialId: string,
    ownerId: string,
  ): Promise<ResolvedCredential> {
    return ownerId === 'actor-1' && credentialId === CREDENTIAL_ID
      ? Promise.resolve({
          connectorKey: 'facebookMessengerOAuth2',
          secret: messengerSecret(),
        })
      : Promise.reject(new Error('credential was not found'));
  }
}

class PackageCatalog extends NodeCatalogPort {
  constructor(private readonly registry: PackageRegistry) {
    super();
  }
  getConfigSchemas(): Promise<Map<string, unknown>> {
    return Promise.resolve(
      new Map(
        this.registry.allNodes().map((n) => [n.key, nodeConfigSchema(n)]),
      ),
    );
  }
}

const chatTrigger = {
  id: 'chat',
  data: {
    key: 'messenger.trigger',
    name: 'Messenger Trigger',
    config: { credential_id: CREDENTIAL_ID, page_id: 'page-1' },
  },
};
const sendNode = (config: Record<string, unknown> = {}) => ({
  id: 'send',
  data: {
    key: 'messenger.sendMessage',
    name: 'Send',
    // recipient_id is left to its default expression.
    config: {
      credential_id: CREDENTIAL_ID,
      page_id: 'page-1',
      text: 'Bạn vừa nhắn: {{$json.text}}',
      ...config,
    },
  },
});

const incoming = {
  json: { sender_id: 'customer-7', page_id: 'page-1', text: 'Xin chào' },
};

function run(definition: unknown, graph: FakeMetaGraph) {
  const registry = new PackageRegistry(createPackages({ metaGraph: graph }));
  const repository = new MessengerRepository({
    id: 'version-1',
    workflowId: 'workflow-1',
    workflowOwnerId: 'actor-1',
    definition,
  });
  const engine = new WorkflowEngine(
    repository,
    packageExecutors(registry),
    new PackageCatalog(registry),
  );
  const startedAt = new Date();
  return engine
    .createExecution(
      {
        version: {
          id: 'version-1',
          workflowId: 'workflow-1',
          workflowOwnerId: 'actor-1',
          definition,
        },
        triggerType: TriggerType.WEBHOOK,
        triggeredById: null,
        triggerItems: [incoming],
      },
      startedAt,
    )
    .then((id) =>
      engine.run(
        id,
        {
          id: 'version-1',
          workflowId: 'workflow-1',
          workflowOwnerId: 'actor-1',
          definition,
        },
        [incoming],
        startedAt,
      ),
    )
    .then((status) => ({ status, repository }));
}

describe('action nodes of integration packages', () => {
  it('replies to the sender of the trigger event through the chosen Page', async () => {
    const graph = new FakeMetaGraph();
    const { status, repository } = await run(
      chain([chatTrigger, sendNode()]),
      graph,
    );

    expect(status).toBe(ExecutionStatus.SUCCESS);
    expect(graph.sent).toEqual([
      {
        pageAccessToken: 'EAApage1',
        recipientId: 'customer-7',
        message: { text: 'Bạn vừa nhắn: Xin chào' },
      },
    ]);
    expect(logOf(repository.logs, 'messenger.sendMessage')!.output).toEqual([
      {
        json: {
          page_id: 'page-1',
          recipient_id: 'customer-7',
          message_id: 'mid.1',
          status: 'sent',
        },
        pairedItem: 0,
      },
    ]);
  });

  it('fails the node when a required field resolves to nothing', async () => {
    const graph = new FakeMetaGraph();
    const { status, repository } = await run(
      chain([chatTrigger, sendNode({ text: '{{$json.missing}}' })]),
      graph,
    );
    expect(status).toBe(ExecutionStatus.FAILED);
    expect(logOf(repository.logs, 'messenger.sendMessage')!.errorMessage).toBe(
      'Text is required',
    );
    expect(graph.sent).toHaveLength(0);
  });

  it('retries temporary app errors, not permanent ones', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const registry = new PackageRegistry(
      createPackages({
        metaGraph: new FakeMetaGraph([
          new AppApiError('Facebook API error (500)', true),
          new AppApiError('Facebook API error (500)', true),
        ]),
      }),
    );
    const executor = new PackageActionExecutor(
      registry.action('messenger.sendMessage')!,
      sleep,
    );
    const params = {
      config: { page_id: 'page-1', recipient_id: 'c', text: 'hi' },
      item: { json: {} },
      credential: messengerSecret(),
    };
    await expect(executor.executeItem(params)).resolves.toMatchObject({
      status: 'sent',
    });
    expect(sleep.mock.calls).toEqual([[1000], [2000]]);

    const permanent = new PackageActionExecutor(
      new PackageRegistry(
        createPackages({
          metaGraph: new FakeMetaGraph([new AppApiError('24 hours', false)]),
        }),
      ).action('messenger.sendMessage')!,
      sleep,
    );
    await expect(permanent.executeItem(params)).rejects.toThrow('24 hours');
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('needs the node’s credential', async () => {
    const executor = new PackageActionExecutor(
      new PackageRegistry(
        createPackages({ metaGraph: new FakeMetaGraph() }),
      ).action('messenger.sendMessage')!,
    );
    expect(executor.expectedConnectorKey()).toBe('facebookMessengerOAuth2');
    await expect(
      executor.executeItem({
        config: { page_id: 'page-1', recipient_id: 'c', text: 'hi' },
        item: { json: {} },
        credential: null,
      }),
    ).rejects.toThrow('Choose a credential for this node');
  });
});
