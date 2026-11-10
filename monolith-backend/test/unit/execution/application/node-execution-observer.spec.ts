/* eslint-disable @typescript-eslint/unbound-method */
import {
  ItemRunError,
  NodeExecutionObserver,
  sanitizeErrorText,
} from '@app/execution/application/services/node-execution-observer';
import { ExecutionStatus } from '@app/execution/domain/constants/execution.constants';
import { ExecutionRepository } from '@app/execution/domain/repositories/execution.repository';
import { ExecutionEventPublisher } from '@app/execution/application/ports/execution-event-publisher.port';
import { NodeRunParams } from '@app/execution/application/services/node-runner';

describe('NodeExecutionObserver', () => {
  let repository: jest.Mocked<ExecutionRepository>;
  let publisher: jest.Mocked<ExecutionEventPublisher>;
  let observer: NodeExecutionObserver;

  const mockNode = {
    id: 'node-1',
    data: { key: 'test.node', name: 'Test Node' },
  };

  const mockParams: NodeRunParams = {
    node: mockNode,
    workflowId: 'wf-1',
    workflowVersionId: 'v-1',
    executionId: 'exec-1',
    items: [{ json: { foo: 'bar' } }],
    runs: [],
    names: new Map([['Test Node', 'node-1']]),
    configSchema: {},
    credentialOwnerId: 'user-1',
  };

  beforeEach(() => {
    repository = {
      saveNodeLog: jest.fn().mockResolvedValue(undefined),
      resolveCredential: jest.fn(),
      createExecution: jest.fn(),
      findExecution: jest.fn(),
      findVersion: jest.fn(),
      finishExecution: jest.fn(),
      failStaleExecutions: jest.fn(),
    } as unknown as jest.Mocked<ExecutionRepository>;

    publisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };

    observer = new NodeExecutionObserver(repository, publisher);
  });

  describe('notifyStarted', () => {
    it('saves a RUNNING node log and publishes node.started event', async () => {
      const startedAt = new Date('2026-01-01T10:00:00Z');
      await observer.notifyStarted(mockParams, startedAt);

      expect(repository.saveNodeLog).toHaveBeenCalledWith('exec-1', {
        nodeId: 'node-1',
        nodeKey: 'test.node',
        status: ExecutionStatus.RUNNING,
        input: [{ json: { foo: 'bar' } }],
        output: null,
        startedAt,
        finishedAt: null,
      });

      expect(publisher.publish).toHaveBeenCalledWith({
        event: 'node.started',
        executionId: 'exec-1',
        workflowId: 'wf-1',
        nodeId: 'node-1',
        nodeKey: 'test.node',
        status: ExecutionStatus.RUNNING,
        startedAt: startedAt.toISOString(),
        finishedAt: null,
        ts: startedAt.toISOString(),
      });
    });
  });

  describe('notifyCompleted', () => {
    it('saves SUCCESS node log and publishes node.completed event with duration', async () => {
      const startedAt = new Date('2026-01-01T10:00:00Z');
      const finishedAt = new Date('2026-01-01T10:00:05Z');
      const outputs = new Map([['main', [{ json: { result: 42 } }]]]);

      const result = await observer.notifyCompleted(
        mockParams,
        outputs,
        startedAt,
        finishedAt,
      );

      expect(result.status).toBe(ExecutionStatus.SUCCESS);
      expect(result.output).toEqual([{ json: { result: 42 } }]);

      expect(repository.saveNodeLog).toHaveBeenCalledWith('exec-1', {
        nodeId: 'node-1',
        nodeKey: 'test.node',
        status: ExecutionStatus.SUCCESS,
        input: [{ json: { foo: 'bar' } }],
        output: [{ json: { result: 42 } }],
        startedAt,
        finishedAt,
      });

      expect(publisher.publish).toHaveBeenCalledWith({
        event: 'node.completed',
        executionId: 'exec-1',
        workflowId: 'wf-1',
        workflowVersionId: 'v-1',
        nodeId: 'node-1',
        nodeKey: 'test.node',
        status: ExecutionStatus.SUCCESS,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: 5000,
        ts: finishedAt.toISOString(),
      });
    });
  });

  describe('notifyFailed', () => {
    it('sanitizes error message, saves FAILED log, and publishes node.failed event', async () => {
      const startedAt = new Date('2026-01-01T10:00:00Z');
      const finishedAt = new Date('2026-01-01T10:00:02Z');
      const error = new Error('Auth failed for Bearer eyJhbGciOiJIUzI1NiJ9');

      const result = await observer.notifyFailed(
        mockParams,
        error,
        startedAt,
        finishedAt,
      );

      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.log.errorMessage).not.toContain('Bearer');
      expect(result.log.errorMessage).toContain('[REDACTED]');

      expect(repository.saveNodeLog).toHaveBeenCalledWith(
        'exec-1',
        expect.objectContaining({
          nodeId: 'node-1',
          nodeKey: 'test.node',
          status: ExecutionStatus.FAILED,
          input: [{ json: { foo: 'bar' } }],
          output: null,
          startedAt,
          finishedAt,
        }),
      );

      expect(publisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'node.failed',
          status: ExecutionStatus.FAILED,
          durationMs: 2000,
        }),
      );
    });

    it('attaches item error summary if error is ItemRunError', async () => {
      const startedAt = new Date('2026-01-01T10:00:00Z');
      const finishedAt = new Date('2026-01-01T10:00:01Z');
      const error = new ItemRunError('Item failed', {
        total_items: 10,
        processed: 3,
        failed_at_index: 3,
      });

      const result = await observer.notifyFailed(
        mockParams,
        error,
        startedAt,
        finishedAt,
      );

      expect(result.log.output).toEqual({
        total_items: 10,
        processed: 3,
        failed_at_index: 3,
      });
    });
  });

  describe('notifySkipped', () => {
    it('saves a SKIPPED log and publishes node.skipped event', async () => {
      const now = new Date('2026-01-01T10:00:00Z');
      await observer.notifySkipped({
        executionId: 'exec-1',
        workflowId: 'wf-1',
        workflowVersionId: 'v-1',
        nodeId: 'node-2',
        nodeKey: 'filter.node',
        timestamp: now,
      });

      expect(repository.saveNodeLog).toHaveBeenCalledWith('exec-1', {
        nodeId: 'node-2',
        nodeKey: 'filter.node',
        status: 'SKIPPED',
        input: [],
        output: null,
        startedAt: now,
        finishedAt: now,
      });

      expect(publisher.publish).toHaveBeenCalledWith({
        event: 'node.skipped',
        executionId: 'exec-1',
        workflowId: 'wf-1',
        workflowVersionId: 'v-1',
        nodeId: 'node-2',
        nodeKey: 'filter.node',
        status: 'SKIPPED',
        startedAt: now.toISOString(),
        finishedAt: now.toISOString(),
        ts: now.toISOString(),
      });
    });
  });

  describe('sanitizeErrorText', () => {
    it('redacts sensitive API keys and tokens', () => {
      expect(
        sanitizeErrorText('Error: sk-ant-api03-1234567890abcdef123456'),
      ).toContain('[REDACTED]');
      expect(sanitizeErrorText('AIzaSyD-1234567890abcdefghijklmn')).toContain(
        '[REDACTED]',
      );
      expect(
        sanitizeErrorText('Authorization: Bearer secret-token-value'),
      ).toContain('[REDACTED]');
    });
  });
});
