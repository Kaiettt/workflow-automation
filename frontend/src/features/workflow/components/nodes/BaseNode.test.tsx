/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDesignerStore } from '../../store/designer.store';
import { BaseNode } from './BaseNode';

const updateNodeInternals = vi.fn();

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  useUpdateNodeInternals: () => updateNodeInternals,
  Handle: ({ id, children }: { id?: string; children?: React.ReactNode }) => (
    <div data-testid={id}>{children}</div>
  ),
}));

vi.mock('../../hooks/useCredentials', () => ({
  useConnectors: vi.fn(() => ({ data: [] })),
}));

import { useConnectors } from '../../hooks/useCredentials';

const switchType = {
  key: 'logic.switch',
  displayName: 'Switch',
  category: 'LOGIC',
  configSchema: {
    type: 'object',
    'x-outputs': { fromConfig: 'rules', labelField: 'label', fallback: true },
  },
};

const rule = (id: string, label: string) => ({ id, label });

function node(rules: unknown[]) {
  return <BaseNode id="switch-1" data={{ name: 'Route', key: 'logic.switch', config: { rules } }} />;
}

describe('BaseNode named outputs', () => {
  beforeEach(() => {
    updateNodeInternals.mockClear();
    useDesignerStore.setState({ nodeTypes: [switchType] } as never);
  });

  it('draws one handle per rule plus the fallback', () => {
    render(node([rule('a', 'Click'), rule('b', 'Menu')]));
    expect(screen.getByTestId('out:rule_a').textContent).toBe('Click');
    expect(screen.getByTestId('out:rule_b').textContent).toBe('Menu');
    expect(screen.getByTestId('out:fallback')).toBeTruthy();
  });

  it('tells React Flow when a rule is added, so its handle can be dragged from', () => {
    const { rerender } = render(node([rule('a', 'Click')]));
    updateNodeInternals.mockClear();

    rerender(node([rule('a', 'Click'), rule('b', 'Menu')]));

    expect(updateNodeInternals).toHaveBeenCalledWith('switch-1');
  });

  it('does not refresh the node when nothing about its outputs changed', () => {
    const { rerender } = render(node([rule('a', 'Click')]));
    updateNodeInternals.mockClear();

    rerender(node([rule('a', 'Click')]));

    expect(updateNodeInternals).not.toHaveBeenCalled();
  });

  it('renders disabled badge when node belongs to a connector with allowNewCredentials = false', () => {
    useDesignerStore.setState({
      nodeTypes: [
        {
          key: 'integration.google_sheet.readRows',
          displayName: 'Read Google Sheet Rows',
          category: 'INTEGRATION',
          connectorId: 'google-id',
          configSchema: { type: 'object', properties: {} },
        },
      ],
    } as never);

    vi.mocked(useConnectors).mockReturnValue({
      data: [
        {
          id: 'google-id',
          key: 'google',
          name: 'Google',
          authType: 'OAUTH2',
          allowNewCredentials: false,
        },
      ],
    } as any);

    render(
      <BaseNode
        id="node-google"
        data={{ name: 'Read Google Sheet Rows', key: 'integration.google_sheet.readRows' }}
      />,
    );

    const badge = screen.getByText('Disabled');
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('title')).toContain(
      'New credentials disabled by platform administrator',
    );
  });
});
