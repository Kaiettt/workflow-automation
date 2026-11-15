/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OAuthField } from './CredentialField';

vi.mock('../../hooks/useCredentials', () => ({
  useConnector: vi.fn(),
  useCredentials: vi.fn(() => ({ data: [] })),
}));

import { useConnector } from '../../hooks/useCredentials';

describe('OAuthField', () => {
  afterEach(() => {
    cleanup();
  });
  it('disables the connect button and shows banner when connector has allowNewCredentials = false', () => {
    vi.mocked(useConnector).mockReturnValue({
      data: {
        id: 'google-id',
        key: 'google',
        name: 'Google',
        authType: 'OAUTH2',
        allowNewCredentials: false,
      },
    } as any);

    const onConnect = vi.fn();
    render(
      <OAuthField
        id="google-field"
        label="Google Connection"
        connectorKey="google"
        connectorName="google"
        connected={false}
        onConnect={onConnect}
      />,
    );

    // Banner is rendered
    expect(
      screen.getByText('Tạm ngưng cấp kết nối mới'),
    ).toBeTruthy();

    // Connect button is disabled
    const button = screen.getByRole('button', { name: /Connect Google/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // Clicking does not call onConnect
    fireEvent.click(button);
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('enables the connect button when connector has allowNewCredentials = true', () => {
    vi.mocked(useConnector).mockReturnValue({
      data: {
        id: 'google-id',
        key: 'google',
        name: 'Google',
        authType: 'OAUTH2',
        allowNewCredentials: true,
      },
    } as any);

    const onConnect = vi.fn();
    render(
      <OAuthField
        id="google-field"
        label="Google Connection"
        connectorKey="google"
        connectorName="google"
        connected={false}
        onConnect={onConnect}
      />,
    );

    expect(
      screen.queryByText('New connections are temporarily disabled by the platform administrator.'),
    ).toBeNull();

    const button = screen.getByRole('button', { name: /Connect Google/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('displays error message when error prop is provided', () => {
    vi.mocked(useConnector).mockReturnValue({
      data: {
        id: 'google-id',
        key: 'google',
        name: 'Google',
        authType: 'OAUTH2',
        allowNewCredentials: false,
      },
    } as any);

    render(
      <OAuthField
        id="google-field"
        label="Google Connection"
        connectorKey="google"
        connectorName="google"
        connected={false}
        onConnect={vi.fn()}
        error="New credentials for this connector have been disabled by platform administrator"
      />,
    );

    expect(
      screen.getByText('New credentials for this connector have been disabled by platform administrator'),
    ).toBeTruthy();
  });
});
