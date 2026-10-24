import { X } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { WorkflowValidationIssue } from '../models/workflow-validation.model';

interface PublishValidationAlertProps {
    message: string;
    issues: WorkflowValidationIssue[];
    onFocusNode: (nodeId: string) => void;
    onDismiss: () => void;
}

export function PublishValidationAlert({
    message,
    issues,
    onFocusNode,
    onDismiss,
}: PublishValidationAlertProps) {
    return (
        <Alert
            variant="destructive"
            className="absolute left-1/2 top-16 z-50 w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 shadow-lg"
        >
            <AlertTitle>Workflow could not be published</AlertTitle>
            <AlertDescription className="mt-1">
                <p>{message}</p>
                {issues.length > 0 && (
                    <ul className="mt-3 space-y-2">
                        {issues.map((issue, index) => (
                            <li
                                key={`${issue.code}-${issue.nodeId ?? 'workflow'}-${issue.field ?? index}`}
                                className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5"
                            >
                                <p>{issue.message}</p>
                                {(issue.nodeId || issue.field) && (
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                        {issue.nodeId && <span>Node: {issue.nodeId}</span>}
                                        {issue.field && <span>Field: {issue.field}</span>}
                                        {issue.nodeId && (
                                            <Button
                                                type="button"
                                                variant="link"
                                                size="sm"
                                                className="h-auto p-0 text-destructive underline"
                                                aria-label={`Focus node ${issue.nodeId}`}
                                                onClick={() => onFocusNode(issue.nodeId!)}
                                            >
                                                Show node
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </AlertDescription>
            <AlertAction>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Dismiss publish validation errors"
                    onClick={onDismiss}
                >
                    <X className="size-4" />
                </Button>
            </AlertAction>
        </Alert>
    );
}