import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { workflowApi } from '../api/workflow.api';
import { workflowService } from './workflow.service';

vi.mock('../api/workflow.api', () => ({
    workflowApi: {
        publishWorkflow: vi.fn(),
    },
}));

afterEach(() => {
    vi.resetAllMocks();
});

describe('workflowService.publishWorkflow', () => {
    it('preserves structured validation issues from the publish API', async () => {
        const issues = [
            {
                code: 'REQUIRED_FIELD_MISSING',
                severity: 'error',
                message: 'Required field "body" is missing.',
                nodeId: 'action-1',
                field: 'body',
            },
        ];
        const axiosError = new AxiosError('Request failed');
        axiosError.response = {
            data: { message: 'Workflow validation failed.', issues },
            status: 400,
            statusText: 'Bad Request',
            headers: {},
            config: { headers: new AxiosHeaders() },
        };
        vi.mocked(workflowApi.publishWorkflow).mockRejectedValue(axiosError);

        const error = await workflowService
            .publishWorkflow('workflow-1')
            .catch((caught: unknown) => caught);

        expect(error).toMatchObject({
            message: 'Workflow validation failed.',
            issues,
        });
    });
});
