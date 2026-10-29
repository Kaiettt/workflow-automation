import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkflowTrigger } from '../../types/trigger.types';

const mockTriggerApi = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../../api/trigger.api', () => ({ triggerApi: mockTriggerApi }));

import { WebhookUrlField } from './WebhookUrlField';

const renderField = (nodeId: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <WebhookUrlField workflowId="workflow-1" nodeId={nodeId} />
    </QueryClientProvider>,
  );

const hook: WorkflowTrigger = {
  nodeId: 'hook',
  triggerKey: 'trigger.webhook',
  channel: 'WEBHOOK',
  workflowVersionId: 'version-1',
  webhookUrl: 'https://flow.example.com/api/webhooks/w/token-1',
};

describe('WebhookUrlField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('shows the URL of the published webhook node', async () => {
    mockTriggerApi.list.mockResolvedValue([hook]);
    renderField('hook');

    expect(await screen.findByDisplayValue(hook.webhookUrl as string)).toBeTruthy();
    expect(mockTriggerApi.list).toHaveBeenCalledWith('workflow-1');
    expect(
      (screen.getByRole('button', { name: 'Copy webhook URL' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('asks to publish when the node has no URL yet', async () => {
    mockTriggerApi.list.mockResolvedValue([hook]);
    renderField('new-node');

    expect(await screen.findByText('Publish the workflow to get its URL.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Copy webhook URL' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
