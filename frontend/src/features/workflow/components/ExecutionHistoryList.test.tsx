import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExecutionHistoryList } from './ExecutionHistoryList';

describe('ExecutionHistoryList', () => {
  it('selects the requested execution without changing the others', () => {
    const onSelect = vi.fn();
    render(
      <ExecutionHistoryList
        executions={[
          {
            id: 'execution-1',
            workflowId: 'workflow-1',
            workflowVersionId: 'version-1',
            status: 'FAILED',
            queuedAt: '2026-11-07T10:00:00.000Z',
            startedAt: '2026-11-07T10:00:01.000Z',
          },
          {
            id: 'execution-2',
            workflowId: 'workflow-1',
            workflowVersionId: 'version-1',
            status: 'RUNNING',
            queuedAt: '2026-11-07T10:02:00.000Z',
            startedAt: '2026-11-07T10:02:01.000Z',
          },
        ]}
        selectedId="execution-1"
        onSelect={onSelect}
      />,
    );

    const selected = screen.getByRole('button', {
      name: 'Execution execution-1, FAILED',
    });
    const other = screen.getByRole('button', {
      name: 'Execution execution-2, RUNNING',
    });
    expect(selected.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(other);

    expect(onSelect).toHaveBeenCalledWith('execution-2');
    expect(selected.getAttribute('aria-pressed')).toBe('true');
  });
});