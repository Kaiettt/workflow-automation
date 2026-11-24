import type { UserRole } from '../../auth/types/auth.types';
export type { AdminExecutionFilter, AdminExecutionSummary, AdminExecutionDetail } from './admin-execution.types';

export type NodeTypeCategory = 'TRIGGER' | 'LOGIC' | 'DATA_PROCESSING' | 'INTEGRATION' | 'AI';
export interface NodeTypeAdminItem {
  id: string; key: string; displayName: string; icon: string | null; color: string | null; category: NodeTypeCategory;
  connectorId: string | null; connectorKey: string | null; connectorName: string | null;
  isCatalogVisible: boolean; isExecutionAllowed: boolean; revision: number;
  publishedWorkflowCount: number; draftWorkflowCount: number; createdAt: string; updatedAt: string;
}
export interface NodeTypeAdminDetail extends NodeTypeAdminItem {
  configSchema: unknown; inputSchema: unknown; outputSchema: unknown;
  workflows: { id: string; name: string; ownerEmail: string; status: 'DRAFT' | 'PUBLISHED' }[];
}
export interface NodeTypeFilter {
  page: number; pageSize: number; q?: string; category?: NodeTypeCategory; connectorId?: string;
  isCatalogVisible?: boolean; isExecutionAllowed?: boolean;
  sortBy?: 'displayName' | 'updatedAt'; sortOrder?: 'asc' | 'desc';
}
export interface ChangeNodeTypeStatusPayload {
  isCatalogVisible?: boolean; isExecutionAllowed?: boolean; reason: string; expectedRevision: number;
}
export interface NodeTypePolicySnapshot {
  nodeTypeKey: string; isCatalogVisible: boolean; isExecutionAllowed: boolean; revision: number; updatedAt: string;
}

export type AccountChangeAction = 'active' | 'role';

export interface Account {
  id: string; name: string; email: string; role: UserRole; isActive: boolean;
  revision: number; createdAt: string; updatedAt: string;
  counts?: { workflows: number; credentials: number; executions: number };
}
export interface UserFilter { page: number; pageSize: number; q?: string; role?: UserRole; isActive?: boolean; }
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number; }
export interface WorkflowSummary { id: string; name: string; status: string; active: boolean; updatedAt: string; }
export interface DashboardFilter { from: string; to: string; timezone: string; }
export interface Dashboard {
  updatedAt: string; from: string; to: string; timezone: string;
  users: { total: number; clientsActive: number; clientsInactive: number; adminsActive: number };
  workflows: { total: number; active: number; DRAFT: number; PUBLISHED: number; ARCHIVED: number };
  executions: Record<string, number>; successRate: number | null;
  trend: { day: string; status: string; count: number }[];
  errors: { code: string; count: number }[];
}

export type ConnectorAuthType = 'NONE' | 'API_KEY' | 'OAUTH2' | 'BASIC';

export interface ConnectorAdminItem {
  id: string;
  key: string;
  name: string;
  authType: ConnectorAuthType;
  isActive: boolean;
  allowNewCredentials: boolean;
  revision: number;
  credentialCount: number;
  workflowCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorNodeType {
  id: string;
  key: string;
  displayName: string;
  category: string;
  isActive: boolean;
}

export interface ConnectorAdminDetail extends ConnectorAdminItem {
  nodeTypes: ConnectorNodeType[];
}

export interface ConnectorFilter {
  page: number;
  pageSize: number;
  q?: string;
  authType?: ConnectorAuthType;
  isActive?: boolean;
  allowNewCredentials?: boolean;
}

export interface ChangeConnectorPolicyPayload {
  allowNewCredentials: boolean;
  reason: string;
  expectedRevision: number;
}
