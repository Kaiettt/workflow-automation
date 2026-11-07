import type { NodeLogRecord } from '../types/execution.types';

export type ExecutionNodeViewStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped';

export interface ExecutionNodeViewState {
  status: ExecutionNodeViewStatus;
  outputSummary?: string;
  errorMessage?: string;
  durationMs?: number;
}

export function mapExecutionNodeStates(
  nodeIds: readonly string[],
  nodeLogs: readonly NodeLogRecord[],
): Map<string, ExecutionNodeViewState> {
  const states = new Map<string, ExecutionNodeViewState>();
  for (const nodeId of nodeIds) {
    states.set(nodeId, { status: 'idle' });
  }

  for (const log of nodeLogs) {
    if (!states.has(log.nodeId)) continue;

    const status: ExecutionNodeViewStatus =
      log.status === 'RUNNING'
        ? 'running'
        : log.status === 'SUCCESS'
          ? 'success'
          : log.status === 'SKIPPED'
            ? 'skipped'
            : 'failed';
    const state: ExecutionNodeViewState = { status };

    if (status === 'success') {
      state.outputSummary = `Completed (${log.durationMs ?? 0}ms)`;
    }
    if (status === 'failed' && log.errorMessage) {
      state.errorMessage = log.errorMessage;
    }
    if (log.durationMs != null) state.durationMs = log.durationMs;
    states.set(log.nodeId, state);
  }

  return states;
}