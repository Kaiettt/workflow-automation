// Shared fixtures for the StartExecutionHandler specs: in-memory repository,
// catalog with the real node schemas, node builders and a handler factory.
import {
  StartExecutionCommand,
  StartExecutionHandler,
} from './start-execution.command';
import { ExecutionRepository } from '../../../domain/repositories/execution.repository';
import {
  NodeLogRecord,
  ResolvedCredential,
  WorkflowVersionForExecution,
} from '../../../domain/models/execution.types';
import {
  ExecutionStatus,
  NodeKeys,
} from '../../../domain/constants/execution.constants';
import { Item } from '../../../domain/models/item';
import { NodeCatalogPort } from '../../ports/node-catalog.port';
import {
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmProvider,
} from '../../ports/llm-provider.port';
import { LlmProviderRegistry } from '../../services/llm-provider.registry';
import { ManualTriggerExecutor } from '../../executors/manual-trigger-executor';
import { GoogleSheetReadRowsExecutor } from '../../executors/google-sheet-read-rows-executor';
import { FilterExecutor } from '../../executors/filter-executor';
import { GmailSendExecutor } from '../../executors/gmail-send-executor';
import { AggregateExecutor } from '../../executors/aggregate-executor';
import { LlmGenerateExecutor } from '../../executors/llm-generate-executor';
import {
  AGGREGATE_CONFIG_SCHEMA,
  FILTER_CONFIG_SCHEMA,
  GMAIL_SEND_CONFIG_SCHEMA,
  GOOGLE_SHEET_READ_ROWS_CONFIG_SCHEMA,
  LLM_GENERATE_CONFIG_SCHEMA,
  MANUAL_TRIGGER_CONFIG_SCHEMA,
} from '../../../../../../prisma/mvp-node-schemas';

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

  findVersion(): Promise<WorkflowVersionForExecution | null> {
    return Promise.resolve(this.version);
  }

  createExecution(): Promise<string> {
    return Promise.resolve('execution-1');
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

  finishExecution(_id: string, status: ExecutionStatus): Promise<void> {
    this.finishedStatus = status;
    return Promise.resolve();
  }

  findExecutionResult(): Promise<unknown> {
    return Promise.resolve({
      id: 'execution-1',
      status: this.finishedStatus,
      nodeLogs: this.logs,
    });
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

  const handler = new StartExecutionHandler(
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

  const run = async () =>
    (await handler.execute(
      new StartExecutionCommand('version-1', 'actor-1'),
    )) as {
      nodeLogs: NodeLogRecord[];
      status: ExecutionStatus;
    };
  return { run, send, llm };
}

export const logOf = (nodeLogs: NodeLogRecord[], key: string) =>
  nodeLogs.find((log) => log.nodeKey === key);

export const jsonOf = (value: unknown) =>
  (value as Item[]).map((item) => item.json);

export const decode = (send: jest.Mock, call: number): string => {
  const calls = send.mock.calls as Array<[{ requestBody: { raw: string } }]>;
  return Buffer.from(calls[call][0].requestBody.raw, 'base64url').toString();
};
