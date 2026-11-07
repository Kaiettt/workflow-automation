// Shared fixtures for the StartExecutionHandler specs: in-memory repository,
// catalog with the real node schemas, node builders and a handler factory.
import {
  StartExecutionCommand,
  StartExecutionHandler,
} from '@app/execution/application/commands/start-execution/start-execution.command';
import { ExecutionRepository } from '@app/execution/domain/repositories/execution.repository';
import {
  ExecutionRecord,
  ExecutionStartRecord,
  ExecutionHistoryPage,
  NodeLogRecord,
  ResolvedCredential,
  WorkflowVersionForExecution,
} from '@app/execution/domain/models/execution.types';
import {
  ExecutionStatus,
  NodeKeys,
} from '@app/execution/domain/constants/execution.constants';
import { Item } from '@app/execution/domain/models/item';
import { NodeCatalogPort } from '@app/execution/application/ports/node-catalog.port';
import {
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmProvider,
} from '@app/execution/application/ports/llm-provider.port';
import { LlmProviderRegistry } from '@app/execution/application/services/llm-provider.registry';
import { ManualTriggerExecutor } from '@app/execution/application/executors/manual-trigger-executor';
import { GoogleSheetReadRowsExecutor } from '@app/execution/application/executors/google-sheet-read-rows-executor';
import { FilterExecutor } from '@app/execution/application/executors/filter-executor';
import { GmailSendExecutor } from '@app/execution/application/executors/gmail-send-executor';
import { AggregateExecutor } from '@app/execution/application/executors/aggregate-executor';
import { IfExecutor } from '@app/execution/application/executors/if-executor';
import { SwitchExecutor } from '@app/execution/application/executors/switch-executor';
import { SetFieldsExecutor } from '@app/execution/application/executors/set-fields-executor';
import { ChatMemoryExecutor } from '@app/execution/application/executors/chat-memory-executor';
import {
  ChatMemoryPort,
  ChatMessage,
} from '@app/execution/application/ports/chat-memory.port';
import { LlmGenerateExecutor } from '@app/execution/application/executors/llm-generate-executor';
import {
  ExecutionQueuePort,
  QueuedExecutionJob,
} from '@app/execution/application/ports/execution-queue.port';
import { ExecutionStarter } from '@app/execution/application/services/execution-starter';
import { WorkflowEngine } from '@app/execution/application/services/workflow-engine';
import { ExecutionProcessor } from '@app/execution/infrastructure/queue/execution.processor';
import type { Job } from 'bullmq';
import {
  AGGREGATE_CONFIG_SCHEMA,
  FILTER_CONFIG_SCHEMA,
  GMAIL_SEND_CONFIG_SCHEMA,
  GOOGLE_SHEET_READ_ROWS_CONFIG_SCHEMA,
  CHAT_MEMORY_CONFIG_SCHEMA,
  IF_CONFIG_SCHEMA,
  LLM_GENERATE_CONFIG_SCHEMA,
  MANUAL_TRIGGER_CONFIG_SCHEMA,
  SET_CONFIG_SCHEMA,
  SWITCH_CONFIG_SCHEMA,
} from '../../../prisma/mvp-node-schemas';

export const CREDENTIAL_ID = '33333333-3333-3333-3333-333333333331';
export const LLM_CREDENTIAL_ID = '33333333-3333-3333-3333-333333333332';
export const LLM_API_KEY = 'sk-live-SECRETSECRETSECRET1234567890';

export class MemoryExecutionRepository extends ExecutionRepository {
  logs: NodeLogRecord[] = [];
  finishedStatus: ExecutionStatus | null = null;
  // Connector the stored credentials belong to.
  connectorKey = 'google';
  llmConnectorKey = 'openai';

  constructor(private readonly version: WorkflowVersionForExecution) {
    super();
  }

  findVersion(id: string): Promise<WorkflowVersionForExecution | null> {
    return Promise.resolve(id === this.version.id ? this.version : null);
  }

