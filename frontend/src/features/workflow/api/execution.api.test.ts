import { afterEach, describe, expect, it, vi } from 'vitest';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../shared/api/http-client', () => ({
  apiClient: mockApiClient,
}));

import { executionApi } from './execution.api';

describe('executionApi', () => {
  afterEach(() => vi.resetAllMocks());

  it('starts a manual run and returns the accepted execution resource', async () => {
    const accepted = {
      id: 'execution-1',
      workflowId: 'workflow-1',
      workflowVersionId: 'version-1',
      triggerType: 'MANUAL',
      status: 'QUEUED',
      queuedAt: '2026-11-07T10:00:00.000Z',
      startedAt: null,
    };
    mockApiClient.post.mockResolvedValue({ data: { data: accepted } });

    await expect(
      executionApi.startExecution(
        { workflow_version_id: 'version-1' },
        'intent-1',
      ),
    ).resolves.toEqual(accepted);
    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/executions',
      { workflow_version_id: 'version-1' },
      { headers: { 'Idempotency-Key': 'intent-1' } },
    );
  });

  it('loads one execution by ID for status polling', async () => {
    const execution = { id: 'execution-1', status: 'RUNNING', nodeLogs: [] };
    mockApiClient.get.mockResolvedValue({ data: { data: execution } });

    await expect(executionApi.getExecution('execution-1')).resolves.toEqual(
      execution,
    );
    expect(mockApiClient.get).toHaveBeenCalledWith(
      '/api/executions/execution-1',
    );
  });

  it('loads execution history for the selected workflow version', async () => {
    const history = { items: [], nextCursor: null };
    mockApiClient.get.mockResolvedValue({ data: { data: history } });

    await expect(
      executionApi.listExecutions({
        workflowId: 'workflow-1',
        workflowVersionId: 'version-1',
      }),
    ).resolves.toEqual(history);
    expect(mockApiClient.get).toHaveBeenCalledWith('/api/executions', {
      params: {
        workflow_id: 'workflow-1',
        workflow_version_id: 'version-1',
      },
    });
  });
});