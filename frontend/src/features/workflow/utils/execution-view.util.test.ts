import { describe, expect, it } from 'vitest';
import { mapExecutionNodeStates } from './execution-view.util';

describe('mapExecutionNodeStates', () => {
  it('maps persisted node logs and leaves unstarted nodes pending', () => {
    const states = mapExecutionNodeStates(
      ['pending', 'running', 'success', 'failed', 'skipped'],
      [
        { nodeId: 'running', status: 'RUNNING' },
        { nodeId: 'success', status: 'SUCCESS', durationMs: 42 },
        { nodeId: 'failed', status: 'FAILED', errorMessage: 'Request failed' },
        { nodeId: 'skipped', status: 'SKIPPED' },
      ],
    );

    expect(states.get('pending')).toEqual({ status: 'idle' });
    expect(states.get('running')).toEqual({ status: 'running' });
    expect(states.get('success')).toEqual({
      status: 'success',
      outputSummary: 'Completed (42ms)',
      durationMs: 42,
    });
    expect(states.get('failed')).toEqual({
      status: 'failed',
      errorMessage: 'Request failed',
    });
    expect(states.get('skipped')).toEqual({ status: 'skipped' });
  });
});