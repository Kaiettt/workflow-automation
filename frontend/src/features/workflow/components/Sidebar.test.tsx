/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { useDesignerStore } from '../store/designer.store';

// Mock useConnectors hook
vi.mock('../hooks/useCredentials', () => ({
  useConnectors: vi.fn(),
  useConnector: vi.fn(),
}));

import { useConnectors } from '../hooks/useCredentials';

describe('Sidebar', () => {
  it('renders disabled badge when node belongs to a connector with allowNewCredentials = false', () => {
    // Mock store with two nodes: one Google Sheets (connectorId = 'google-id') and one Filter (no connector)
    useDesignerStore.setState({
      nodeTypes: [
        {
          id: 'node-1',
          key: 'integration.google_sheet.readRows',
          displayName: 'Read Google Sheet Rows',
          icon: 'sheet',
          color: '#34A853',
          category: 'INTEGRATION',
          description: 'Read rows from sheet',
          configSchema: {
            type: 'object',
            properties: {
              credential_id: { type: 'string', 'x-connectorKey': 'google' },
            },
          },
          inputSchema: null,
          outputSchema: null,
          connectorId: 'google-id',
          isActive: true,
        },
        {
          id: 'node-2',
          key: 'logic.filter',
          displayName: 'Filter',
          icon: 'filter',
          color: '#8B5CF6',
          category: 'LOGIC',
          description: 'Filter items',
          configSchema: { type: 'object', properties: {} },
          inputSchema: null,
          outputSchema: null,
          connectorId: null,
          isActive: true,
        },
      ],
    });

    // Mock connectors: Google is disabled
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

    render(<Sidebar />);

    expect(screen.getByText('Read Google Sheet Rows')).toBeTruthy();
    expect(screen.getByText('Filter')).toBeTruthy();

    // The Google node should show the disabled badge / info
    const disabledBadge = screen.getByText('Disabled');
    expect(disabledBadge).toBeTruthy();
    expect(disabledBadge.closest('[title]')?.getAttribute('title')).toContain(
      'New credentials disabled by platform administrator',
    );
  });

  it('does not render disabled badge when allowNewCredentials is true', () => {
    useDesignerStore.setState({
      nodeTypes: [
        {
          id: 'node-1',
          key: 'integration.google_sheet.readRows',
          displayName: 'Read Google Sheet Rows',
          icon: 'sheet',
          color: '#34A853',
          category: 'INTEGRATION',
          description: 'Read rows from sheet',
          configSchema: {
            type: 'object',
            properties: {
              credential_id: { type: 'string', 'x-connectorKey': 'google' },
            },
          },
          inputSchema: null,
          outputSchema: null,
          connectorId: 'google-id',
          isActive: true,
        },
      ],
    });

    vi.mocked(useConnectors).mockReturnValue({
      data: [
        {
          id: 'google-id',
          key: 'google',
          name: 'Google',
          authType: 'OAUTH2',
          allowNewCredentials: true,
        },
      ],
    } as any);

    render(<Sidebar />);

    expect(screen.queryByText('Disabled')).toBeNull();
  });
});