  created: Array<Omit<ExecutionRecord, 'id'>> = [];

  // Status of the (single) execution, as the database would hold it.
  status: ExecutionStatus | null = null;

  createExecution(input: Omit<ExecutionRecord, 'id'>): Promise<string> {
    this.created.push(input);
    this.status = input.status;
    return Promise.resolve('execution-1');
  }

  findExecutionByIdempotencyKey(
    actorId: string,
    idempotencyKey: string,
  ): Promise<ExecutionStartRecord | null> {
    const record = this.created.find(
      (execution) =>
        execution.triggeredById === actorId &&
        execution.idempotencyKey === idempotencyKey,
    );
    if (!record) return Promise.resolve(null);
    return Promise.resolve({
      id: 'execution-1',
      workflowId: record.workflowId,
      workflowVersionId: record.workflowVersionId,
      triggerType: record.triggerType,
      status: this.status ?? record.status,
      queuedAt: record.queuedAt,
      startedAt: record.startedAt,
    });
  }

  claimQueuedExecution(): Promise<boolean> {
    if (this.status !== ExecutionStatus.QUEUED) return Promise.resolve(false);
    this.status = ExecutionStatus.RUNNING;
    return Promise.resolve(true);
  }

  failUnfinishedExecution(): Promise<void> {
    if (
      this.status === ExecutionStatus.QUEUED ||
      this.status === ExecutionStatus.RUNNING
    ) {
      this.status = ExecutionStatus.FAILED;
      this.finishedStatus = ExecutionStatus.FAILED;
    }
    return Promise.resolve();
  }

  resolveCredential(
    credentialId: string,
    ownerId: string,
  ): Promise<ResolvedCredential> {
    if (ownerId === 'actor-1' && credentialId === CREDENTIAL_ID) {
      return Promise.resolve({
        connectorKey: this.connectorKey,
        secret: {
          refresh_token: 'test-refresh-token',
          access_token: 'test-access-token',
        },
      });
    }
    if (ownerId === 'actor-1' && credentialId === LLM_CREDENTIAL_ID) {
      return Promise.resolve({
        connectorKey: this.llmConnectorKey,
        secret: { api_key: LLM_API_KEY },
      });
    }
    return Promise.reject(new Error('credential was not found'));
  }

  saveNodeLog(_executionId: string, log: NodeLogRecord): Promise<void> {
    this.logs.push(log);
    return Promise.resolve();
  }

  finishExecution(id: string, status: ExecutionStatus): Promise<void> {
    if (id !== 'execution-1') return Promise.resolve();
    this.finishedStatus = status;
    this.status = status;
    return Promise.resolve();
  }

  findExecutionResult(id: string): Promise<unknown> {
    if (id !== 'execution-1') return Promise.resolve(null);
    return Promise.resolve({
      id: 'execution-1',
      status: this.finishedStatus,
      nodeLogs: this.logs,
    });
  }

  findExecutionResultForOwner(id: string, ownerId: string): Promise<unknown> {
    if (id !== 'execution-1' || ownerId !== this.version.workflowOwnerId) {
      return Promise.resolve(null);
    }
    return this.findExecutionResult(id);
  }

  listExecutionHistoryForOwner(): Promise<ExecutionHistoryPage> {
    return Promise.resolve({ items: [], nextCursor: null });
  }

  failStaleExecutions(): Promise<number> {
    return Promise.resolve(0);
  }
}

