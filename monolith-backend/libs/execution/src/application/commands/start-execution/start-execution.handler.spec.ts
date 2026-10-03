import { StartExecutionHandler } from './start-execution.handler';
import { StartExecutionCommand } from './start-execution.command';
import { ExecutionRepository } from '../../../domain/repositories/execution.repository';
import {
  NodeLogRecord,
  WorkflowVersionForExecution,
} from '../../../domain/models/execution.types';
import {
  ExecutionStatus,
  NodeKeys,
} from '../../../domain/constants/execution.constants';
import { ManualTriggerExecutor } from '../../executors/manual-trigger-executor';
import { GoogleSheetReadRowsExecutor } from '../../executors/google-sheet-read-rows-executor';
import { FilterExecutor } from '../../executors/filter-executor';
import { GmailSendExecutor } from '../../executors/gmail-send-executor';

class MemoryExecutionRepository extends ExecutionRepository {
  logs: NodeLogRecord[] = [];
  finishedStatus: ExecutionStatus | null = null;

  constructor(private readonly version: WorkflowVersionForExecution) {
    super();
  }

  findVersion(): Promise<WorkflowVersionForExecution | null> {
    return Promise.resolve(this.version);
  }

  createExecution(): Promise<string> {
    return Promise.resolve('execution-1');
  }

