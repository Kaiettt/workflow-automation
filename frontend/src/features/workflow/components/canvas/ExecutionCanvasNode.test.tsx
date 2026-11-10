import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExecutionCanvasNode } from './ExecutionCanvasNode';
import type { NodeProps, Node } from '@xyflow/react';
import type { ExecutionCanvasNodeData } from './ExecutionCanvasNode';

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  Handle: ({ type, position }: { type?: string; position?: string }) => (
    <div data-testid={`handle-${type}-${position}`} />
  ),
}));

describe('ExecutionCanvasNode', () => {
  afterEach(cleanup);
  const createProps = (
    dataOverrides: Partial<ExecutionCanvasNodeData> = {},
  ): NodeProps<Node<ExecutionCanvasNodeData>> =>
    ({
      id: 'test-node-1',
      data: {
        label: 'Webhook Trigger',
        category: 'Trigger',
        iconType: 'webhook',
        detail: 'POST /v1/orders',
        status: 'idle',
        hasTarget: false,
        hasSource: true,
        ...dataOverrides,
      },
      selected: false,
      type: 'executionCanvasNode',
      zIndex: 0,
      isConnectable: false,
      xPos: 0,
      yPos: 0,
      dragging: false,
    }) as unknown as NodeProps<Node<ExecutionCanvasNodeData>>;

  it('renders node details and label correctly', () => {
    render(<ExecutionCanvasNode {...createProps()} />);

    expect(screen.getByText('Webhook Trigger')).toBeTruthy();
    expect(screen.getByText('Trigger')).toBeTruthy();
    expect(screen.getByText('POST /v1/orders')).toBeTruthy();
    expect(screen.getByTestId('handle-source-right')).toBeTruthy();
    expect(screen.queryByTestId('handle-target-left')).toBeNull();
  });

  it('renders target handle when hasTarget is true', () => {
    render(
      <ExecutionCanvasNode
        {...createProps({
          hasTarget: true,
          hasSource: true,
          iconType: 'filter',
          category: 'Logic',
        })}
      />,
    );

    expect(screen.getByTestId('handle-target-left')).toBeTruthy();
    expect(screen.getByTestId('handle-source-right')).toBeTruthy();
  });

  it('renders running spinner when status is running', () => {
    render(<ExecutionCanvasNode {...createProps({ status: 'running' })} />);
    expect(screen.getByLabelText('Running')).toBeTruthy();
  });

  it('renders success icon and output summary when status is success', () => {
    render(
      <ExecutionCanvasNode
        {...createProps({
          status: 'success',
          outputSummary: 'Processed 15 items',
        })}
      />,
    );
    expect(screen.getByLabelText('Success')).toBeTruthy();
    expect(screen.getByText('Processed 15 items')).toBeTruthy();
  });

  it('renders error icon and error message when status is failed', () => {
    render(
      <ExecutionCanvasNode
        {...createProps({
          status: 'failed',
          errorMessage: 'Connection timeout',
        })}
      />,
    );
    expect(screen.getByLabelText('Failed')).toBeTruthy();
    expect(screen.getByText('Connection timeout')).toBeTruthy();
  });

  it('renders skipped label when status is skipped', () => {
    render(<ExecutionCanvasNode {...createProps({ status: 'skipped' })} />);
    expect(screen.getByText('Skipped')).toBeTruthy();
  });
});
