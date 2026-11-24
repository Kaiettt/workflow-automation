export const ADMIN_EXECUTION_STATUSES = [
  'QUEUED',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
] as const;
export const ADMIN_TRIGGER_TYPES = ['MANUAL', 'WEBHOOK', 'SCHEDULE'] as const;
export type AdminExecutionStatus = (typeof ADMIN_EXECUTION_STATUSES)[number];
export type AdminTriggerType = (typeof ADMIN_TRIGGER_TYPES)[number];

export interface AdminExecutionFilter {
  page: number;
  pageSize: number;
  ownerId?: string;
  workflowId?: string;
  executionId?: string;
  status?: AdminExecutionStatus;
  triggerType?: AdminTriggerType;
  from: Date;
  to: Date;
}
export interface AdminExecutionSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  versionId: string;
  versionNumber: number;
  triggerType: AdminTriggerType;
  status: AdminExecutionStatus;
  queuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  errorCode: string | null;
  cancellationReason: string | null;
}
export interface AdminExecutionPage {
  items: AdminExecutionSummary[];
  total: number;
  page: number;
  pageSize: number;
}
export interface AdminExecutionNodeLog {
  nodeId: string;
  nodeKey: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'TIMEOUT';
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  retryCount: number;
  errorCode: string | null;
}
export interface AdminExecutionDetail extends AdminExecutionSummary {
  nodeLogs: AdminExecutionNodeLog[];
}
