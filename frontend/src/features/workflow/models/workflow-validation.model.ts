export interface WorkflowValidationIssue {
    code: string;
    severity?: string;
    message: string;
    nodeId?: string;
    field?: string;
}

export class WorkflowPublishValidationError extends Error {
    constructor(
        message: string,
        public readonly issues: WorkflowValidationIssue[],
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'WorkflowPublishValidationError';
    }
}