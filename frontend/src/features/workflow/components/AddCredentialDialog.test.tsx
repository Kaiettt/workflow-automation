import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCredentialApi = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  listConnectors: vi.fn(),
}));
vi.mock('../api/credential.api', () => ({ credentialApi: mockCredentialApi }));

import { AddCredentialDialog } from './AddCredentialDialog';

const messenger = {
  id: 'c-messenger',
  key: 'messenger',
  name: 'Facebook Messenger',
  authType: 'API_KEY',
  configSchema: {
    required: ['page_id', 'page_access_token'],
    'x-propertyOrder': ['page_id', 'page_access_token'],
    properties: {
      page_access_token: { type: 'string', title: 'Page Access Token', 'x-secret': true },
      page_id: { type: 'string', title: 'Page ID' },
    },
  },
};

const renderDialog = (connectorKey: string, onSaved = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AddCredentialDialog
        connectorKey={connectorKey}
        open
        onOpenChange={() => undefined}
        onSaved={onSaved}
      />
    </QueryClientProvider>,
  );
  return onSaved;
};

describe('AddCredentialDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCredentialApi.listConnectors.mockResolvedValue([messenger]);
  });
  afterEach(cleanup);

  it('asks for the fields of the connector and saves them as the secret', async () => {
    mockCredentialApi.create.mockResolvedValue({
      id: 'cred-1',
      connectorKey: 'messenger',
      name: 'Shop',
      createdAt: '',
    });
    const onSaved = renderDialog('messenger');

    expect(await screen.findByText('Connect Facebook Messenger')).toBeTruthy();
    const token = screen.getByLabelText('Page Access Token') as HTMLInputElement;
    expect(token.type).toBe('password');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Shop ' } });
    fireEvent.change(screen.getByLabelText('Page ID'), { target: { value: '112233' } });
    fireEvent.change(token, { target: { value: 'EAAsecret ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('cred-1'));
    expect(mockCredentialApi.create).toHaveBeenCalledWith('messenger', {
      name: 'Shop',
      secret: { page_id: '112233', page_access_token: 'EAAsecret' },
    });
  });

  it('falls back to a single API key for connectors without fields', async () => {
    mockCredentialApi.listConnectors.mockResolvedValue([
      { ...messenger, key: 'openai', name: 'OpenAI', configSchema: {} },
    ]);
    renderDialog('openai');

    expect(await screen.findByText('Connect OpenAI')).toBeTruthy();
    expect((screen.getByLabelText('API key') as HTMLInputElement).type).toBe('password');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