export class FakeCatalog extends NodeCatalogPort {
  getConfigSchemas(): Promise<Map<string, unknown>> {
    return Promise.resolve(
      new Map<string, unknown>([
        [NodeKeys.TRIGGER_MANUAL, MANUAL_TRIGGER_CONFIG_SCHEMA],
        [NodeKeys.GOOGLE_SHEET_READ_ROWS, GOOGLE_SHEET_READ_ROWS_CONFIG_SCHEMA],
        [NodeKeys.LOGIC_FILTER, FILTER_CONFIG_SCHEMA],
        [NodeKeys.GMAIL_SEND, GMAIL_SEND_CONFIG_SCHEMA],
        [NodeKeys.DATA_AGGREGATE, AGGREGATE_CONFIG_SCHEMA],
        [NodeKeys.AI_LLM_GENERATE, LLM_GENERATE_CONFIG_SCHEMA],
        [NodeKeys.LOGIC_IF, IF_CONFIG_SCHEMA],
        [NodeKeys.LOGIC_SWITCH, SWITCH_CONFIG_SCHEMA],
        [NodeKeys.DATA_SET, SET_CONFIG_SCHEMA],
        [NodeKeys.MEMORY_CHAT, CHAT_MEMORY_CONFIG_SCHEMA],
      ]),
    );
  }
}

type LlmReply = LlmGenerateResult | Error;

// Answers prompts from a queue (or "ok") and remembers what it was asked.
export class FakeLlmProvider implements LlmProvider {
  readonly key = 'openai';
  readonly requests: LlmGenerateRequest[] = [];

  constructor(private readonly replies: LlmReply[] = []) {}

  generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    this.requests.push(request);
    const reply = this.replies.shift() ?? llmText('ok');
    return reply instanceof Error
      ? Promise.reject(reply)
      : Promise.resolve(reply);
  }
}

export const llmText = (text: string): LlmGenerateResult => ({
  text,
  usage: { inputTokens: 10, outputTokens: 4 },
});

// Conversations kept in memory, keyed like the Redis version.
export class FakeChatMemory extends ChatMemoryPort {
  sessions = new Map<string, ChatMessage[]>();
  lastTtlSeconds: number | null = null;

  private key(workflowId: string, sessionKey: string) {
    return `${workflowId}/${sessionKey}`;
  }

  load(workflowId: string, sessionKey: string, limit: number) {
    const all = this.sessions.get(this.key(workflowId, sessionKey)) ?? [];
    return Promise.resolve(all.slice(-limit));
  }

  append(
    workflowId: string,
    sessionKey: string,
    messages: ChatMessage[],
    options: { maxMessages: number; ttlSeconds: number },
  ) {
    const key = this.key(workflowId, sessionKey);
    this.sessions.set(
      key,
      [...(this.sessions.get(key) ?? []), ...messages].slice(
        -options.maxMessages,
      ),
    );
    this.lastTtlSeconds = options.ttlSeconds;
    return Promise.resolve();
  }

  clear(workflowId: string, sessionKey: string) {
    this.sessions.delete(this.key(workflowId, sessionKey));
    return Promise.resolve();
  }
}

export type Row = string[];
export const CUSTOMERS: Row[] = [
  ['name', 'email', 'status'],
  ['Kiet', 'kiet@gmail.com', 'new'],
  ['An', 'an@gmail.com', 'contacted'],
  ['Minh', 'minh@gmail.com', 'new'],
];

export const trigger = {
  id: 'trigger',
  data: { key: NodeKeys.TRIGGER_MANUAL, name: 'Start', config: {} },
};
export const sheetNode = {
  id: 'sheet',
  data: {
    key: NodeKeys.GOOGLE_SHEET_READ_ROWS,
    name: 'Read Customers',
    config: {
      credential_id: CREDENTIAL_ID,
      spreadsheet_id: 'sheet-1',
      sheet_name: 'Sheet1',
    },
  },
};
export const filterNode = (value = 'new') => ({
  id: 'filter',
  data: {
    key: NodeKeys.LOGIC_FILTER,
    name: 'Only New',
    config: { field: 'status', operator: 'equals', value },
  },
});
export const gmailNode = (config: Record<string, unknown>) => ({
  id: 'gmail',
  data: {
    key: NodeKeys.GMAIL_SEND,
    name: 'Send Email',
    config: { credential_id: CREDENTIAL_ID, ...config },
  },
});
export const aggregateNode = {
  id: 'agg',
  data: { key: NodeKeys.DATA_AGGREGATE, name: 'Gather', config: {} },
};
export const llmNode = (config: Record<string, unknown>) => ({
  id: 'llm',
  data: {
    key: NodeKeys.AI_LLM_GENERATE,
    name: 'Ask AI',
    config: {
      provider: 'openai',
      credential_id: LLM_CREDENTIAL_ID,
      model: 'test-model',
      ...config,
    },
  },
});

