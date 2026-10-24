import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublishValidationAlert } from './PublishValidationAlert';

const issue = {
    code: 'REQUIRED_FIELD_MISSING',
    severity: 'error',
    message: 'Required field "body" is missing for Send Gmail.',
    nodeId: 'action-1',
    field: 'body',
};

describe('PublishValidationAlert', () => {
    it('shows validation details and lets users focus the affected node', () => {
        const onFocusNode = vi.fn();
        const onDismiss = vi.fn();

        render(
            <PublishValidationAlert
                message="Workflow validation failed."
                issues={[issue]}
                onFocusNode={onFocusNode}
                onDismiss={onDismiss}
            />,
        );

        expect(screen.getByRole('alert').textContent).toContain(
            'Required field "body" is missing for Send Gmail.',
        );
        expect(screen.getByText('Field: body')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Focus node action-1' }));
        expect(onFocusNode).toHaveBeenCalledWith('action-1');
    });
});
