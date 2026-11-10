import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ExecutionNodeLogTable } from './ExecutionNodeLogTable';
import type { NodeLogRecord } from '../../types/execution.types';

describe('ExecutionNodeLogTable', () => {
  afterEach(cleanup);

  const mockLogs: NodeLogRecord[] = [
    {
      id: 'log-1',
      nodeId: 'webhook-node',
      nodeKey: 'trigger.webhook',
      status: 'SUCCESS',
      startedAt: '2026-11-10T08:00:00.000Z',
      durationMs: 42,
      input: { body: { amount: 100 } },
      output: { ok: true },
      errorMessage: null,
    },
    {
      id: 'log-2',
      nodeId: 'filter-node',
      nodeKey: 'logic.filter',
      status: 'FAILED',
      startedAt: '2026-11-10T08:00:01.000Z',
      durationMs: 15,
      input: { amount: 100 },
      output: null,
      errorMessage: 'Field "amount" evaluation failed',
    },
  ];

  it('renders table headers and node logs', () => {
    render(<ExecutionNodeLogTable nodeLogs={mockLogs} />);

    expect(screen.getByText('Nhật ký thực thi từng bước (Node Logs)')).toBeTruthy();
    expect(screen.getByText('webhook-node')).toBeTruthy();
    expect(screen.getByText('filter-node')).toBeTruthy();
    expect(screen.getByText('trigger.webhook')).toBeTruthy();
    expect(screen.getByText('SUCCESS (42ms)')).toBeTruthy();
    expect(screen.getByText('FAILED')).toBeTruthy();
  });

  it('toggles expansion to show input, output, and error message', () => {
    render(<ExecutionNodeLogTable nodeLogs={mockLogs} />);

    // Initially accordion details are not expanded
    expect(screen.queryByText('Field "amount" evaluation failed')).toBeNull();

    // Click to expand filter-node
    fireEvent.click(screen.getByTestId('node-log-row-filter-node'));

    // Now error and payload view should be visible
    expect(screen.getByText('Field "amount" evaluation failed')).toBeTruthy();
    expect(screen.getByText('Input Data')).toBeTruthy();
    expect(screen.getByText('Output Data')).toBeTruthy();
  });

  it('displays empty state message when no node logs exist', () => {
    render(<ExecutionNodeLogTable nodeLogs={[]} />);
    expect(screen.getByText('Không có nhật ký node nào được ghi nhận.')).toBeTruthy();
  });
});

