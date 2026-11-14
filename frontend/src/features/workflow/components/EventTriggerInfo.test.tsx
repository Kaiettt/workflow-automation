import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseActivation = vi.fn();
const mockUseNodeWebhooks = vi.fn();

vi.mock('../hooks/useWorkflowTriggers', () => ({
  useActivation: () => mockUseActivation(),
  useNodeWebhooks: () => mockUseNodeWebhooks(),
}));

import { EventTriggerInfo } from './EventTriggerInfo';

describe('EventTriggerInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('renders loading text when loading', () => {
    mockUseActivation.mockReturnValue({ data: null, isLoading: true });
    mockUseNodeWebhooks.mockReturnValue({ data: [] });

    render(
      <EventTriggerInfo
        workflowId="wf-1"
        versionId="v-1"
        triggerName="Webhook Trigger"
      />,
    );

    expect(screen.getByText(/Loading/i)).toBeTruthy();
  });

  it('displays inactive message when workflow is not active', () => {
    mockUseActivation.mockReturnValue({
      data: { active: false, versionId: null },
      isLoading: false,
    });
    mockUseNodeWebhooks.mockReturnValue({ data: [] });

    render(
      <EventTriggerInfo
        workflowId="wf-1"
        versionId="v-1"
        triggerName="Webhook Trigger"
      />,
    );

    expect(screen.getByText(/This workflow is inactive/i)).toBeTruthy();
  });

  it('displays listening message and webhook URLs when version is active', () => {
    mockUseActivation.mockReturnValue({
      data: { active: true, versionId: 'v-1' },
      isLoading: false,
    });
    mockUseNodeWebhooks.mockReturnValue({
      data: [
        {
          nodeId: 'node-webhook-1',
          scope: 'node',
          url: 'https://api.flowpilot.local/webhook/abc-123',
        },
      ],
    });

    render(
      <EventTriggerInfo
        workflowId="wf-1"
        versionId="v-1"
        triggerName="Stripe Event"
      />,
    );

    expect(screen.getByText(/This version is listening/i)).toBeTruthy();
    expect(screen.getByText('https://api.flowpilot.local/webhook/abc-123')).toBeTruthy();
  });
});

