export interface WorkflowValidationIssue {
    code: string;
    severity?: string;
    message: string;
    nodeId?: string;
    field?: string;
}

export class WorkflowPublishValidationError extends Error {
    readonly issues: WorkflowValidationIssue[];

    constructor(
        message: string,
        issues: WorkflowValidationIssue[],
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.issues = issues;
        this.name = 'WorkflowPublishValidationError';
    }
}