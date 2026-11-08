import { describe, expect, it } from 'vitest';
import {
  applyExecutionStreamEvent,
  mergeExecutionSnapshot,
} from './execution-cache.util';
import type { ExecutionResult } from '../types/execution.types';

const runningExecution: ExecutionResult = {
  id: 'execution-1',
  workflowId: 'workflow-1',
  workflowVersionId: 'version-1',
  status: 'RUNNING',
  startedAt: '2026-11-08T10:00:00.000Z',
  nodeLogs: [{
    nodeId: 'node-1',
    nodeKey: 'trigger.manual',
    status: 'SUCCESS',
    input: null,
    output: null,
    startedAt: '2026-11-08T10:00:00.000Z',
    finishedAt: '2026-11-08T10:00:01.000Z',
  }],
};

describe('execution cache merging', () => {
  it('does not let an older snapshot regress execution or node state', () => {
    const merged = mergeExecutionSnapshot(runningExecution, {
      ...runningExecution,
      status: 'QUEUED',
      startedAt: null,
      nodeLogs: [{
        nodeId: 'node-1',
        nodeKey: 'trigger.manual',
        status: 'RUNNING',
        input: null,
        output: null,
        startedAt: '2026-11-08T10:00:00.000Z',
        finishedAt: null,
      }],
    });

    expect(merged.status).toBe('RUNNING');
    expect(merged.nodeLogs?.[0].status).toBe('SUCCESS');
  });

  it('preserves a terminal execution when an older running snapshot arrives', () => {
    const terminal = { ...runningExecution, status: 'FAILED' };
    const merged = mergeExecutionSnapshot(terminal, runningExecution);

    expect(merged.status).toBe('FAILED');
  });

  it('keeps already-loaded node details when a lifecycle event omits them', () => {
    const executionWithOutput: ExecutionResult = {
      ...runningExecution,
      nodeLogs: [{
        ...runningExecution.nodeLogs![0],
        output: [{ json: { ok: true } }],
      }],
    };
    const merged = applyExecutionStreamEvent(executionWithOutput, {
      event: 'node.completed',
      executionId: 'execution-1',
      nodeId: 'node-1',
      nodeKey: 'trigger.manual',
      status: 'SUCCESS',
      ts: '2026-11-08T10:00:01.000Z',
    });

    expect(merged?.nodeLogs?.[0]).toMatchObject({
      status: 'SUCCESS',
      output: [{ json: { ok: true } }],
    });
  });

  it('applies lifecycle events without requiring private node payload data', () => {
    const merged = applyExecutionStreamEvent(runningExecution, {
      event: 'node.started',
      executionId: 'execution-1',
      nodeId: 'node-2',
      nodeKey: 'logic.filter',
      status: 'RUNNING',
      ts: '2026-11-08T10:00:02.000Z',
    });

    expect(merged?.nodeLogs?.find((log) => log.nodeId === 'node-2')).toMatchObject({
      status: 'RUNNING',
      input: null,
      output: null,
    });
  });
});