export function chain<T extends { id: string }>(nodes: T[]) {
  return {
    nodes,
    edges: nodes.slice(1).map((node, i) => ({
      source: nodes[i].id,
      target: node.id,
    })),
  };
}

export interface BuildOptions {
  rows?: Row[];
  send?: jest.Mock;
  connectorKey?: string;
  llmReplies?: LlmReply[];
  llmConnectorKey?: string;
  llmCeiling?: number;
  catalog?: NodeCatalogPort;
  memory?: ChatMemoryPort;
}

class TestExecutionQueue extends ExecutionQueuePort {
  jobs: QueuedExecutionJob[] = [];

  enqueue(job: QueuedExecutionJob): Promise<void> {
    this.jobs.push(job);
    return Promise.resolve();
  }
}

export function build(definition: unknown, options: BuildOptions = {}) {
  const send =
    options.send ?? jest.fn().mockResolvedValue({ data: { id: 'm' } });
  const llm = new FakeLlmProvider(options.llmReplies);
  const repository = new MemoryExecutionRepository({
    id: 'version-1',
    workflowId: 'workflow-1',
    workflowOwnerId: 'actor-1',
    definition,
  });
  if (options.connectorKey) repository.connectorKey = options.connectorKey;
  if (options.llmConnectorKey) {
    repository.llmConnectorKey = options.llmConnectorKey;
  }

  const engine = new WorkflowEngine(
    repository,
    [
      new ManualTriggerExecutor(),
      new GoogleSheetReadRowsExecutor(() => ({
        spreadsheets: {
          values: {
            get: jest.fn().mockResolvedValue({
              data: { values: options.rows ?? CUSTOMERS },
            }),
          },
        },
      })),
      new FilterExecutor(),
      new IfExecutor(),
      new SwitchExecutor(),
      new SetFieldsExecutor(),
      new ChatMemoryExecutor(options.memory ?? new FakeChatMemory()),
      new GmailSendExecutor(() => ({ users: { messages: { send } } })),
      new AggregateExecutor(),
      new LlmGenerateExecutor(
        new LlmProviderRegistry([llm]),
        options.llmCeiling ?? 500,
        () => Promise.resolve(),
      ),
    ],
    options.catalog ?? new FakeCatalog(),
  );
  const queue = new TestExecutionQueue();
  const starter = new ExecutionStarter(repository, queue);
  const processor = new ExecutionProcessor(repository, engine);
  const handler = new StartExecutionHandler(repository, engine, starter);

  const start = () =>
    handler.execute(new StartExecutionCommand('version-1', 'actor-1'));
  const run = async () => {
    const accepted = await start();
    await processor.process({ data: queue.jobs[0] } as Job<QueuedExecutionJob>);
    return (await repository.findExecutionResult(accepted.id)) as {
      nodeLogs: NodeLogRecord[];
      status: ExecutionStatus;
    };
  };
  return { start, run, repository, queue, send, llm };
}

export const logOf = (nodeLogs: NodeLogRecord[], key: string) =>
  nodeLogs.find((log) => log.nodeKey === key);

export const jsonOf = (value: unknown) =>
  (value as Item[]).map((item) => item.json);

export const decode = (send: jest.Mock, call: number): string => {
  const calls = send.mock.calls as Array<[{ requestBody: { raw: string } }]>;
  return Buffer.from(calls[call][0].requestBody.raw, 'base64url').toString();
};
