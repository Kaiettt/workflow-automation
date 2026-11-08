import type { ExecutionStreamEvent } from '../services/execution.service';
import type {
  ExecutionResult,
  NodeLogRecord,
} from '../types/execution.types';
import { isTerminalExecutionState } from './execution-status.util';

const EXECUTION_STATUS_RANK: Record<string, number> = {
  QUEUED: 0,
  RUNNING: 1,
  SUCCESS: 2,
  FAILED: 2,
  CANCELLED: 2,
};

const NODE_STATUS_RANK: Record<string, number> = {
  RUNNING: 1,
  SUCCESS: 2,
  FAILED: 2,
  SKIPPED: 2,
  TIMEOUT: 2,
};

export function mergeExecutionSnapshot(
  current: ExecutionResult | undefined,
  incoming: ExecutionResult,
): ExecutionResult {
  if (!current) return incoming;

  const currentTerminal = isTerminalExecutionState('', current.status);
  const incomingTerminal = isTerminalExecutionState('', incoming.status);
  const incomingIsOlder =
    (EXECUTION_STATUS_RANK[incoming.status] ?? 0) <
    (EXECUTION_STATUS_RANK[current.status] ?? 0);
  const preserveCurrentState =
    incomingIsOlder ||
    (currentTerminal && (!incomingTerminal || incoming.status !== current.status));

  return {
    ...current,
    ...incoming,
    status: preserveCurrentState ? current.status : incoming.status,
    startedAt: preserveCurrentState
      ? current.startedAt
      : (incoming.startedAt ?? current.startedAt),
    finishedAt: preserveCurrentState
      ? current.finishedAt
      : (incoming.finishedAt ?? current.finishedAt),
    durationMs: preserveCurrentState
      ? current.durationMs
      : (incoming.durationMs ?? current.durationMs),
    nodeLogs: mergeNodeLogs(current.nodeLogs ?? [], incoming.nodeLogs ?? []),
  };
}

export function applyExecutionStreamEvent(
  current: ExecutionResult | undefined,
  event: ExecutionStreamEvent,
): ExecutionResult | undefined {
  if (event.event === 'execution.snapshot') {
    const snapshot = event.payload;
    if (
      !snapshot ||
      typeof snapshot !== 'object' ||
      !('status' in snapshot) ||
      !('id' in snapshot)
    ) {
      return current;
    }
    return mergeExecutionSnapshot(current, snapshot as ExecutionResult);
  }
  if (!current) return current;

  if (event.event.startsWith('execution.')) {
    const status =
      typeof event.status === 'string'
        ? event.status
        : event.event === 'execution.started'
          ? 'RUNNING'
          : event.event === 'execution.completed'
            ? 'SUCCESS'
            : event.event === 'execution.failed'
              ? 'FAILED'
              : event.event === 'execution.cancelled'
                ? 'CANCELLED'
                : current.status;
    return mergeExecutionSnapshot(current, {
      ...current,
      status,
      startedAt:
        typeof event.startedAt === 'string'
          ? event.startedAt
          : current.startedAt,
      finishedAt:
        typeof event.finishedAt === 'string'
          ? event.finishedAt
          : current.finishedAt,
      durationMs:
        typeof event.durationMs === 'number'
          ? event.durationMs
          : current.durationMs,
    });
  }

  if (
    event.event === 'node.started' ||
    event.event === 'node.completed' ||
    event.event === 'node.failed' ||
    event.event === 'node.skipped'
  ) {
    if (typeof event.nodeId !== 'string') return current;
    const eventLog: NodeLogRecord = {
      nodeId: event.nodeId,
      nodeKey: typeof event.nodeKey === 'string' ? event.nodeKey : 'unknown',
      status:
        typeof event.status === 'string'
          ? event.status
          : event.event === 'node.started'
            ? 'RUNNING'
            : 'SUCCESS',
      input: null,
      output: null,
      errorMessage:
        typeof event.errorMessage === 'string' ? event.errorMessage : null,
      startedAt:
        typeof event.startedAt === 'string'
          ? event.startedAt
          : new Date().toISOString(),
      finishedAt:
        typeof event.finishedAt === 'string' ? event.finishedAt : null,
      durationMs:
        typeof event.durationMs === 'number' ? event.durationMs : null,
    };
    return {
      ...current,
      nodeLogs: mergeNodeLogs(current.nodeLogs ?? [], [eventLog]),
    };
  }

  return current;
}

function mergeNodeLogs(
  currentLogs: NodeLogRecord[],
  incomingLogs: NodeLogRecord[],
): NodeLogRecord[] {
  const merged = new Map(currentLogs.map((log) => [log.nodeId, log]));
  for (const incoming of incomingLogs) {
    const current = merged.get(incoming.nodeId);
    if (
      current &&
      (NODE_STATUS_RANK[current.status] ?? 0) >
        (NODE_STATUS_RANK[incoming.status] ?? 0)
    ) {
      continue;
    }
    merged.set(incoming.nodeId, {
      ...current,
      ...incoming,
      input: incoming.input ?? current?.input ?? null,
      output: incoming.output ?? current?.output ?? null,
      errorMessage: incoming.errorMessage ?? current?.errorMessage ?? null,
    });
  }
  return [...merged.values()];
}