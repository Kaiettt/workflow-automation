import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCredentialApi = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  listConnectors: vi.fn(),
}));
vi.mock('../api/credential.api', () => ({ credentialApi: mockCredentialApi }));
const mockTriggerApi = vi.hoisted(() => ({ oauth2Url: vi.fn() }));
vi.mock('../api/trigger.api', () => ({ triggerApi: mockTriggerApi }));

import { AddCredentialDialog } from './AddCredentialDialog';

// A connector whose form has several fields.
const twilio = {
  id: 'c-twilio',
  key: 'twilio',
  name: 'Twilio',
  authType: 'API_KEY',
  configSchema: {
    required: ['account_sid', 'auth_token'],
    'x-propertyOrder': ['account_sid', 'auth_token'],
    properties: {
      auth_token: { type: 'string', title: 'Auth Token', 'x-secret': true },
      account_sid: { type: 'string', title: 'Account SID' },
    },
  },
};

// An OAuth2 credential type of an integration package.
const facebook = {
  id: 'c-fb',
  key: 'facebookMessengerOAuth2',
  name: 'Facebook Messenger account',
  authType: 'OAUTH2',
  configSchema: {
    required: ['client_id', 'client_secret'],
    'x-propertyOrder': ['client_id', 'client_secret'],
    'x-oauth2': true,
    properties: {
      client_id: { type: 'string', title: 'App ID' },
      client_secret: { type: 'string', title: 'App Secret', 'x-secret': true },
    },
  },
  oauth2: { redirectUrl: 'https://flow.example.com/api/oauth2/callback' },
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
    mockCredentialApi.listConnectors.mockResolvedValue([twilio, facebook]);
  });
  afterEach(cleanup);

  it('asks for the fields of the connector and saves them as the secret', async () => {
    mockCredentialApi.create.mockResolvedValue({
      id: 'cred-1',
      connectorKey: 'twilio',
      name: 'Shop',
      createdAt: '',
    });
    const onSaved = renderDialog('twilio');

    expect(await screen.findByText('Connect Twilio')).toBeTruthy();
    const token = screen.getByLabelText('Auth Token') as HTMLInputElement;
    expect(token.type).toBe('password');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Shop ' } });
    fireEvent.change(screen.getByLabelText('Account SID'), { target: { value: 'AC1' } });
    fireEvent.change(token, { target: { value: 'secret ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('cred-1'));
    expect(mockCredentialApi.create).toHaveBeenCalledWith('twilio', {
      name: 'Shop',
      secret: { account_sid: 'AC1', auth_token: 'secret' },
    });
  });

  it('falls back to a single API key for connectors without fields', async () => {
    mockCredentialApi.listConnectors.mockResolvedValue([
      { ...twilio, key: 'openai', name: 'OpenAI', configSchema: {} },
    ]);
    renderDialog('openai');

    expect(await screen.findByText('Connect OpenAI')).toBeTruthy();
    expect((screen.getByLabelText('API key') as HTMLInputElement).type).toBe('password');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('saves an OAuth2 app and connects it in a pop-up', async () => {
    mockCredentialApi.create.mockResolvedValue({
      id: 'cred-fb',
      connectorKey: 'facebookMessengerOAuth2',
      name: 'Shop app',
      createdAt: '',
    });
    mockTriggerApi.oauth2Url.mockResolvedValue('https://www.facebook.com/dialog/oauth?x=1');
    const popup = { location: { href: '' }, closed: false, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const onSaved = renderDialog('facebookMessengerOAuth2');

    expect(await screen.findByDisplayValue(facebook.oauth2.redirectUrl)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Shop app' } });
    fireEvent.change(screen.getByLabelText('App ID'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('App Secret'), { target: { value: 's3cret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & connect' }));

    await waitFor(() => expect(mockTriggerApi.oauth2Url).toHaveBeenCalledWith('cred-fb'));
    expect(mockCredentialApi.create).toHaveBeenCalledWith('facebookMessengerOAuth2', {
      name: 'Shop app',
      secret: { client_id: '123', client_secret: 's3cret' },
    });
    await waitFor(() => expect(popup.location.href).toBe('https://www.facebook.com/dialog/oauth?x=1'));
    expect(onSaved).not.toHaveBeenCalled();

    // The callback page reports back: the new credential is chosen.
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'oauth2-callback', status: 'success', credentialId: 'cred-fb' },
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('cred-fb'));
    open.mockRestore();
  });
});
