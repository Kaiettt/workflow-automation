import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockTriggerApi = vi.hoisted(() => ({ activation: vi.fn(), setActive: vi.fn() }));
vi.mock('../api/trigger.api', () => ({ triggerApi: mockTriggerApi }));

import { ActiveToggle } from './ActiveToggle';

const renderToggle = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ActiveToggle workflowId="workflow-1" />
    </QueryClientProvider>,
  );

const refused = (message: string) =>
  new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { message },
  });

describe('ActiveToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTriggerApi.activation.mockResolvedValue({ active: false, versionId: null });
  });
  afterEach(cleanup);

  it('activates the workflow', async () => {
    mockTriggerApi.setActive.mockResolvedValue({ active: true, versionId: 'v1' });
    renderToggle();

    const toggle = await screen.findByRole('switch', { name: 'Active' });
    await waitFor(() => expect(toggle.getAttribute('aria-disabled')).not.toBe('true'));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);

    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    expect(mockTriggerApi.setActive).toHaveBeenCalledWith('workflow-1', true);
  });

  it('stays off and shows why the server refused', async () => {
    mockTriggerApi.setActive.mockRejectedValue(
      refused('"Messenger Trigger": (#100) Invalid callback URL'),
    );
    renderToggle();

    const toggle = await screen.findByRole('switch', { name: 'Active' });
    await waitFor(() => expect(toggle.getAttribute('aria-disabled')).not.toBe('true'));
    fireEvent.click(toggle);

    expect((await screen.findByRole('alert')).textContent).toContain(
      '(#100) Invalid callback URL',
    );
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });
});
