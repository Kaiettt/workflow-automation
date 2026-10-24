import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowPublishValidationError } from '../models/workflow-validation.model';
import { useDesignerStore } from '../store/designer.store';

const mockWorkflowService = vi.hoisted(() => ({
    getDraft: vi.fn(),
    getNodeTypes: vi.fn(),
    saveDraft: vi.fn(),
    publishWorkflow: vi.fn(),
}));

vi.mock('../services/workflow.service', () => ({
    workflowService: mockWorkflowService,
}));

vi.mock('../components/DesignerLayout', () => ({
    DesignerLayout: ({
        nodes,
        onPublish,
    }: {
        nodes: Array<{ id: string; className?: string }>;
        onPublish: () => void;
    }) => (
        <>
            <button type="button" onClick={() => void onPublish()}>
                Publish
            </button>
            <output data-testid="designer-nodes">
                {JSON.stringify(
                    nodes.map(({ id, className }) => ({ id, className })),
                )}
            </output>
        </>
    ),
}));

vi.mock('../components/VersionHistoryDialog', () => ({
    VersionHistoryDialog: () => null,
}));

import { DesignerPage } from './DesignerPage';

interface RenderedNode {
    id: string;
    className?: string;
}

describe('DesignerPage publish validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useDesignerStore.getState().setSelectedNodeId(null);
        mockWorkflowService.getDraft.mockResolvedValue({
            definition: {
                nodes: [
                    {
                        id: 'action-1',
                        type: 'integration.gmail.send',
                        position: { x: 0, y: 0 },
                        data: { name: 'Send Gmail', key: 'integration.gmail.send', config: {} },
                    },
                ],
                edges: [],
            },
        });
        mockWorkflowService.getNodeTypes.mockResolvedValue([]);
        mockWorkflowService.saveDraft.mockResolvedValue(undefined);
        mockWorkflowService.publishWorkflow.mockRejectedValue(
            new WorkflowPublishValidationError('Workflow validation failed.', [
                {
                    code: 'REQUIRED_FIELD_MISSING',
                    severity: 'error',
                    message: 'Required field "body" is missing for Send Gmail.',
                    nodeId: 'action-1',
                    field: 'body',
                },
            ]),
        );
    });

    it('shows the publish issue, highlights its node, and focuses its properties', async () => {
        render(
            <MemoryRouter>
                <DesignerPage workflowId="workflow-1" />
            </MemoryRouter>,
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('Send Gmail');
        expect(alert.textContent).toContain('Body is required');

        const renderedNodes = JSON.parse(
            screen.getByTestId('designer-nodes').textContent ?? '[]',
        ) as RenderedNode[];
        expect(renderedNodes[0]?.className).toContain(
            'workflow-validation-error',
        );

        fireEvent.click(screen.getByRole('button', { name: 'Focus node action-1' }));
        expect(useDesignerStore.getState().selectedNodeId).toBe('action-1');
    });
});
