import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeWebhook } from '../../types/trigger.types';

const mockTriggerApi = vi.hoisted(() => ({ webhooks: vi.fn() }));
vi.mock('../../api/trigger.api', () => ({ triggerApi: mockTriggerApi }));

import { WebhookUrlField } from './WebhookUrlField';

const renderField = (nodeId: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <WebhookUrlField workflowId="workflow-1" nodeId={nodeId} />
    </QueryClientProvider>,
  );

const hook: NodeWebhook = {
  nodeId: 'hook',
  nodeKey: 'webhook.trigger',
  scope: 'node',
  url: 'https://flow.example.com/api/webhooks/2f0c8a52-0000-4000-8000-000000000001',
};

describe('WebhookUrlField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('shows the URL of the webhook node before anything is published', async () => {
    mockTriggerApi.webhooks.mockResolvedValue([hook]);
    renderField('hook');

    expect(await screen.findByDisplayValue(hook.url as string)).toBeTruthy();
    expect(mockTriggerApi.webhooks).toHaveBeenCalledWith('workflow-1');
    expect(screen.getByText(/while the workflow is Active/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Copy webhook URL' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('waits for the draft to save when the node has no URL yet', async () => {
    mockTriggerApi.webhooks.mockResolvedValue([hook]);
    renderField('new-node');

    expect(await screen.findByText('The URL appears once the draft is saved.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Copy webhook URL' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
