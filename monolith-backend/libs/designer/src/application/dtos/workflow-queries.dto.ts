import { WorkflowStatus } from '../../domain/enums/workflow-status.enum';

export interface WorkflowSummaryDto {
  id: string;
  name: string;
  status: WorkflowStatus;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WorkflowVersionSummaryDto {
  id: string;
  workflowId: string;
  versionNumber: number;
  publishedAt: Date;
  publishedById: string;
}

export interface WorkflowVersionDetailDto {
  id: string;
  workflowId: string;
  versionNumber: number;
  definition: Record<string, unknown>;
  publishedById: string;
  publishedAt: Date;
  createdAt?: Date;
}
