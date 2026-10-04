export type RestoreStrategy =
  | 'PUBLISH_THEN_RESTORE'
  | 'BACKUP_THEN_RESTORE'
  | 'OVERWRITE';

export interface WorkflowVersionSummary {
  id: string;
  workflowId: string;
  versionNumber: number;
  publishedAt: string;
  publishedById: string;
}

export interface WorkflowVersionDetail extends WorkflowVersionSummary {
  definition: { nodes?: unknown[]; edges?: unknown[]; [key: string]: unknown };
}

export interface DraftStatusResponse {
  workflowId: string;
  hasDraft: boolean;
  hasUnpublishedChanges: boolean;
  currentPublishedVersion: {
    id: string;
    versionNumber: number;
    publishedAt: string;
  } | null;
  draftUpdatedAt: string | null;
}

export interface RestoreVersionRequest {
  strategy: RestoreStrategy;
  backupWorkflowName?: string;
  publishComment?: string;
}

export interface RestoreVersionResponse {
  workflowId: string;
  restoredFromVersionId: string;
  restoredVersionNumber: number;
  strategyUsed: RestoreStrategy;
  newPublishedVersionNumber?: number;
  backupWorkflowId?: string;
  draftUpdatedAt: string;
  definition: { nodes?: unknown[]; edges?: unknown[]; [key: string]: unknown };
}