  resolveCredential(credentialId: string, ownerId: string): Promise<unknown> {
    if (credentialId === 'google-credential') {
      throw new Error('Invalid Google credential id');
    }
    if (
      credentialId === '33333333-3333-3333-3333-333333333331' &&
      ownerId === 'actor-1'
    ) {
      return Promise.resolve({ refresh_token: 'test-refresh-token', access_token: 'test-access-token' });
    }
    return Promise.resolve(null);
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

describe('StartExecutionHandler', () => {
  it('filters sheet rows to those whose status equals new', async () => {
    const mockSheetsClient = {
      spreadsheets: {
        values: {
          get: jest.fn().mockResolvedValue({
            data: {
              values: [
                ['name', 'email', 'status'],
                ['Kiet', 'kiet@gmail.com', 'new'],
                ['An', 'an@gmail.com', 'contacted'],
                ['Minh', 'minh@gmail.com', 'new'],
              ],
            },
          }),
        },
      },
    };

    const repository = new MemoryExecutionRepository({
      id: 'version-1',
      workflowId: 'workflow-1',
      workflowOwnerId: 'actor-1',
      definition: {
        nodes: [
          { id: 'trigger', data: { key: NodeKeys.TRIGGER_MANUAL, config: {} } },
          {
            id: 'sheet',
            data: {
              key: NodeKeys.GOOGLE_SHEET_READ_ROWS,
              config: {
                credential_id: '33333333-3333-3333-3333-333333333331',
                spreadsheet_id: 'sheet-1',
                sheet_name: 'Sheet1',
              },
            },
          },
          {
            id: 'filter',
            data: {
              key: NodeKeys.LOGIC_FILTER,
              config: { field: 'status', operator: 'equals', value: 'new' },
            },
          },
        ],
        edges: [
          { source: 'trigger', target: 'sheet' },
          { source: 'sheet', target: 'filter' },
        ],
      },
    });
    const handler = new StartExecutionHandler(repository, [
      new ManualTriggerExecutor(),
      new GoogleSheetReadRowsExecutor(() => mockSheetsClient),
      new FilterExecutor(),
      new GmailSendExecutor(() => ({
        users: {
          messages: {
            send: jest.fn().mockResolvedValue({}),
          },
        },
      })),
    ]);

    const result = (await handler.execute(
      new StartExecutionCommand('version-1', 'actor-1'),
    )) as {
      nodeLogs: NodeLogRecord[];
    };

    const triggerLog = result.nodeLogs.find(
      (log) => log.nodeKey === NodeKeys.TRIGGER_MANUAL,
    );
    expect(triggerLog?.input).toBeNull();
    expect(triggerLog?.output).toBeNull();

    const filterLog = result.nodeLogs.find(
      (log) => log.nodeKey === NodeKeys.LOGIC_FILTER,
    );
    expect(filterLog?.input).toEqual([
      { name: 'Kiet', email: 'kiet@gmail.com', status: 'new' },
      { name: 'An', email: 'an@gmail.com', status: 'contacted' },
      { name: 'Minh', email: 'minh@gmail.com', status: 'new' },
    ]);
    expect(filterLog?.output).toEqual([
      { name: 'Kiet', email: 'kiet@gmail.com', status: 'new' },
      { name: 'Minh', email: 'minh@gmail.com', status: 'new' },
    ]);
  });

  it('marks the node as failed when the configured credential id is the placeholder value', async () => {
    const repository = new MemoryExecutionRepository({
      id: 'version-1',
      workflowId: 'workflow-1',
      workflowOwnerId: 'actor-1',
      definition: {
        nodes: [
          { id: 'trigger', data: { key: NodeKeys.TRIGGER_MANUAL, config: {} } },
          {
            id: 'sheet',
            data: {
              key: NodeKeys.GOOGLE_SHEET_READ_ROWS,
              config: {
                credential_id: 'google-credential',
                spreadsheet_id: 'sheet-1',
                sheet_name: 'Sheet1',
              },
            },
          },
        ],
        edges: [{ source: 'trigger', target: 'sheet' }],
      },
    });
    const handler = new StartExecutionHandler(repository, [
      new ManualTriggerExecutor(),
      new GoogleSheetReadRowsExecutor(() => ({
        spreadsheets: {
          values: {
            get: jest.fn(),
          },
        },
      })),
    ]);

    const result = (await handler.execute(
      new StartExecutionCommand('version-1', 'actor-1'),
    )) as { nodeLogs: NodeLogRecord[]; status: ExecutionStatus };
    const sheetLog = result.nodeLogs.find(
      (log) => log.nodeKey === NodeKeys.GOOGLE_SHEET_READ_ROWS,
    );

    expect(sheetLog?.status).toBe(ExecutionStatus.FAILED);
    expect(result.status).toBe(ExecutionStatus.FAILED);
  });

  it('interpolates Gmail templates and records delivery counts', async () => {
    const sendMock = jest.fn().mockResolvedValue({});
    const repository = new MemoryExecutionRepository({
      id: 'version-1',
      workflowId: 'workflow-1',
      workflowOwnerId: 'actor-1',
      definition: {
        nodes: [
          { id: 'trigger', data: { key: NodeKeys.TRIGGER_MANUAL, config: {} } },
          {
            id: 'sheet',
            data: {
              key: NodeKeys.GOOGLE_SHEET_READ_ROWS,
              config: {
                credential_id: '33333333-3333-3333-3333-333333333331',
                spreadsheet_id: 'sheet-1',
                sheet_name: 'Sheet1',
              },
            },
          },
          {
            id: 'filter',
            data: {
              key: NodeKeys.LOGIC_FILTER,
              config: { field: 'status', operator: 'equals', value: 'new' },
            },
          },
          {
            id: 'gmail',
            data: {
              key: NodeKeys.GMAIL_SEND,
              config: {
                credential_id: '33333333-3333-3333-3333-333333333331',
                subject: 'Welcome, {{name}}!',
                body: 'Hello {{email}}',
              },
            },
          },
        ],
        edges: [
          { source: 'trigger', target: 'sheet' },
          { source: 'sheet', target: 'filter' },
          { source: 'filter', target: 'gmail' },
        ],
      },
    });
    const handler = new StartExecutionHandler(repository, [
      new ManualTriggerExecutor(),
      new GoogleSheetReadRowsExecutor(() => ({
        spreadsheets: {
          values: {
            get: jest.fn().mockResolvedValue({
              data: {
                values: [
                  ['name', 'email', 'status'],
                  ['Kiet', 'kiet@gmail.com', 'new'],
                  ['An', 'an@gmail.com', 'contacted'],
                  ['Minh', 'minh@gmail.com', 'new'],
                ],
              },
            }),
          },
        },
      })),
      new FilterExecutor(),
      new GmailSendExecutor(() => ({
        users: {
          messages: {
            send: sendMock,
          },
        },
      })),
    ]);

    const result = (await handler.execute(
      new StartExecutionCommand('version-1', 'actor-1'),
    )) as {
      nodeLogs: NodeLogRecord[];
      status: ExecutionStatus;
    };

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(
      result.nodeLogs.find((log) => log.nodeKey === NodeKeys.GMAIL_SEND)
        ?.output,
    ).toEqual({
      sent_count: 2,
      success_count: 2,
      failed_count: 0,
    });
    expect(result.status).toBe(ExecutionStatus.SUCCESS);
  });
});
