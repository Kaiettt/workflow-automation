export const executionStatuses = [
  "QUEUED",
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
] as const;
export const executionTriggerTypes = ["MANUAL", "WEBHOOK", "SCHEDULE"] as const;
export type AdminExecutionStatus = (typeof executionStatuses)[number];
export type AdminTriggerType = (typeof executionTriggerTypes)[number];
export interface AdminExecutionFilter {
  page: number;
  pageSize: number;
  ownerId?: string;
  workflowId?: string;
  executionId?: string;
  status?: AdminExecutionStatus;
  triggerType?: AdminTriggerType;
  from?: string;
  to?: string;
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
  status: AdminExecutionStatus;
  triggerType: AdminTriggerType;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  errorCode: string | null;
  cancellationReason: string | null;
}
export interface AdminExecutionNodeLog {
  nodeId: string;
  nodeKey: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED" | "TIMEOUT";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  retryCount: number;
  errorCode: string | null;
}
export interface AdminExecutionDetail extends AdminExecutionSummary {
  nodeLogs: AdminExecutionNodeLog[];
}
