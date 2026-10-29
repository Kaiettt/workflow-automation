import {
  ExecutionStatus,
  NodeKeys,
} from '@app/execution/domain/constants/execution.constants';
import { WorkflowEngine } from '@app/execution/application/services/workflow-engine';
import { PassThroughTriggerExecutor } from '@app/execution/application/executors/pass-through-trigger-executor';
import { MessengerSendExecutor } from '@app/execution/application/executors/messenger-send-executor';
import { LlmGenerateExecutor } from '@app/execution/application/executors/llm-generate-executor';
import { LlmProviderRegistry } from '@app/execution/application/services/llm-provider.registry';
import {
  MessengerClient,
  MessengerSendRequest,
} from '@app/execution/application/ports/messenger-client.port';
import {
  ExecutionRecord,
  ResolvedCredential,
} from '@app/execution/domain/models/execution.types';
import {
  chain,
  FakeCatalog,
  FakeLlmProvider,
  llmNode,
  llmText,
  logOf,
  MemoryExecutionRepository,
} from '@test/support/execution/start-execution.test-support';
import { MESSENGER_SEND_CONFIG_SCHEMA } from '../../../../prisma/mvp-node-schemas';

const PAGE_CREDENTIAL_ID = '33333333-3333-3333-3333-333333333339';

class MessengerRepository extends MemoryExecutionRepository {
  resolveCredential(
    credentialId: string,
    ownerId: string,
  ): Promise<ResolvedCredential> {
    if (ownerId === 'actor-1' && credentialId === PAGE_CREDENTIAL_ID) {
      return Promise.resolve({
        connectorKey: 'messenger',
        secret: { page_id: 'page-1', page_access_token: 'EAApagetoken' },
      });
    }
    return super.resolveCredential(credentialId, ownerId);
  }
}

class CatalogWithMessenger extends FakeCatalog {
  async getConfigSchemas() {
    const schemas = await super.getConfigSchemas();
    schemas.set(NodeKeys.MESSENGER_SEND, MESSENGER_SEND_CONFIG_SCHEMA);
    return schemas;
  }
}

class FakeMessenger implements MessengerClient {
  sent: MessengerSendRequest[] = [];
  sendText(request: MessengerSendRequest) {
    this.sent.push(request);
    return Promise.resolve({ messageId: `mid.${this.sent.length}` });
  }
}

const chatTrigger = {
  id: 'chat',
  data: {
    key: NodeKeys.TRIGGER_MESSENGER_MESSAGE,
    name: 'Messenger Trigger',
    config: { credential_id: PAGE_CREDENTIAL_ID },
  },
};
const reply = (config: Record<string, unknown> = {}) => ({
  id: 'reply',
  data: {
    key: NodeKeys.MESSENGER_SEND,
    name: 'Reply',
    config: { credential_id: PAGE_CREDENTIAL_ID, ...config },
  },
});
const customerMessage = {
  json: {
    channel: 'messenger',
    message_id: 'm_1',
    sender_id: 'customer-1',
    recipient_id: 'page-1',
    text: 'Shop ơi còn size M không?',
  },
};

async function run(definition: unknown, llmReplies = [llmText('Dạ còn ạ!')]) {
  const repository = new MessengerRepository({
    id: 'version-1',
    workflowId: 'workflow-1',
    workflowOwnerId: 'actor-1',
    definition,
  });
  const messenger = new FakeMessenger();
  const llm = new FakeLlmProvider(llmReplies);
  const engine = new WorkflowEngine(
    repository,
    [
      new PassThroughTriggerExecutor(NodeKeys.TRIGGER_MESSENGER_MESSAGE),
      new LlmGenerateExecutor(new LlmProviderRegistry([llm]), 100, () =>
        Promise.resolve(),
      ),
      new MessengerSendExecutor(messenger, () => Promise.resolve()),
    ],
    new CatalogWithMessenger(),
  );
  const status = await engine.run(
    'execution-1',
    {
      id: 'version-1',
      workflowId: 'workflow-1',
      workflowOwnerId: 'actor-1',
      definition,
    },
    [customerMessage],
    new Date(),
  );
  return { status, repository, messenger, llm };
}

describe('Messenger workflows', () => {
  it('answers the customer with the LLM reply (Messenger → LLM → Messenger)', async () => {
    const { status, messenger, llm } = await run(
      chain([
        chatTrigger,
        llmNode({ prompt: 'Trả lời khách: {{$json.text}}' }),
        reply({
          recipient_id: '{{$node["Messenger Trigger"].json.sender_id}}',
          text: '{{$json.text}}',
        }),
      ]),
    );

    expect(status).toBe(ExecutionStatus.SUCCESS);
    expect(llm.requests[0].prompt).toBe(
      'Trả lời khách: Shop ơi còn size M không?',
    );
    expect(messenger.sent).toEqual([
      {
        pageAccessToken: 'EAApagetoken',
        recipientId: 'customer-1',
        text: 'Dạ còn ạ!',
      },
    ]);
  });

  it('replies to the sender by default when the send node follows the trigger', async () => {
    const { status, messenger } = await run(
      chain([chatTrigger, reply({ text: 'Cảm ơn bạn đã nhắn tin!' })]),
    );

    expect(status).toBe(ExecutionStatus.SUCCESS);
    expect(messenger.sent[0].recipientId).toBe('customer-1');
  });

  it('fails the send node when given a credential of another connector', async () => {
    const { status, repository, messenger } = await run(
      chain([
        chatTrigger,
        reply({
          credential_id: '33333333-3333-3333-3333-333333333332',
          text: 'x',
        }),
      ]),
    );

    expect(status).toBe(ExecutionStatus.FAILED);
    expect(
      logOf(repository.logs, NodeKeys.MESSENGER_SEND)?.errorMessage,
    ).toContain('messenger');
    expect(messenger.sent).toEqual([]);
  });

  it('stores the customer message as the context of the execution', async () => {
    const repository = new MessengerRepository({
      id: 'version-1',
      workflowId: 'workflow-1',
      workflowOwnerId: 'actor-1',
      definition: chain([chatTrigger, reply({ text: 'x' })]),
    });
    const engine = new WorkflowEngine(
      repository,
      [],
      new CatalogWithMessenger(),
    );
    await engine.createExecution(
      {
        version: {
          id: 'version-1',
          workflowId: 'workflow-1',
          workflowOwnerId: 'actor-1',
          definition: {},
        },
        triggerType: 'WEBHOOK' as ExecutionRecord['triggerType'],
        triggeredById: null,
        triggerItems: [customerMessage],
      },
      new Date(),
    );
    expect(repository.created[0].context).toEqual({
      triggerItems: [customerMessage],
    });
  });
});
